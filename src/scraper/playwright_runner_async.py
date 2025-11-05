# src/scraper/playwright_runner_async.py
# Purpose: Async Playwright login + pagination for Colab. Clean, map, export CSV. Optional GitHub push.
from __future__ import annotations
import re
from pathlib import Path
from typing import Optional, Dict, Any, List

import pandas as pd
from tenacity import retry, stop_after_attempt, wait_exponential
from playwright.async_api import async_playwright

# Reuse your existing GitHub push helper if present:
try:
    from .github_push import push_file  # type: ignore
except Exception:
    push_file = None  # Will skip push if not available

def _classify_harm(code: str) -> tuple[str, str]:
    code = (code or "").strip()
    clinical = general = ""
    if code in {"A","B"}: clinical = "ไม่เกิดความรุนแรง (No Harm)"
    elif code in {"C","D"}: clinical = "เกิดความรุนแรงน้อย (Low Harm)"
    elif code in {"E","F"}: clinical = "เกิดความรุนแรงปานกลาง (Moderate Harm)"
    elif code in {"G","H"}: clinical = "เกิดความรุนแรงมาก (Severe Harm)"
    elif code == "I": clinical = "เสียชีวิต (Death)"
    elif code == "1": general = "น้อยมาก"
    elif code == "2": general = "น้อย"
    elif code == "3": general = "ปานกลาง"
    elif code == "4": general = "สูง"
    elif code == "5": general = "สูงมาก"
    return clinical, general

def _extract_date(label: str, text: str) -> pd.Timestamp | pd.NaT:
    m = re.search(rf"{re.escape(label)}\s*:\s*(\d{{2}}/\d{{2}}/\d{{4}})", text or "")
    return pd.to_datetime(m.group(1), format="%d/%m/%Y", errors="coerce") if m else pd.NaT

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def _fetch_rows_async(base_url: str, username: str, password: str, headless: bool, max_pages: int) -> List[List[str]]:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        await page.goto(f"{base_url}/Account/Login", wait_until="load", timeout=60_000)
        await page.fill("#txtUserName", username)
        await page.fill("#txtPass", password)
        await page.click("#btnLogon")
        await page.wait_for_timeout(2000)

        await page.goto(f"{base_url}/Database/RiskBookingAllList", wait_until="load", timeout=60_000)
        await page.wait_for_timeout(2000)

        data: List[List[str]] = []
        for _ in range(max_pages):
            rows = await page.query_selector_all("#tbDataList tbody tr")
            if not rows:
                break
            for r in rows:
                cols = await r.query_selector_all("td")
                row_data: List[str] = []
                for c in cols:
                    txt = await c.inner_text()
                    row_data.append((txt or "").strip())
                if row_data:
                    data.append(row_data)

            next_btn = await page.query_selector('a[aria-label="Next"]')
            cls = (await next_btn.get_attribute("class")) if next_btn else "disabled"
            if next_btn and (cls or "").find("disabled") == -1:
                await next_btn.click()
                await page.wait_for_timeout(1500)
            else:
                break

        await browser.close()
        return data

async def run_and_export_async(
    username: str,
    password: str,
    base_url: str,
    headless: bool,
    max_pages: int,
    csv_local_path: str,
    github: Optional[Dict[str, Any]] = None,
) -> str:
    rows = await _fetch_rows_async(base_url, username, password, headless, max_pages)
    if not rows:
        raise RuntimeError("No rows scraped; check credentials, access, or page selectors.")

    df = pd.DataFrame(rows)
    df.columns = ["Incident_ID","Incident_Type","Location","Related_Location","Severity_Code","Status_Info"]

    df["Incident_Type_Code"]    = df["Incident_Type"].str.extract(r"^([A-Z]+\d+):", expand=False)
    df["Incident_Type_Details"] = df["Incident_Type"].str.extract(r"^[A-Z]+\d+:(.*)", expand=False)

    labels = [
        ("Incident_Date", "วันที่เกิดเหตุ"),
        ("Discovery_Date", "วันที่ค้นพบ"),
        ("Report_Date", "วันที่บันทึกรายงาน"),
        ("Confirmation_Date", "วันที่ยืนยัน"),
        ("Notification_Date", "วันที่แจ้งเหตุ"),
        ("Status_Date", "วันที่ของสถานะ"),
        ("Resolution_Date", "วันที่กลุ่ม/หน่วยงานหลักแก้ไขเสร็จ"),
    ]
    for col, label in labels:
        df[col] = df["Status_Info"].apply(lambda x, lab=label: _extract_date(lab, x))

    harms = df["Severity_Code"].apply(_classify_harm)
    df["Harm_Level_Clinical"] = [h[0] for h in harms]
    df["Harm_Level_General"]  = [h[1] for h in harms]

    df_final = df[
        [
            "Incident_ID","Incident_Type_Code","Incident_Type_Details","Location","Related_Location",
            "Severity_Code","Harm_Level_Clinical","Harm_Level_General",
            "Incident_Date","Discovery_Date","Report_Date","Confirmation_Date",
            "Notification_Date","Status_Date","Resolution_Date",
        ]
    ].copy()

    out = Path(csv_local_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    df_final.to_csv(out, index=False, encoding="utf-8")
    msg = f"Saved CSV: {out}"

    if github and github.get("token") and push_file:
        link = push_file(
            token=github["token"],
            owner=github["owner"],
            repo=github["repo"],
            branch=github.get("branch","main"),
            repo_path=github.get("repo_path","data/incidents.csv"),
            content_bytes=out.read_bytes(),
            commit_message=github.get("commit_message","update incidents.csv"),
        )
        msg += f" | Pushed: {link}"
    return msg
