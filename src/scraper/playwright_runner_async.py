# src/scraper/playwright_runner_async.py
# Purpose: Harden login/navigation to prevent TimeoutError and produce diagnostics.

from playwright.async_api import TimeoutError as PWTimeout
import re

# ... keep imports above unchanged ...

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def _scrape_datatables_all(
    base_url: str,
    username: str,
    password: str,
    headless: bool,
    page_len: int,
    diag_dir: Path,
) -> list[dict]:
    diag_dir.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        ctx = await browser.new_context()
        page = await ctx.new_page()

        # 1) Login without expect_navigation (many ASP.NET forms do Ajax or delayed redirects)
        await page.goto(f"{base_url}/Account/Login", wait_until="domcontentloaded", timeout=120_000)
        await page.fill("#txtUserName", username)
        await page.fill("#txtPass", password)
        await page.click("#btnLogon")

        # Wait for any of the following: URL change, presence of navbar user menu, or the orange button
        login_ok = False
        try:
            await page.wait_for_load_state("networkidle", timeout=120_000)
        except PWTimeout:
            pass  # continue with selector checks

        # Try URL heuristic
        if "Account/Login" not in page.url:
            login_ok = True
        else:
            # Try selector evidence of logged-in state
            try:
                await page.wait_for_selector('a.btn.btn-warning[href*="RiskBookingAllList"]', timeout=120_000)
                login_ok = True
            except PWTimeout:
                try:
                    await page.wait_for_selector('a[href*="Account/Logoff"]', timeout=60_000)
                    login_ok = True
                except PWTimeout:
                    login_ok = False

        if not login_ok:
            (diag_dir / "login_failed.html").write_text(await page.content(), encoding="utf-8")
            await page.screenshot(path=str(diag_dir / "login_failed.png"))
            await browser.close()
            raise RuntimeError("Login failed or too slow. See _diag/login_failed.*")

        # 2) Go to the list page directly. This avoids brittle in-page navigation waits.
        await page.goto(f"{base_url}/Database/RiskBookingAllList", wait_until="domcontentloaded", timeout=120_000)
        try:
            await page.wait_for_load_state("networkidle", timeout=60_000)
        except PWTimeout:
            pass  # acceptable; we read via JSON API next

        ds_url = f"{base_url}/Reports/GetRiskBookingAllList"

        all_rows: list[dict] = []
        start = 0
        draw = 1
        total = None

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
            resp = await page.request.post(ds_url, form=form, timeout=120_000)
            if not resp.ok:
                # Record status/text for troubleshooting
                (diag_dir / f"request_{start}.txt").write_text(
                    f"HTTP {resp.status}\n\n{await resp.text()}",
                    encoding="utf-8"
                )
                break

            obj = await resp.json()
            data = obj.get("data") or obj.get("aaData") or []
            records_total = obj.get("recordsTotal") or obj.get("iTotalRecords")
            if total is None and isinstance(records_total, int):
                total = records_total

            if not data:
                break

            for r in data:
                if isinstance(r, dict):
                    all_rows.append(r)
                else:
                    all_rows.append({f"col{i}": v for i, v in enumerate(r)})

            # Progress log
            if total:
                pct = min(100, int(len(all_rows) / total * 100))
                print(f"Collected {len(all_rows)}/{total} rows (~{pct}%)")
            else:
                print(f"Collected {len(all_rows)} rows")

            got = len(data)
            if got < page_len:
                break
            start += page_len
            draw += 1
            if total and len(all_rows) >= total:
                break

        # Save a short summary for verification
        (diag_dir / "summary.json").write_text(
            json.dumps({"total_reported": total, "collected": len(all_rows)}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        await browser.close()
        return all_rows
