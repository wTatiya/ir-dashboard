# src/scraper/playwright_runner.py
# Purpose: Headless login + pagination with Playwright. Clean, map, export CSV. Optional GitHub push.
from __future__ import annotations
import re, time
from pathlib import Path
from typing import Optional, Dict, Any, List

import pandas as pd
from tenacity import retry, stop_after_attempt, wait_exponential
from playwright.sync_api import sync_playwright

from .github_push import push_file  # reuse the earlier utility if present; otherwise include it

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
def _fetch_rows(base_url: str, username: str, password: str, headless: bool, max_pages: int) -> List[List[str]]:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        ctx = browser.new_context()
        page = ctx.new_page()

        page.goto(f"{base_url}/Account/Login", wait_until="load", timeout=60000)
        page.fill("#txtUserName", username)
        page.fill("#txtPass", password)
        page.click("#btnLogon")
        page.wait_for_timeout(2000)

        page.goto(f"{base_url}/Database/RiskBookingAllList", wait_until="load", timeout=60000)
        page.wait_for_timeout(2000)

        data: List[List[str]] = []
        for _ in range(max_pages):
            rows = page.query_selector_all("#tbDataList tbody tr")
            if not rows:
                break
            for r in rows:
                cols = r.query_selector_all("td")
                row_data = [ (c.inner_text() or "").strip() for c in cols ]
                if row_data:
                    data.append(row_data)
            next_btn = page.query_selector('a[aria-label="Next"]')
            cls = (next_btn.get_attribute("class") or "") if next_btn else "disabled"
            if next_btn and "disabled" not in cls:
                next_btn.click()
                page.wait_for_timeout(1500)
            else:
                break

        browser.close()
        return data

def run_and_export(
    username: str,
    password: str,
    base_url: str,
    headless: bool,
    max_pages: int,
    csv_local_path: str,
    github: Optional[Dict[str, Any]] = None,
) -> str:
    rows = _fetch_rows(base_url, username, password, headless, max_pages)
    if not rows:
        raise RuntimeError("No rows scraped; check credentials, access, or page selectors.")

    df = pd.DataFrame(rows)
    df.columns = ["Incident_ID","Incident_Type","Location","Related_Location","Severity_Code","Status_Info"]

    # Parse incident type fields
    df["Incident_Type_Code"] = df["Incident_Type"].str.extract(r"^([A-Z]+\d+):", expand=False)
    df["Incident_Type_Details"] = df["Incident_Type"].str.extract(r"^[A-Z]+\d+:(.*)", expand=False)

    # Date extraction
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

    # Harm classification
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

    if github and github.get("token"):
        from .github_push import push_file
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
