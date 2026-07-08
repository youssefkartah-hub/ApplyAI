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
           "token.json", ".sync_state.json", "personal_data.json", "token_calendar.json"}
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


# --------------------------------------------------------------------------
# Goal Intelligence: decompose a natural-language goal into phases + tasks.
# Uses Claude when ANTHROPIC_API_KEY is set; falls back to strategy templates.
# --------------------------------------------------------------------------
GOAL_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {"phases": {"type": "array", "items": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "name": {"type": "string"},
            "tasks": {"type": "array", "items": {
                "type": "object", "additionalProperties": False,
                "properties": {"title": {"type": "string"}, "daily": {"type": "boolean"},
                               "minutes": {"type": "integer"}, "importance": {"type": "integer"}},
                "required": ["title", "daily", "minutes", "importance"]}}},
        "required": ["name", "tasks"]}}},
    "required": ["phases"],
}
GOAL_PROMPT = (
    "You are a ruthless execution planner. Decompose the user's goal into 3-5 "
    "strategic phases in order, each with 2-5 small executable tasks. Mark a task "
    "daily:true only if it should repeat every day (habits like 'apply to 2 roles' "
    "or '20 min practice'); phases should progress from setup to completion. "
    "minutes = realistic duration (15-120). importance = 1-3. Be concrete and "
    "specific to the goal; no filler."
)


def _tmpl(name, tasks):
    return {"name": name, "tasks": [
        {"title": t[0], "daily": t[1], "minutes": t[2], "importance": t[3]} for t in tasks]}


def goal_plan_fallback(goal):
    g = goal.lower()
    if any(w in g for w in ("intern", "job", "offer", "hired", "position", "role at", "work at")):
        phases = [
            _tmpl("Research & targeting", [("List 15 target companies/teams for this goal", False, 45, 3),
                                           ("Find 3 people to network with per target", False, 30, 2)]),
            _tmpl("Sharpen materials", [("Tailor resume to the target role", False, 60, 3),
                                        ("Write a reusable cover letter template", False, 45, 2)]),
            _tmpl("Apply & network daily", [("Apply to 2 relevant openings", True, 40, 3),
                                            ("Send 1 networking message or follow-up", True, 15, 2)]),
            _tmpl("Interview readiness", [("Prepare 5 STAR stories", False, 60, 3),
                                          ("Do 1 mock/technical practice session", True, 30, 2)]),
            _tmpl("Close it out", [("Follow up on every silent application weekly", False, 20, 2),
                                   ("Debrief after each interview and refine", False, 20, 2)]),
        ]
    elif "gpa" in g or "grade" in g:
        phases = [
            _tmpl("Assess the gap", [("Compute current GPA and required grades per course", False, 30, 3),
                                     ("Identify the 2 highest-leverage courses", False, 20, 3)]),
            _tmpl("Build the system", [("Create a weekly study schedule", False, 30, 2),
                                       ("Collect past exams / problem sets", False, 30, 2)]),
            _tmpl("Execute daily", [("2 focused study blocks (50 min)", True, 100, 3),
                                    ("Review lecture notes same day", True, 20, 2)]),
            _tmpl("Exam mastery", [("Full practice exam 1 week before each test", False, 120, 3),
                                   ("Office hours for weak topics", False, 45, 2)]),
        ]
    elif any(w in g for w in ("language", "french", "spanish", "german", "fluent", "arabic", "japanese")):
        phases = [
            _tmpl("Foundation", [("Pick one course/app and finish unit 1", False, 60, 3)]),
            _tmpl("Daily practice", [("20 min structured lesson", True, 20, 3),
                                     ("10 min speaking/shadowing", True, 10, 2)]),
            _tmpl("Immersion", [("Switch phone/media to the language", False, 15, 1),
                                ("1 conversation exchange per week", False, 45, 2)]),
            _tmpl("Prove it", [("Book a level test (A2/B1)", False, 20, 2)]),
        ]
    elif "interview" in g:
        phases = [
            _tmpl("Raise volume", [("Apply to 2 quality-matched roles", True, 40, 3)]),
            _tmpl("Raise quality", [("Tailor resume keywords per application", True, 15, 2),
                                    ("A/B test resume versions in the CRM tab", False, 20, 2)]),
            _tmpl("Multiply channels", [("1 recruiter/referral outreach", True, 15, 3),
                                        ("Weekly follow-up sweep on silent apps", False, 20, 2)]),
        ]
    else:
        phases = [
            _tmpl("Define success", [("Write the measurable outcome and deadline", False, 15, 3),
                                     ("Break it into 3 milestones", False, 20, 3)]),
            _tmpl("Plan the system", [("Design the smallest daily action", False, 15, 2)]),
            _tmpl("Execute daily", [("Do the daily action", True, 30, 3)]),
            _tmpl("Review & adapt", [("Weekly review: what worked, what to change", False, 20, 2)]),
        ]
    return {"phases": phases, "source": "template"}


def goal_plan(goal):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return goal_plan_fallback(goal)
    try:
        import anthropic
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model="claude-opus-4-8", max_tokens=2000,
            system=GOAL_PROMPT,
            messages=[{"role": "user", "content": f"Goal: {goal}"}],
            output_config={"format": {"type": "json_schema", "schema": GOAL_SCHEMA}},
        )
        text = next(b.text for b in resp.content if getattr(b, "type", "") == "text")
        data = json.loads(text)
        data["source"] = "ai"
        return data
    except Exception:
        return goal_plan_fallback(goal)


CAL_TOKEN = os.path.join(DIRECTORY, "token_calendar.json")
CAL_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


def fetch_calendar():
    """Read today's + tomorrow's events from the user's primary Google Calendar."""
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        import datetime as dt
        creds = None
        if os.path.exists(CAL_TOKEN):
            creds = Credentials.from_authorized_user_file(CAL_TOKEN, CAL_SCOPES)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(os.path.join(DIRECTORY, "credentials.json")):
                    return {"error": "no_creds"}
                flow = InstalledAppFlow.from_client_secrets_file(
                    os.path.join(DIRECTORY, "credentials.json"), CAL_SCOPES)
                creds = flow.run_local_server(port=0)  # opens browser once
            with open(CAL_TOKEN, "w") as f:
                f.write(creds.to_json())
        svc = build("calendar", "v3", credentials=creds, cache_discovery=False)
        # Full current day (local) through tomorrow, so the daily sync catches
        # everything on today's schedule, not just upcoming events.
        now = dt.datetime.now().astimezone()
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + dt.timedelta(days=2)
        r = svc.events().list(calendarId="primary", timeMin=start.isoformat(),
                              timeMax=end.isoformat(), singleEvents=True,
                              orderBy="startTime", maxResults=40).execute()
        out = []
        for e in r.get("items", []):
            st = e.get("start", {})
            en = e.get("end", {})
            out.append({"id": e.get("id", ""),
                        "title": e.get("summary", "(no title)"),
                        "start": st.get("dateTime") or st.get("date", ""),
                        "end": en.get("dateTime") or en.get("date", ""),
                        "allday": "date" in st})
        return {"events": out}
    except Exception as e:
        return {"error": "cal", "message": str(e)[:150]}


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
        if path == "/api/calendar":
            self._send_json(fetch_calendar())
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
        path = self.path.split("?", 1)[0]
        if path == "/api/goal-plan":
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 10000:
                self.send_error(413, "Bad size")
                return
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                goal = str(body.get("goal", "")).strip()
                if not goal:
                    raise ValueError("empty goal")
            except Exception as e:
                self.send_error(400, f"Bad request: {e}")
                return
            self._send_json(goal_plan(goal))
            return
        # Persist the Personal OS data (tasks, habits, sessions, inbox, settings).
        if path != "/api/store":
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
