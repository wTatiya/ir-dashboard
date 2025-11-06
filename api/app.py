import os, json, hashlib
from datetime import datetime, timezone
from flask import Flask, make_response, request
from google.oauth2 import service_account
from googleapiclient.discovery import build

SHEET_ID = os.environ["SHEET_ID"]
RANGE = os.environ.get("SHEET_RANGE", "clean!A:Z")
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
CREDS = service_account.Credentials.from_service_account_info(
    json.loads(os.environ["GCP_SA_JSON"]), scopes=SCOPES
)

app = Flask(__name__)

def _get_rows():
    svc = build("sheets", "v4", credentials=CREDS, cache_discovery=False)
    values = svc.spreadsheets().values().get(
        spreadsheetId=SHEET_ID, range=RANGE
    ).execute().get("values", [])
    if not values: return []
    headers, data = values[0], values[1:]
    # pad short rows
    return [dict(zip(headers, r + [""]*(len(headers)-len(r)))) for r in data]

def _aggregate(rows):
    # TODO: expand to your full contract
    today = datetime.now(timezone.utc).date().isoformat()
    counts_today = sum(1 for r in rows if r.get("Report_Date") == today)
    by_sev = {}
    for r in rows:
        s = r.get("Severity_Code","UNKNOWN")
        by_sev[s] = by_sev.get(s,0)+1
    return {
        "schema_version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "stale": False,
        "counts": {"today": counts_today},
        "by_severity": [{"severity":k,"n":v} for k,v in sorted(by_sev.items())],
        "by_unit": [],
        "timeline": []
    }

def _cors(resp):
    origin = request.headers.get("Origin", "")
    allowed = os.environ.get("CORS_ORIGIN", "")
    if allowed and origin == allowed:
        resp.headers["Access-Control-Allow-Origin"] = allowed
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Methods"] = "GET"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
    return resp

@app.get("/api/incidents.json")
def incidents():
    rows = _get_rows()
    payload = _aggregate(rows)
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    etag = hashlib.sha256(body).hexdigest()
    resp = make_response(body)
    resp.headers["Content-Type"] = "application/json; charset=utf-8"
    resp.headers["Cache-Control"] = "public, max-age=60"
    resp.headers["ETag"] = etag
    return _cors(resp)

@app.get("/healthz")
def health():
    return "ok", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
