# src/scraper/playwright_runner_async.py
# Purpose: Login, click the target button, then page the DataTables endpoint until all rows (~20k) are retrieved.
from __future__ import annotations
import json, re
from pathlib import Path
from typing import Optional, Dict, Any, List

import pandas as pd
from tenacity import retry, stop_after_attempt, wait_exponential
from playwright.async_api import async_playwright, TimeoutError as PWTimeout

try:
    from .github_push import push_file  # optional
except Exception:
    push_file = None

PAGE_LEN_DEFAULT = 100  # DataTables page size; raise to 500 if server allows

# ---- helpers ----
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

def _status_info(row: dict) -> str:
    parts = []
    parts.append(f"{row.get('EditStatusName','')}")
    parts.append(f"วันที่เกิดเหตุ : {row.get('RiskEffDate','-')} วันที่ค้นพบ : {row.get('RiskDetectDate','-')}")
    parts.append(f"วันที่บันทึกรายงาน : {row.get('ReportDate','-')}")
    parts.append(f"วันที่ยืนยัน : {row.get('LoginConfirmDate','-')} วันที่แจ้งเหตุ : {row.get('ConfirmDate','-')}")
    parts.append(f"วันที่ของสถานะ : {row.get('StatusDate','-')}")
    parts.append(f"วันที่กลุ่ม/หน่วยงานหลักแก้ไขเสร็จ : {row.get('FinishDate_Edit','-')}")
    return " | ".join(parts)

def _extract_date(label: str, text: str) -> pd.Timestamp | pd.NaT:
    m = re.search(rf"{re.escape(label)}\s*:\s*(\d{{2}}/\d{{2}}/\d{{4}})", text or "")
    return pd.to_datetime(m.group(1), format="%d/%m/%Y", errors="coerce") if m else pd.NaT

# ---- core scrape via DataTables endpoint with full pagination ----
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def _scrape_datatables_all(
    base_url: str,
    username: str,
    password: str,
    headless: bool,
    page_len: int,
    diag_dir: Path,
) -> List[dict]:
    diag_dir.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        # 1) Login
        await page.goto(f"{base_url}/Account/Login", wait_until="domcontentloaded", timeout=60_000)
        await page.fill("#txtUserName", username)
        await page.fill("#txtPass", password)
        async with page.expect_navigation(wait_until="load", timeout=60_000):
            await page.click("#btnLogon")
        if "Account/Login" in page.url:
            (diag_dir / "login_failed.html").write_text(await page.content(), encoding="utf-8")
            await page.screenshot(path=str(diag_dir / "login_failed.png"))
            raise RuntimeError("Login failed")

        # 2) Click the orange button or navigate directly
        try:
            btn = await page.query_selector('a.btn.btn-warning[href*="RiskBookingAllList"]')
            if btn:
                async with page.expect_navigation(wait_until="domcontentloaded", timeout=60_000):
                    await btn.click()
            else:
                await page.goto(f"{base_url}/Database/RiskBookingAllList", wait_until="domcontentloaded", timeout=60_000)
        except PWTimeout:
            await page.goto(f"{base_url}/Database/RiskBookingAllList", wait_until="domcontentloaded", timeout=60_000)

        ds_url = f"{base_url}/Reports/GetRiskBookingAllList"

        all_rows: List[dict] = []
        start = 0
        draw = 1
        total = None  # recordsTotal from server

        # Loop until server returns fewer than requested OR we reach recordsTotal
        while True:
            form = {
                "draw": str(draw),
                "start": str(start),
                "length": str(page_len),
                "search[value]": "",
                "search[regex]": "false",
                "order[0][column]": "0",
                "order[0][dir]": "desc",
            }
            resp = await page.request.post(ds_url, form=form, timeout=60_000)
            if not resp.ok:
                (diag_dir / f"request_{start}.txt").write_text(f"HTTP {resp.status}", encoding="utf-8")
                break

            obj = await resp.json()
            data = obj.get("data") or obj.get("aaData") or []
            records_total = obj.get("recordsTotal") or obj.get("iTotalRecords")
            if total is None and isinstance(records_total, int):
                total = records_total

            if not data:
                break

            # Normalize rows as dicts
            for r in data:
                if isinstance(r, dict):
                    all_rows.append(r)
                elif isinstance(r, list):
                    all_rows.append({f"col{i}": v for i, v in enumerate(r)})

            # Progress
            if total:
                pct = min(100, int(len(all_rows) / total * 100))
                print(f"Collected {len(all_rows)}/{total} rows (~{pct}%)")
            else:
                print(f"Collected {len(all_rows)} rows")

            # Advance or stop
            got = len(data)
            if got < page_len:
                break
            start += page_len
            draw += 1

            if total and len(all_rows) >= total:
                break

        await browser.close()
        (diag_dir / "summary.json").write_text(
            json.dumps({"total_reported": total, "collected": len(all_rows)}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return all_rows

async def run_and_export_async(
    username: str,
    password: str,
    base_url: str,
    headless: bool,
    max_pages: int,         # kept for API compatibility; not used by JSON paging
    csv_local_path: str,
    github: Optional[Dict[str, Any]] = None,
) -> str:
    diag_dir = Path(csv_local_path).parent / "_diag"
    rows = await _scrape_datatables_all(
        base_url=base_url,
        username=username,
        password=password,
        headless=headless,
        page_len=PAGE_LEN_DEFAULT,
        diag_dir=diag_dir,
    )
    if not rows:
        raise RuntimeError(f"No rows scraped; see diagnostics in {diag_dir}")

    # Build DataFrame from dict rows
    cols_order = [
        "Code", "RiskName", "MainReferName", "CoEditorName",
        "RiskEffName", "EditStatusName",
        "RiskEffDate", "RiskDetectDate", "ReportDate",
        "LoginConfirmDate", "ConfirmDate", "StatusDate", "FinishDate_Edit",
    ]
    df = pd.DataFrame(rows)
    present = [c for c in cols_order if c in df.columns]
    df = df[present].copy()

    df["Status_Info"] = df.apply(lambda r: _status_info(r.to_dict()), axis=1)
    df["Severity_Code"] = df.get("RiskEffName", "")

    df_final = pd.DataFrame({
        "Incident_ID": df.get("Code"),
        "Incident_Type_Code": pd.NA,
        "Incident_Type_Details": df.get("RiskName"),
        "Location": df.get("MainReferName"),
        "Related_Location": df.get("CoEditorName"),
        "Severity_Code": df.get("Severity_Code"),
        "Harm_Level_Clinical": df.get("Severity_Code").map(lambda x: _classify_harm(str(x))[0]),
        "Harm_Level_General":  df.get("Severity_Code").map(lambda x: _classify_harm(str(x))[1]),
        "Incident_Date": pd.to_datetime(df.get("RiskEffDate"), dayfirst=True, errors="coerce"),
        "Discovery_Date": pd.to_datetime(df.get("RiskDetectDate"), dayfirst=True, errors="coerce"),
        "Report_Date": pd.to_datetime(df.get("ReportDate"), dayfirst=True, errors="coerce"),
        "Confirmation_Date": pd.to_datetime(df.get("LoginConfirmDate"), dayfirst=True, errors="coerce"),
        "Notification_Date": pd.to_datetime(df.get("ConfirmDate"), dayfirst=True, errors="coerce"),
        "Status_Date": pd.to_datetime(df.get("StatusDate"), dayfirst=True, errors="coerce"),
        "Resolution_Date": pd.to_datetime(df.get("FinishDate_Edit"), dayfirst=True, errors="coerce"),
        "Status_Info": df.get("Status_Info"),
    })

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
