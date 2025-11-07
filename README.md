# IR GitHub Pages Dashboard

This package gives you a static dashboard that mirrors the provided UI mock. It works on GitHub Pages with no build step.

## Deploy
1. Extract this zip into the root of your repo (replace existing `index.html`, `assets/`, and `data/`).
2. Commit and push to GitHub. If Pages is enabled from the main branch, it will go live automatically.
3. Keep your processed CSV at `data/incidents.csv` with headers matching your schema.

## CSV columns
Expected columns:
`Incident_ID,Incident_Type,Incident_Type_Details,Location,Related_Location,Severity_Code,Harm_Level,Incident_Status,Incident_Date,Report_Date,Confirmation_Date,Resolution_Date`

If the CSV is missing, the page will render demo data.
