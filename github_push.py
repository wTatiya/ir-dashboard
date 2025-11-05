# src/scraper/github_push.py
# Purpose: Upload a file to GitHub via REST API. Idempotent with SHA check.
from __future__ import annotations
import base64, json, requests

def push_file(token: str, owner: str, repo: str, branch: str, repo_path: str, content_bytes: bytes, commit_message: str) -> str:
    api = f"https://api.github.com/repos/{owner}/{repo}/contents/{repo_path}"
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}
    r = requests.get(api, headers=headers, params={"ref": branch})
    sha = r.json().get("sha") if r.status_code == 200 else None
    payload = {
        "message": commit_message,
        "content": base64.b64encode(content_bytes).decode("utf-8"),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha
    resp = requests.put(api, headers=headers, data=json.dumps(payload))
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"GitHub push failed: {resp.status_code} {resp.text}")
    return resp.json()["content"]["html_url"]
