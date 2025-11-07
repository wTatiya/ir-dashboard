# ir-dashboard
https://wtatiya.github.io/ir-dashboard/


# Colab DataTables Scraper (Playwright, Async)

- Add `src/scraper/playwright_runner_async.py` and `src/scraper/github_push.py` to your repo.
- Open the provided Colab notebook and run the first cell.
- CSV is written to `output/incidents.csv`. Optional push back to GitHub is supported.

## CSV schema
```
Incident_ID,Incident_Type,Incident_Type_Details,Location,Related_Location,
Severity_Code,Harm_Level,Incident_Status,
Incident_Date,Discovery_Date,Report_Date,Confirmation_Date,
Notification_Date,Status_Date,Resolution_Date
