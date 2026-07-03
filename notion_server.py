#!/usr/bin/env python3
"""
Local viewer for your Notion "Job Application Tracker".

Your routine + Notion stay the brain (they keep the data updated in the cloud).
This little server is purely the *visuals*: it reads your Notion database with
your private integration token (which never leaves your Mac) and serves it to
the dashboard at http://localhost:8000/job-dashboard.html.

Setup (one time):
  1. Create a Notion integration: https://www.notion.so/my-integrations
     -> New integration -> Internal -> copy the "Internal Integration Secret"
     (starts with `ntn_` or `secret_`).
  2. Open your Job Application Tracker in Notion -> top-right "..." ->
     Connections -> add your integration (lets it read the database).
  3. Give this app the token, either:
       - put it in a file named  notion_token.txt  in this folder, OR
       - export NOTION_TOKEN=...  in your shell.

Run:
    python3 notion_server.py          # or just double-click start.command
"""
import http.server
import socketserver
import sys
import os
import json
import time
import webbrowser
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATABASE_ID = "77941b0b-e1e8-4b63-981c-cbc3fffc21b6"  # your Job Application Tracker
NOTION_VERSION = "2022-06-28"
CACHE_TTL = 20  # seconds; avoid hammering the Notion API on every poll

BLOCKED = {"notion_token.txt", "notion_config.json", "credentials.json",
           "token.json", ".sync_state.json", "personal_data.json"}
STORE_FILE = os.path.join(DIRECTORY, "personal_data.json")
MAX_STORE = 5_000_000  # 5 MB cap

_cache = {"at": 0, "data": None}


def load_token_and_db():
    token = os.environ.get("NOTION_TOKEN", "").strip()
    db = os.environ.get("NOTION_DATABASE_ID", "").strip()
    cfg = os.path.join(DIRECTORY, "notion_config.json")
    if os.path.exists(cfg):
        try:
            data = json.load(open(cfg))
            token = token or str(data.get("token", "")).strip()
            db = db or str(data.get("database_id", "")).strip()
        except Exception:
            pass
    tok_file = os.path.join(DIRECTORY, "notion_token.txt")
    if not token and os.path.exists(tok_file):
        token = open(tok_file).read().strip()
    return token, (db or DEFAULT_DATABASE_ID)


def _session():
    import requests
    s = requests.Session()
    return s


def _plain(parts):
    return "".join(p.get("plain_text", "") for p in (parts or [])).strip()


def _find_prop(props, *needles, kind=None):
    for name, val in props.items():
        if kind and val.get("type") != kind:
            continue
        low = name.lower()
        if any(n in low for n in needles):
            return val
    return None


def normalize(page):
    props = page.get("properties", {})
    # company = the title property (whatever it's named)
    title_prop = next((v for v in props.values() if v.get("type") == "title"), None)
    company = _plain(title_prop.get("title")) if title_prop else ""
    position = _find_prop(props, "position", "role", kind="rich_text")
    notes = _find_prop(props, "note", kind="rich_text")
    status = _find_prop(props, "status", kind="select") or _find_prop(props, "status", kind="status")
    country = _find_prop(props, "country", "region", kind="select")
    appdate = _find_prop(props, "application date", "applied", "date", kind="date")

    def sel(p):
        if not p:
            return ""
        v = p.get("select") or p.get("status") or {}
        return (v or {}).get("name", "") if isinstance(v, dict) else ""

    date_val = ""
    if appdate and appdate.get("date"):
        date_val = (appdate["date"] or {}).get("start", "") or ""

    return {
        "company": company or "Unknown",
        "position": _plain(position.get("rich_text")) if position else "",
        "location": "",
        "country": sel(country),
        "status": sel(status),
        "note": _plain(notes.get("rich_text")) if notes else "",
        "date": date_val or page.get("last_edited_time", "")[:10],
        "updated": page.get("last_edited_time", ""),
    }


def fetch_applications():
    now = time.time()
    if _cache["data"] is not None and now - _cache["at"] < CACHE_TTL:
        return {"applications": _cache["data"]}

    token, db = load_token_and_db()
    if not token:
        return {"error": "no_token"}

    try:
        s = _session()
    except Exception:
        return {"error": "deps", "message": "The 'requests' package is missing. Run: pip3 install requests"}

    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    url = f"https://api.notion.com/v1/databases/{db}/query"
    results, cursor = [], None
    try:
        while True:
            body = {"page_size": 100}
            if cursor:
                body["start_cursor"] = cursor
            r = s.post(url, headers=headers, json=body, timeout=25)
            if r.status_code in (401, 403):
                return {"error": "auth",
                        "message": "Notion rejected the request — check that the token is correct AND that you added the integration to the tracker (••• → Connections)."}
            if r.status_code == 404:
                return {"error": "not_shared",
                        "message": "Notion returned 404 — open the tracker in Notion, '...' menu -> Connections -> add your integration so it can read this database."}
            r.raise_for_status()
            data = r.json()
            results.extend(data.get("results", []))
            if data.get("has_more"):
                cursor = data.get("next_cursor")
            else:
                break
    except Exception as e:
        return {"error": "fetch", "message": str(e)[:200]}

    apps = [normalize(p) for p in results]
    _cache["data"], _cache["at"] = apps, now
    return {"applications": apps}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def _send_json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/applications":
            self._send_json(fetch_applications())
            return
        if path == "/api/store":
            try:
                with open(STORE_FILE) as f:
                    self._send_json(json.load(f))
            except Exception:
                self._send_json({})
            return
        if os.path.basename(path).lower() in BLOCKED:
            self.send_error(404, "Not found")
            return
        super().do_GET()

    def do_POST(self):
        # Persist the Personal OS data (tasks, habits, sessions, inbox, settings).
        if self.path.split("?", 1)[0] != "/api/store":
            self.send_error(404, "Not found")
            return
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_STORE:
            self.send_error(413, "Bad size")
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("expected object")
            tmp = STORE_FILE + ".tmp"
            with open(tmp, "w") as f:
                json.dump(payload, f, ensure_ascii=False)
            os.replace(tmp, STORE_FILE)
        except Exception as e:
            self.send_error(400, f"Bad request: {e}")
            return
        self._send_json({"ok": True})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    token, db = load_token_and_db()
    url = f"http://localhost:{PORT}/job-dashboard.html"
    try:
        httpd = socketserver.TCPServer(("", PORT), Handler)
    except OSError as e:
        print(f"Could not start on port {PORT}: {e}\nTry: python3 notion_server.py {PORT + 1}")
        sys.exit(1)
    with httpd:
        print("Job Dashboard (Notion-powered) is running:")
        print(f"    {url}\n")
        if token:
            print("Notion token: found. Reading your live tracker.")
        else:
            print("Notion token: NOT set yet — the dashboard will show setup steps.")
            print("Add notion_token.txt (or export NOTION_TOKEN) and refresh.")
        print("\nKeep this window open while you use the dashboard. Ctrl+C to stop.")
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
