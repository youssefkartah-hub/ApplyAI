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
import re
import time
import webbrowser
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DATABASE_ID = "77941b0b-e1e8-4b63-981c-cbc3fffc21b6"  # your Job Application Tracker
NOTION_VERSION = "2022-06-28"
CACHE_TTL = 20  # seconds; avoid hammering the Notion API on every poll

BLOCKED = {"notion_token.txt", "notion_config.json", "credentials.json",
           "token.json", ".sync_state.json", "personal_data.json", "token_calendar.json",
           "elevenlabs_key.txt", "anthropic_key.txt"}
ANTHROPIC_KEY_FILE = os.path.join(DIRECTORY, "anthropic_key.txt")


def anthropic_key():
    k = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not k and os.path.exists(ANTHROPIC_KEY_FILE):
        k = open(ANTHROPIC_KEY_FILE).read().strip()
    return k
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
    key = anthropic_key()
    if not key:
        return goal_plan_fallback(goal)
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
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
_cal_lock = threading.Lock()


def fetch_calendar():
    """Read today's + tomorrow's events from all of the user's Google Calendars."""
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        import datetime as dt
        with _cal_lock:
            creds = None
            if os.path.exists(CAL_TOKEN):
                creds = Credentials.from_authorized_user_file(CAL_TOKEN, CAL_SCOPES)
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    if not os.path.exists(os.path.join(DIRECTORY, "credentials.json")):
                        return {"error": "no_creds"}
                    print("\nGoogle Calendar needs a one-time approval — check your browser.")
                    flow = InstalledAppFlow.from_client_secrets_file(
                        os.path.join(DIRECTORY, "credentials.json"), CAL_SCOPES)
                    creds = flow.run_local_server(port=0)  # opens browser once
                    print("Calendar connected. ✓")
                with open(CAL_TOKEN, "w") as f:
                    f.write(creds.to_json())
        svc = build("calendar", "v3", credentials=creds, cache_discovery=False)
        # Full current day (local) through tomorrow, so the daily sync catches
        # everything on today's schedule, not just upcoming events.
        now = dt.datetime.now().astimezone()
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + dt.timedelta(days=2)
        # Read every calendar the account can see (gym schedules, shared and
        # secondary calendars), not just the primary one.
        cal_ids = ["primary"]
        try:
            cl = svc.calendarList().list(maxResults=50).execute()
            cal_ids = [c["id"] for c in cl.get("items", [])
                       if c.get("selected", True)] or ["primary"]
        except Exception:
            pass
        out, seen = [], set()
        for cid in cal_ids:
            try:
                r = svc.events().list(calendarId=cid, timeMin=start.isoformat(),
                                      timeMax=end.isoformat(), singleEvents=True,
                                      orderBy="startTime", maxResults=40).execute()
            except Exception:
                continue
            for e in r.get("items", []):
                eid = e.get("id", "")
                if not eid or eid in seen or e.get("status") == "cancelled":
                    continue
                seen.add(eid)
                st = e.get("start", {})
                en = e.get("end", {})
                out.append({"id": eid,
                            "title": e.get("summary", "(no title)"),
                            "start": st.get("dateTime") or st.get("date", ""),
                            "end": en.get("dateTime") or en.get("date", ""),
                            "allday": "date" in st})
        out.sort(key=lambda ev: (ev["allday"] and "0" or "1", ev["start"]))
        return {"events": out}
    except Exception as e:
        return {"error": "cal", "message": str(e)[:150]}


# Voice assistant brain: understands spoken updates and questions.
# Uses Claude when ANTHROPIC_API_KEY is set; the frontend handles simple
# phrases locally either way.
ASSIST_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "reply": {"type": "string"},
        "actions": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {
                "type": {"type": "string",
                         "enum": ["check_prayer", "check_training", "check_body", "check_mind",
                                  "log_income", "log_expense", "add_task",
                                  "complete_task", "none"]},
                "key": {"type": "string"},
                "amount": {"type": "number"},
                "title": {"type": "string"}},
            "required": ["type"]}}},
    "required": ["reply", "actions"],
}
ASSIST_PROMPT = (
    "You are Sarah, Youssef's AI executive assistant, living in his personal "
    "command center app. He is an aerospace engineering student running a job "
    "search, university, BJJ and Muay Thai training, prayer, language learning, "
    "and building income. Your character: an elite executive assistant. "
    "Professional, calm, confident, observant. Direct without being cold, never "
    "gushing, never robotic, no filler enthusiasm. You think ahead of him: when "
    "the data shows a pattern worth acting on, say so plainly, and when a "
    "decision looks wrong, challenge it once with your reasoning, then respect "
    "his call. Example of your register: 'You've postponed this task four times. "
    "I think the task itself is the problem, not your discipline.'\n\n"
    "This is an ongoing spoken conversation: he talks, you talk back. Your reply "
    "is read aloud by text to speech, so write natural speech with no lists, "
    "markdown, emojis or headings. Usually two to five sentences; go longer only "
    "when he asks for depth, advice or planning help.\n\n"
    "Each turn you receive a STATE snapshot of his day, including "
    "learnedPatterns: behavioral patterns the app has computed from weeks of his "
    "real data (productive hours, weak days, slipping prayers, stale tasks, "
    "income rhythms, training habits). STATE also carries trainingPlan: "
    "today's scheduled sessions from his weekly split (Mon Upper Body A plus "
    "Muay Thai, Tue Lower Body Strength plus BJJ, Wed Recovery and Mobility, "
    "Thu Upper Body B plus BJJ, Fri Muay Thai followed by Lower Body Power "
    "and Athletic Work, Sat and Sun rest), what he has already checked off "
    "today, his "
    "attendance percentages for the week and last 30 days, and any sessions "
    "he missed this week. Training is tracked purely by showing up, exactly "
    "like prayers: no set or weight logging. Encourage attendance, call out "
    "missed sessions plainly, and credit strong weeks. "
    "Treat all of this as your own observations and weave it in "
    "when relevant, but never recite lists. When he reports something done, "
    "acknowledge it briefly and emit matching actions: check_prayer with key "
    "fajr/dhuhr/asr/maghrib/isha, check_training with key "
    "bjj/muaythai/training/lift (lift covers his scheduled gym session), "
    "check_body with key creatine (his daily 5 g) or skincare (his nightly "
    "routine), check_mind with key lesson/immersion, log_income with amount, log_expense "
    "with amount plus key for the category (Food, Rent, Transport, Training, "
    "Subscriptions, School, Fun, Other) and title for what it was, add_task "
    "with title, complete_task with the task's title. STATE.finance carries "
    "month income, month spend, net worth and budget notes; use it when money "
    "comes up. Never invent progress he didn't mention, and never fake numbers "
    "not in STATE."
)


def assistant_reply(payload):
    key = anthropic_key()
    if not key:
        return {"error": "no_ai"}
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        msgs = []
        for h in (payload.get("history") or [])[-12:]:
            if h.get("role") in ("user", "assistant") and h.get("content"):
                msgs.append({"role": h["role"], "content": str(h["content"])[:2000]})
        msgs.append({"role": "user", "content":
                     f"STATE: {json.dumps(payload.get('state', {}))}\n"
                     f"Youssef said: {payload.get('text', '')}"})
        resp = client.messages.create(
            model="claude-sonnet-5", max_tokens=900,
            system=ASSIST_PROMPT, messages=msgs,
            output_config={"format": {"type": "json_schema", "schema": ASSIST_SCHEMA}},
        )
        text = next(b.text for b in resp.content if getattr(b, "type", "") == "text")
        return json.loads(text)
    except Exception as e:
        return {"error": "ai", "message": str(e)[:150]}


# ElevenLabs text to speech: natural voice for the daily rundown.
# Key comes from ELEVENLABS_API_KEY or a gitignored elevenlabs_key.txt.
ELEVEN_KEY_FILE = os.path.join(DIRECTORY, "elevenlabs_key.txt")
ELEVEN_VOICE_NAME = os.environ.get("ELEVEN_VOICE_NAME", "Elise")
ELEVEN_VOICE_ID = os.environ.get("ELEVEN_VOICE_ID", "EST9Ui6982FZPSi7gCHi")  # Elise
ELEVEN_FALLBACK_VOICE = "EXAVITQu4vr4xnSDxMaL"  # premade "Sarah" if Elise can't be found
_voice_cache = {"id": None, "at": 0}


def eleven_key():
    k = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not k and os.path.exists(ELEVEN_KEY_FILE):
        k = open(ELEVEN_KEY_FILE).read().strip()
    return k


def resolve_voice_id(s, key):
    """Find the configured voice by name in the account; if missing, pull it
    in from the ElevenLabs shared voice library automatically."""
    now = time.time()
    if _voice_cache["id"] and now - _voice_cache["at"] < 3600:
        return _voice_cache["id"]
    want = ELEVEN_VOICE_NAME.lower()
    try:
        r = s.get("https://api.elevenlabs.io/v1/voices",
                  headers={"xi-api-key": key}, timeout=15)
        for v in r.json().get("voices", []):
            if want in v.get("name", "").lower():
                _voice_cache.update(id=v["voice_id"], at=now)
                return v["voice_id"]
    except Exception:
        pass
    try:
        r = s.get("https://api.elevenlabs.io/v1/shared-voices",
                  params={"search": ELEVEN_VOICE_NAME, "page_size": 10},
                  headers={"xi-api-key": key}, timeout=15)
        vs = [v for v in r.json().get("voices", [])
              if v.get("name", "").lower().startswith(want)]
        vs.sort(key=lambda v: v.get("cloned_by_count", 0) or 0, reverse=True)
        if vs:
            v = vs[0]
            s.post(f"https://api.elevenlabs.io/v1/voices/add/{v['public_owner_id']}/{v['voice_id']}",
                   headers={"xi-api-key": key, "Content-Type": "application/json"},
                   json={"new_name": v.get("name", ELEVEN_VOICE_NAME)}, timeout=15)
            _voice_cache.update(id=v["voice_id"], at=now)
            return v["voice_id"]
    except Exception:
        pass
    return ELEVEN_FALLBACK_VOICE


def speak_text(text):
    """Returns (mp3_bytes, None) on success or (None, error_dict)."""
    key = eleven_key()
    if not key:
        return None, {"error": "no_key"}
    try:
        s = _session()

        def tts(voice):
            return s.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
                          headers={"xi-api-key": key, "Content-Type": "application/json"},
                          json={"text": text[:2500], "model_id": "eleven_multilingual_v2",
                                "voice_settings": {"stability": 0.45, "similarity_boost": 0.8,
                                                   "style": 0.25}},
                          timeout=30)

        r = tts(ELEVEN_VOICE_ID)
        if r.status_code == 401:
            return None, {"error": "auth", "message": "ElevenLabs rejected the key."}
        if not r.ok:
            # The pinned voice may not be in this account yet; resolve by name
            # (auto-adds from the shared library), then last-resort premade voice.
            r = tts(resolve_voice_id(s, key))
        if not r.ok:
            r = tts(ELEVEN_FALLBACK_VOICE)
        r.raise_for_status()
        return r.content, None
    except Exception as e:
        return None, {"error": "tts", "message": str(e)[:150]}


# --------------------------------------------------------------------------
# Knowledge base: documents live in ./knowledge (gitignored, never served).
# Text is extracted locally; questions retrieve the best excerpts locally and
# only those excerpts go to Claude when a key is configured.
# --------------------------------------------------------------------------
KB_DIR = os.path.join(DIRECTORY, "knowledge")
KB_INDEX = os.path.join(KB_DIR, "index.json")
KB_MAX_FILE = 25_000_000       # 25 MB per upload
KB_MAX_TEXT = 400_000          # chars of extracted text kept per doc
_kb_lock = threading.Lock()


def kb_load():
    try:
        with open(KB_INDEX) as f:
            return json.load(f)
    except Exception:
        return []


def kb_save(idx):
    os.makedirs(KB_DIR, exist_ok=True)
    tmp = KB_INDEX + ".tmp"
    with open(tmp, "w") as f:
        json.dump(idx, f)
    os.replace(tmp, KB_INDEX)


def kb_extract(name, raw):
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    try:
        if ext in ("txt", "md", "csv", "json", "py", "tex", "html"):
            return raw.decode("utf-8", "ignore")
        if ext == "docx":
            import zipfile, io, re as _re
            from html import unescape
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                xml = z.read("word/document.xml").decode("utf-8", "ignore")
            xml = xml.replace("</w:p>", "\n")
            return unescape(_re.sub(r"<[^>]+>", " ", xml))
        if ext == "pdf":
            try:
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(raw))
                return "\n".join((p.extract_text() or "") for p in reader.pages)
            except ImportError:
                return ""  # pip3 install pypdf enables PDF text
    except Exception:
        pass
    return ""


def kb_upload(payload):
    import base64, uuid
    name = os.path.basename(str(payload.get("name", "file"))).strip() or "file"
    try:
        raw = base64.b64decode(payload.get("data", ""))
    except Exception:
        return {"error": "bad_data"}
    if not raw or len(raw) > KB_MAX_FILE:
        return {"error": "too_big", "message": "Files up to 25 MB."}
    doc_id = uuid.uuid4().hex[:12]
    os.makedirs(KB_DIR, exist_ok=True)
    with open(os.path.join(KB_DIR, f"{doc_id}_{name}"), "wb") as f:
        f.write(raw)
    text = kb_extract(name, raw)[:KB_MAX_TEXT]
    with open(os.path.join(KB_DIR, f"{doc_id}.txt"), "w", encoding="utf-8") as f:
        f.write(text)
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    with _kb_lock:
        idx = kb_load()
        entry = {"id": doc_id, "name": name, "size": len(raw), "kind": ext,
                 "chars": len(text), "added": time.strftime("%Y-%m-%d")}
        idx.append(entry)
        kb_save(idx)
    note = None
    if ext == "pdf" and not text:
        note = "Stored, but no text could be extracted. Run: pip3 install pypdf, then re-upload."
    elif not text and ext not in ("png", "jpg", "jpeg", "gif", "webp"):
        note = "Stored, but no searchable text found in this file type."
    return {"ok": True, "doc": entry, "note": note}


def kb_delete(doc_id):
    with _kb_lock:
        idx = kb_load()
        keep = [d for d in idx if d["id"] != doc_id]
        kb_save(keep)
    for fn in os.listdir(KB_DIR) if os.path.isdir(KB_DIR) else []:
        if fn.startswith(doc_id):
            try:
                os.remove(os.path.join(KB_DIR, fn))
            except Exception:
                pass
    return {"ok": True}


def kb_chunks(question, top_n=8):
    terms = [t for t in "".join(c if c.isalnum() else " " for c in question.lower()).split()
             if len(t) >= 3]
    if not terms:
        return []
    scored = []
    for d in kb_load():
        try:
            with open(os.path.join(KB_DIR, f"{d['id']}.txt"), encoding="utf-8") as f:
                text = f.read()
        except Exception:
            continue
        step = 1500
        for i in range(0, max(1, len(text)), step):
            chunk = text[i:i + step + 200]
            low = chunk.lower()
            score = sum(low.count(t) for t in terms)
            # small bonus if the doc name itself matches the question
            score += 2 * sum(1 for t in terms if t in d["name"].lower())
            if score > 0:
                scored.append((score, d["name"], chunk.strip()))
    scored.sort(key=lambda x: -x[0])
    return scored[:top_n]


KB_PROMPT = (
    "You are Sarah, answering a question from Youssef's personal document "
    "library. You get excerpts retrieved from his files. Answer from the "
    "excerpts only, plainly and briefly, and name which document the answer "
    "came from. If the excerpts don't contain the answer, say so directly. "
    "The reply may be read aloud, so no lists or markdown."
)


def kb_ask(payload):
    q = str(payload.get("question", "")).strip()
    if not q:
        return {"error": "empty"}
    chunks = kb_chunks(q)
    if not chunks:
        return {"answer": None, "snippets": [],
                "message": "Nothing in the library matches that. Upload the document first."}
    key = anthropic_key()
    if not key:
        return {"answer": None,
                "snippets": [{"doc": n, "text": c[:600]} for _, n, c in chunks[:4]]}
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        ctx = "\n\n".join(f"[from: {n}]\n{c}" for _, n, c in chunks)
        resp = client.messages.create(
            model="claude-sonnet-5", max_tokens=700, system=KB_PROMPT,
            messages=[{"role": "user", "content": f"EXCERPTS:\n{ctx}\n\nQUESTION: {q}"}])
        text = next((b.text for b in resp.content if getattr(b, "type", "") == "text"), "")
        return {"answer": text, "sources": sorted({n for _, n, _ in chunks})}
    except Exception as e:
        return {"answer": None,
                "snippets": [{"doc": n, "text": c[:600]} for _, n, c in chunks[:4]],
                "message": str(e)[:120]}


# ==================================================================
# Resume Match Analyzer.
# One resume is stored (replaceable). Job descriptions and analyses are
# never written to disk: they live in the request and the open page only.
# ==================================================================
RESUME_DIR = os.path.join(DIRECTORY, "resume")
RESUME_META = os.path.join(RESUME_DIR, "meta.json")
RESUME_MAX = 10_000_000        # 10 MB
RESUME_MAX_TEXT = 60_000       # chars of resume text sent to the model
JD_MAX_TEXT = 30_000
_resume_lock = threading.Lock()


def resume_meta():
    try:
        with open(RESUME_META) as f:
            return json.load(f)
    except Exception:
        return None


def resume_text():
    m = resume_meta()
    if not m:
        return ""
    try:
        with open(os.path.join(RESUME_DIR, "resume.txt"), encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def resume_upload(payload):
    import base64
    name = os.path.basename(str(payload.get("name", "resume"))).strip() or "resume"
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    if ext not in ("pdf", "docx", "doc", "txt", "md"):
        return {"error": "bad_type", "message": "Upload a PDF or DOCX resume."}
    try:
        raw = base64.b64decode(payload.get("data", ""))
    except Exception:
        return {"error": "bad_data", "message": "That file could not be read."}
    if not raw:
        return {"error": "empty", "message": "That file is empty."}
    if len(raw) > RESUME_MAX:
        return {"error": "too_big", "message": "Resumes up to 10 MB."}
    text = kb_extract(name, raw)[:RESUME_MAX_TEXT].strip()
    with _resume_lock:
        os.makedirs(RESUME_DIR, exist_ok=True)
        # only one resume is ever kept: clear the old file first
        for fn in os.listdir(RESUME_DIR):
            if fn.startswith("resume."):
                try:
                    os.remove(os.path.join(RESUME_DIR, fn))
                except Exception:
                    pass
        with open(os.path.join(RESUME_DIR, f"resume.{ext}"), "wb") as f:
            f.write(raw)
        with open(os.path.join(RESUME_DIR, "resume.txt"), "w", encoding="utf-8") as f:
            f.write(text)
        meta = {"name": name, "kind": ext, "size": len(raw), "chars": len(text),
                "added": time.strftime("%Y-%m-%d %H:%M")}
        tmp = RESUME_META + ".tmp"
        with open(tmp, "w") as f:
            json.dump(meta, f)
        os.replace(tmp, RESUME_META)
    note = None
    if not text:
        note = ("Stored, but no text could be read from it. For PDFs run: "
                "pip3 install pypdf, then upload again.") if ext == "pdf" else \
               "Stored, but no readable text was found in that file."
    return {"ok": True, "resume": meta, "note": note}


def resume_delete():
    with _resume_lock:
        for fn in (os.listdir(RESUME_DIR) if os.path.isdir(RESUME_DIR) else []):
            try:
                os.remove(os.path.join(RESUME_DIR, fn))
            except Exception:
                pass
    return {"ok": True}


# ---- Local analyzer: no API key, no network, no cost. -------------
# Rules and keyword matching rather than judgement: it reads the posting
# for stated requirements, checks them against the resume, and scores the
# overlap. Honest about what it cannot know.
SKILLS = {
    "software": {
        "Python": ["python"], "MATLAB": ["matlab"], "Simulink": ["simulink"],
        "C++": [r"c\+\+"], "C#": [r"c#"], "Java": ["java"], "JavaScript": ["javascript", "js"],
        "SQL": ["sql"], "R": [r"\br\b"], "LabVIEW": ["labview"], "Git": ["git", "github", "version control"],
        "Linux": ["linux", "unix"], "Excel": ["excel", "spreadsheet"], "VBA": ["vba"],
        "SolidWorks": ["solidworks", "solid works"], "CATIA": ["catia"], "Siemens NX": [r"\bnx\b", "siemens nx", "unigraphics"],
        "Creo": ["creo", "pro/e", "proe"], "AutoCAD": ["autocad"], "Fusion 360": ["fusion 360"],
        "Inventor": ["autodesk inventor"], "ANSYS": ["ansys"], "ANSYS Fluent": ["fluent"],
        "Abaqus": ["abaqus"], "NASTRAN": ["nastran", "patran"], "COMSOL": ["comsol"],
        "Star-CCM+": [r"star-?ccm", "starccm"], "OpenFOAM": ["openfoam"], "Femap": ["femap"],
        "Altair HyperMesh": ["hypermesh", "hyperworks"], "Blender": ["blender"],
        "Tableau": ["tableau"], "Power BI": ["power bi", "powerbi"],
        "AWS": [r"\baws\b", "amazon web services"], "Docker": ["docker"], "MS Project": ["ms project", "microsoft project"],
        "Jira": ["jira"], "TensorFlow": ["tensorflow"], "PyTorch": ["pytorch"],
        "NumPy": ["numpy"], "Pandas": ["pandas"], "SciPy": ["scipy"],
    },
    "skill": {
        "CFD": ["cfd", "computational fluid dynamics"],
        "FEA": ["fea", "finite element", "finite element analysis"],
        "CAD": [r"\bcad\b", "computer aided design", "computer-aided design"],
        "GD&T": [r"gd&t", "geometric dimensioning"],
        "DFM": ["design for manufactur", r"\bdfm\b"],
        "Thermodynamics": ["thermodynamic"], "Heat Transfer": ["heat transfer"],
        "Fluid Mechanics": ["fluid mechanic", "fluid dynamics"],
        "Aerodynamics": ["aerodynamic"], "Propulsion": ["propulsion", "rocket engine", "jet engine"],
        "Structural Analysis": ["structural analysis", "structural design", "stress analysis",
                                "structural simulation", "structural", "load case"],
        "Composites": ["composite", "layup", "laminate"],
        "Controls": ["control system", "control theory", "guidance", "gnc"],
        "Orbital Mechanics": ["orbital mechanic", "astrodynamic"],
        "Machining": ["machining", "cnc", "lathe", "mill"],
        "3D Printing": ["3d print", "additive manufactur"],
        "Welding": ["welding", "brazing"],
        "Testing": ["test campaign", "hot fire", "wind tunnel", "static fire", "test stand"],
        "Data Analysis": ["data analysis", "data reduction", "data analytics",
                          "post processing", "postprocessing", "reduced the data"],
        "Machine Learning": ["machine learning", "deep learning", "neural network"],
        "Systems Engineering": ["systems engineering", "requirements management"],
        "Project Management": ["project management", "scrum", "agile"],
        "Technical Writing": ["technical writing", "documentation", "technical report"],
        "Root Cause Analysis": ["root cause", "failure analysis", "fmea"],
        "Tolerance Analysis": ["tolerance analysis", "tolerance stack"],
        "Instrumentation": ["instrument", "sensor", "data acquisition", "daq"],
        "Simulation": ["simulation", "modeling and simulation"],
        "Manufacturing": ["manufacturing", "production", "assembly"],
        "Quality": ["quality assurance", "quality control", "as9100", "iso 9001"],
        "Leadership": ["lead a team", "leadership", "mentor", "team lead"],
        "Communication": ["communication skills", "present findings", "cross-functional"],
    },
}
STOP = set("""a an and are as at be but by for from has have how in into is it its of on or that the their there these this to was were what when where which who will with your you our we us they them than then so such can may might must should would could each other both all any more most some only own same too very just also about above after again against because been before being below between during few further here having he she his her him do does did doing down out off over under once no not nor own s t don now able across upon within without per via etc ability strong excellent good work working works job role position candidate applicant experience experienced years year including include includes required require requires requirement requirements preferred prefer qualifications skills knowledge understanding familiar familiarity proficiency proficient demonstrated ideal plus must-have nice-to-have responsibilities duties team teams company opportunity opportunities employment employee employer applicants candidates apply application""".split())


def _txt(s):
    return re.sub(r"\s+", " ", (s or "").lower())


def _find(text, aliases):
    for a in aliases:
        if a.startswith(("\\", "(", "[")) or "\\" in a:   # already a pattern
            try:
                if re.search(a, text):
                    return True
            except re.error:
                pass
            continue
        # single words match their inflections: "instrument" also finds "instrumented"
        pat = r"\b" + re.escape(a) + (r"\w*" if (len(a) >= 5 and " " not in a) else r"\b")
        if re.search(pat, text):
            return True
    return False


# using a tool proves the discipline, even when the resume never names it
IMPLIES = {
    "CAD": ["SolidWorks", "CATIA", "Siemens NX", "Creo", "AutoCAD", "Fusion 360", "Inventor"],
    "CFD": ["ANSYS Fluent", "Star-CCM+", "OpenFOAM"],
    "FEA": ["Abaqus", "NASTRAN", "Femap", "Altair HyperMesh"],
    "Simulation": ["ANSYS", "Abaqus", "COMSOL", "Simulink", "OpenFOAM"],
    "Data Analysis": ["Pandas", "NumPy", "SciPy", "Tableau", "Power BI"],
    "Machine Learning": ["TensorFlow", "PyTorch"],
}


def _skills_in(text):
    found = {"software": set(), "skill": set()}
    for kind, table in SKILLS.items():
        for name, aliases in table.items():
            if _find(text, aliases):
                found[kind].add(name)
    for discipline, tools in IMPLIES.items():
        if discipline not in found["skill"] and any(t in found["software"] for t in tools):
            found["skill"].add(discipline)
    return found


def _terms(text, top=40):
    """Significant single words and two-word phrases in the posting."""
    words = [w.strip(".,;:()/-") for w in re.findall(r"[a-z][a-z0-9+#/.-]{2,}", text)]
    words = [w for w in words if w and w not in STOP and len(w) > 2 and not w.endswith(".")]
    counts = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    for i in range(len(words) - 1):
        bg = f"{words[i]} {words[i+1]}"
        counts[bg] = counts.get(bg, 0) + 1.6      # phrases carry more meaning
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return [t for t, c in ranked if c >= 2][:top]


def _req_lines(jd_raw):
    """Requirement-looking lines from the posting."""
    out = []
    for ln in re.split(r"[\n\r]+|(?<=[.;])\s{2,}", jd_raw):
        s = ln.strip(" \t•-–*·●o")
        if not (18 <= len(s) <= 200):
            continue
        low = s.lower()
        if re.search(r"experience (with|in)|ability to|knowledge of|proficien|familiar|"
                     r"degree in|pursuing|coursework|background in|skills? in|"
                     r"understanding of|demonstrated|required|must have|hands.on", low):
            out.append(s)
    seen, uniq = set(), []
    for s in out:
        k = s.lower()[:60]
        if k not in seen:
            seen.add(k)
            uniq.append(s)
    return uniq[:7]


def _best_resume_line(req, resume_raw):
    """Which resume line best answers this requirement, and how strongly."""
    rt = [w for w in re.findall(r"[a-z][a-z0-9+#/.-]{2,}", req.lower()) if w not in STOP]
    if not rt:
        return None, 0.0
    best, score = None, 0.0
    for ln in re.split(r"[\n\r]+", resume_raw):
        s = ln.strip(" \t•-–*·●")
        if len(s) < 15:
            continue
        lw = set(re.findall(r"[a-z][a-z0-9+#/.-]{2,}", s.lower()))
        hit = sum(1 for w in set(rt) if w in lw)
        sc = hit / max(1, len(set(rt)))
        if sc > score:
            best, score = s, sc
    return best, score


def _gpa(text):
    m = re.search(r"gpa[^0-9]{0,15}(\d\.\d{1,2})", text) or re.search(r"(\d\.\d{1,2})\s*/\s*4\.0", text)
    return float(m.group(1)) if m else None


def local_analyze(resume_raw, jd_raw):
    r, j = _txt(resume_raw), _txt(jd_raw)
    rs, js = _skills_in(r), _skills_in(j)
    want_sw, want_sk = js["software"], js["skill"]
    have_sw, have_sk = rs["software"], rs["skill"]
    strong = sorted((want_sw & have_sw) | (want_sk & have_sk))
    missing = sorted((want_sw - have_sw) | (want_sk - have_sk))
    extra = sorted((have_sw | have_sk) - (want_sw | want_sk))[:8]

    # ---- eligibility, read straight from the posting's own words ----
    eli, flags = [], []
    def add(status, item, detail):
        eli.append({"status": status, "item": item, "detail": detail})

    jd_gpa, r_gpa = _gpa(j), _gpa(r)
    if jd_gpa:
        if r_gpa is None:
            add("concern", "GPA requirement",
                f"The posting asks for a {jd_gpa} GPA. No GPA was found on your resume, so add it if it clears the bar.")
        elif r_gpa >= jd_gpa:
            add("match", "GPA requirement", f"Your {r_gpa} clears the {jd_gpa} minimum stated in the posting.")
        else:
            add("dealbreaker", "GPA requirement", f"The posting requires {jd_gpa}; your resume shows {r_gpa}.")
            flags.append(f"Minimum GPA of {jd_gpa} stated, above the {r_gpa} on your resume.")
    else:
        add("match", "GPA requirement", "No GPA requirement stated in the posting.")

    if re.search(r"u\.?s\.? citizen|citizenship (is )?required|must be a citizen", j):
        add("dealbreaker", "Citizenship", "The posting states U.S. citizenship is required.")
        flags.append("Requires U.S. citizenship.")
    if re.search(r"security clearance|secret clearance|ts/sci|dod clearance", j):
        add("dealbreaker" if re.search(r"active .{0,20}clearance|clearance (is )?required", j) else "concern",
            "Security clearance", "The posting mentions a security clearance.")
        flags.append("Security clearance required or expected.")
    if re.search(r"(not|unable to|cannot|will not|do not) .{0,20}sponsor|no sponsorship|without sponsorship", j):
        add("dealbreaker", "Visa sponsorship", "The posting states sponsorship is not available.")
        flags.append("No visa sponsorship available.")
    elif re.search(r"sponsor", j):
        add("match", "Visa sponsorship", "The posting mentions sponsorship, so it appears to be available.")
    else:
        add("concern", "Visa sponsorship",
            "Sponsorship is not mentioned either way. Confirm before you spend time on this one.")

    if re.search(r"authorized to work|work authorization", j):
        add("concern", "Work authorization", "The posting asks for existing work authorization. Check that you qualify.")
    for deg, label in ((r"ph\.?d|doctorate", "PhD"), (r"master'?s|\bm\.?s\.?\b", "Master's"),
                       (r"bachelor'?s|\bb\.?s\.?\b|undergraduate", "Bachelor's")):
        if re.search(deg, j):
            have = bool(re.search(deg, r)) or (label == "Bachelor's" and re.search(r"bachelor|b\.?s\.?|university|college", r))
            if label in ("PhD", "Master's") and re.search(r"preferred|a plus|nice to have", j):
                add("concern", f"{label} preferred", f"A {label} is preferred but not required.")
                flags.append(f"{label} preferred.")
            else:
                add("match" if have else "concern", f"{label} degree",
                    f"The posting asks for a {label}." + ("" if have else " Your resume does not clearly show one."))
            break
    yrs = re.search(r"(\d+)\+?\s*(?:-\s*\d+\s*)?years?(?: of)?(?: relevant| related| professional)? experience", j)
    if yrs:
        n = int(yrs.group(1))
        if n >= 3:
            add("concern", "Years of experience",
                f"The posting asks for {n}+ years of experience, which is a stretch for a student profile.")
            flags.append(f"{n}+ years of experience requested.")
        else:
            add("match", "Years of experience", f"{n} year(s) of experience requested, which is realistic.")
    for pat, msg in ((r"(\d{1,2})\s?%\s?travel|travel up to", "Travel is expected in this role."),
                     (r"weekend|nights and weekends|shift work", "Weekend or shift work mentioned."),
                     (r"on-?site|in office|relocat", "On-site or relocation expectations."),
                     (r"unpaid", "The posting mentions an unpaid arrangement.")):
        if re.search(pat, j):
            flags.append(msg)

    dealbreakers = [e for e in eli if e["status"] == "dealbreaker"]
    concerns = [e for e in eli if e["status"] == "concern"]

    # ---- ATS keywords ----
    terms = _terms(j)
    matched_kw = [t for t in terms if _find(r, [t])]
    missing_kw = [t for t in terms if t not in matched_kw][:12]
    ats_cov = len(matched_kw) / max(1, len(terms))

    rewrites = []
    for generic, better in (("simulation", "Finite Element Analysis (FEA)"), ("modeling", "CAD modeling"),
                            ("testing", "test campaign execution"), ("analysis", "structural analysis"),
                            ("programming", "Python scripting"), ("designed", "designed and validated")):
        if generic in r and any(generic in m for m in missing_kw + list(missing)):
            continue
    for m in list(missing)[:4]:
        rewrites.append({"current": f"(not currently on your resume) {m}",
                         "suggested": f"Name {m} explicitly if you have genuinely used it"})
    for kw in missing_kw[:3]:
        rewrites.append({"current": f"(missing keyword) {kw}",
                         "suggested": f"Work the exact phrase \"{kw}\" into a bullet where it is true"})

    # ---- experience, requirement by requirement ----
    experience = []
    reqs = _req_lines(jd_raw)
    xp_scores = []
    for req in reqs:
        line, sc = _best_resume_line(req, resume_raw)
        xp_scores.append(sc)
        strength = ("Excellent Match" if sc >= .5 else "Good Match" if sc >= .32
                    else "Partial Match" if sc >= .16 else "No Match")
        experience.append({"jobWants": req[:160],
                           "resumeMatch": (line[:160] if line and sc >= .16 else "Nothing on your resume clearly answers this"),
                           "strength": strength})
    xp_ratio = (sum(xp_scores) / len(xp_scores)) if xp_scores else 0.0

    # ---- scores ----
    sk_ratio = (len(strong) / max(1, len(want_sw | want_sk))) if (want_sw | want_sk) else 0.6
    sw_ratio = (len(want_sw & have_sw) / max(1, len(want_sw))) if want_sw else 0.7
    eli_score = max(0, 25 - 12 * len(dealbreakers) - 2 * len(concerns))
    proj_ratio = 0.75 if re.search(r"project", r) else 0.4
    scores = [
        ("Eligibility", eli_score, 25,
         "Read from the requirements stated in the posting."),
        ("Skills Match", round(20 * sk_ratio), 20,
         f"{len(strong)} of {len(want_sw | want_sk) or '—'} named skills appear on your resume."),
        ("Experience Match", round(15 * min(1, xp_ratio * 2.2)), 15,
         f"{sum(1 for s in xp_scores if s >= .32)} of {len(reqs) or 0} stated requirements have a clear answer."),
        ("Software Match", round(10 * sw_ratio), 10,
         f"{len(want_sw & have_sw)} of {len(want_sw) or '—'} tools named in the posting are on your resume."),
        ("Project Match", round(10 * min(1, proj_ratio + sk_ratio * .3)), 10,
         "Based on your project section and its overlap with the posting."),
        ("ATS Keyword Match", round(10 * ats_cov), 10,
         f"{len(matched_kw)} of {len(terms)} frequent terms from the posting appear on your resume."),
        ("Career Value", 3, 5, "Not assessable without knowing the company. Judge this one yourself."),
        ("Interview Probability", 0, 5, ""),
    ]
    base = sum(s for _, s, _, _ in scores[:6])
    ip = 4 if (base >= 60 and not dealbreakers) else 3 if base >= 45 else 2 if base >= 30 else 1
    scores[7] = ("Interview Probability", ip, 5, "Estimated from how much of the posting your resume already answers.")
    total = sum(s for _, s, _, _ in scores)
    if dealbreakers:
        total = min(total, 45)

    rec = "SKIP" if dealbreakers or total < 45 else "APPLY_NOW" if total >= 72 else "APPLY_IF_TIME"
    prob = "High" if ip >= 4 and not dealbreakers else "Medium" if ip == 3 else "Low"

    # ---- what tailoring could realistically recover ----
    recoverable = 0
    changes = []
    if missing_kw:
        gain = min(10 - round(10 * ats_cov), len(missing_kw))
        if gain > 0:
            recoverable += gain
            changes.append(f"Work these exact phrases from the posting into bullets where they are true: "
                           f"{', '.join(missing_kw[:6])} (+{gain} ATS points).")
    weak_reqs = [e for e in experience if e["strength"] in ("Partial Match", "No Match")]
    if weak_reqs:
        gain = min(5, len(weak_reqs) * 2)
        recoverable += gain
        changes.append(f"Add or sharpen a bullet for {len(weak_reqs)} requirement(s) the posting names that your "
                       f"resume does not clearly answer (+{gain} points).")
    if extra:
        changes.append(f"You list {', '.join(extra[:4])}, which this posting never asks for. "
                       "Cut or shrink those lines to make room for what it does ask for.")
    if concerns and not dealbreakers:
        changes.append("Confirm the unclear eligibility points above before investing time in this application.")
    if not changes:
        changes.append("Nothing obvious left to change for this posting.")
    after = min(97, total + recoverable) if not dealbreakers else total

    partial = [{"skill": s, "note": "The posting asks for this and a related term appears on your resume."}
               for s in sorted((want_sw | want_sk) - set(strong) - set(missing))][:6]

    v = "a strong fit" if rec == "APPLY_NOW" else "worth a look if you have time" if rec == "APPLY_IF_TIME" else "a poor fit"
    summary = (
        f"On a keyword and requirements basis this posting looks like {v}. "
        f"{len(strong)} of the {len(want_sw | want_sk)} skills it names appear on your resume"
        f"{', and ' + str(len(matched_kw)) + ' of its ' + str(len(terms)) + ' most frequent terms do too' if terms else ''}. "
        + (f"There {'is' if len(dealbreakers) == 1 else 'are'} {len(dealbreakers)} stated requirement"
           f"{'' if len(dealbreakers) == 1 else 's'} you do not appear to meet, which is why this is marked skip. "
           if dealbreakers else "")
        + (f"{len(concerns)} point{'s' if len(concerns) != 1 else ''} to verify before applying. " if concerns else "")
        + "This is a local analysis: it checks what the posting literally asks for against what your resume literally says."
    )

    return {
        "source": "local",
        "sourceNote": ("Local analysis: no API key used, nothing sent anywhere, no cost. It reads the "
                       "posting's stated requirements and keywords and checks them against your resume. "
                       "It cannot judge how good your experience is, weigh a company, or write anything."),
        "recommendation": rec, "overallScore": int(total), "summary": summary,
        "breakdown": [{"category": c, "score": int(s), "max": m, "note": n} for c, s, m, n in scores],
        "eligibility": eli,
        "skillsStrong": strong, "skillsPartial": partial, "skillsMissing": missing,
        "experience": experience,
        "atsMatched": matched_kw[:18], "atsMissing": missing_kw, "atsRewrites": rewrites[:6],
        "atsImprovement": (f"Keyword coverage is {round(100*ats_cov)}%. Adding the missing phrases where they are "
                           f"genuinely true would bring it close to {min(95, round(100*ats_cov)+25)}%."),
        "improvements": changes[:6],
        "redFlags": flags,
        "careerValue": [{"label": l, "rating": 3} for l in
                        ("Resume Value", "Learning Opportunity", "Networking", "Prestige",
                         "Future Career Impact", "Overall Career Value")],
        "careerValueNote": ("Career value needs judgement about the company and the team, which a local "
                            "keyword analysis cannot supply. These are neutral placeholders: rate this one yourself."),
        "interviewProbability": prob,
        "interviewExplanation": (
            f"Your resume already answers {sum(1 for s in xp_scores if s >= .32)} of the "
            f"{len(reqs)} requirements the posting states, and "
            + ("no stated requirement rules you out. " if not dealbreakers
               else "at least one stated requirement appears to rule you out. ")
            + "This is a rough estimate from overlap, not a prediction."),
        "applicationTime": "20-40 min" if rec != "SKIP" else "not recommended",
        "tailoringNeeded": "Heavy" if total < 60 else "Moderate" if total < 78 else "Light",
        "expectedReturn": "High" if rec == "APPLY_NOW" else "Medium" if rec == "APPLY_IF_TIME" else "Low",
        "effortRecommendation": (
            "Worth tailoring before you send it: the fit is there and the gap is mostly wording."
            if rec == "APPLY_NOW" else
            "Only worth it if your queue is empty; the gaps are real but closable."
            if rec == "APPLY_IF_TIME" else
            "Spend the time on a posting you actually qualify for."),
        "confidence": max(35, min(80, 40 + len(terms) + (10 if reqs else 0))),
        "confidenceNote": ("Confidence in a local analysis is capped: it matches words and stated rules, "
                           "and a longer, more specific posting gives it more to work with. "
                           "It never judges the quality of your experience."),
        "currentMatch": int(total), "matchAfterTailoring": int(after),
        "tailoringChanges": changes[:6],
        "jobTitle": "", "company": "",
    }


MATCH_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "recommendation": {"type": "string", "enum": ["APPLY_NOW", "APPLY_IF_TIME", "SKIP"]},
        "overallScore": {"type": "integer"},
        "summary": {"type": "string"},
        "breakdown": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"category": {"type": "string"}, "score": {"type": "number"},
                           "max": {"type": "number"}, "note": {"type": "string"}},
            "required": ["category", "score", "max", "note"]}},
        "eligibility": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"status": {"type": "string", "enum": ["match", "concern", "dealbreaker"]},
                           "item": {"type": "string"}, "detail": {"type": "string"}},
            "required": ["status", "item", "detail"]}},
        "skillsStrong": {"type": "array", "items": {"type": "string"}},
        "skillsPartial": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"skill": {"type": "string"}, "note": {"type": "string"}},
            "required": ["skill", "note"]}},
        "skillsMissing": {"type": "array", "items": {"type": "string"}},
        "experience": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"jobWants": {"type": "string"}, "resumeMatch": {"type": "string"},
                           "strength": {"type": "string",
                                        "enum": ["Excellent Match", "Good Match", "Partial Match", "No Match"]}},
            "required": ["jobWants", "resumeMatch", "strength"]}},
        "atsMatched": {"type": "array", "items": {"type": "string"}},
        "atsMissing": {"type": "array", "items": {"type": "string"}},
        "atsRewrites": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"current": {"type": "string"}, "suggested": {"type": "string"}},
            "required": ["current", "suggested"]}},
        "atsImprovement": {"type": "string"},
        "improvements": {"type": "array", "items": {"type": "string"}},
        "redFlags": {"type": "array", "items": {"type": "string"}},
        "careerValue": {"type": "array", "items": {
            "type": "object", "additionalProperties": False,
            "properties": {"label": {"type": "string"}, "rating": {"type": "integer"}},
            "required": ["label", "rating"]}},
        "careerValueNote": {"type": "string"},
        "interviewProbability": {"type": "string", "enum": ["High", "Medium", "Low"]},
        "interviewExplanation": {"type": "string"},
        "applicationTime": {"type": "string"},
        "tailoringNeeded": {"type": "string"},
        "expectedReturn": {"type": "string"},
        "effortRecommendation": {"type": "string"},
        "confidence": {"type": "integer"},
        "confidenceNote": {"type": "string"},
        "currentMatch": {"type": "integer"},
        "matchAfterTailoring": {"type": "integer"},
        "tailoringChanges": {"type": "array", "items": {"type": "string"}},
        "jobTitle": {"type": "string"},
        "company": {"type": "string"},
    },
    "required": ["recommendation", "overallScore", "summary", "breakdown", "eligibility",
                 "skillsStrong", "skillsPartial", "skillsMissing", "experience",
                 "atsMatched", "atsMissing", "atsRewrites", "atsImprovement",
                 "improvements", "redFlags", "careerValue", "careerValueNote",
                 "interviewProbability", "interviewExplanation", "applicationTime",
                 "tailoringNeeded", "expectedReturn", "effortRecommendation",
                 "confidence", "confidenceNote", "currentMatch", "matchAfterTailoring",
                 "tailoringChanges", "jobTitle", "company"],
}

MATCH_PROMPT = (
    "You are a seasoned technical recruiter and career coach reviewing one "
    "candidate's resume against one job description. Be specific, honest and "
    "useful: the candidate is deciding whether this application is worth their "
    "time, and how to improve it before submitting.\n\n"
    "Rules:\n"
    "- Ground every claim in the actual resume and job description text. Never "
    "invent experience, skills, schools or employers the resume does not show.\n"
    "- If the job description omits something (sponsorship, clearance, GPA), say "
    "it is unstated rather than assuming.\n"
    "- Scores must be consistent with the evidence and with each other; "
    "overallScore should reflect the breakdown, and breakdown scores must never "
    "exceed their max.\n"
    "- breakdown must contain exactly these eight categories, in this order, with "
    "these maxima: Eligibility (25), Skills Match (20), Experience Match (15), "
    "Software Match (10), Project Match (10), ATS Keyword Match (10), "
    "Career Value (5), Interview Probability (5).\n"
    "- careerValue must contain exactly these labels, each rated 1 to 5: "
    "Resume Value, Learning Opportunity, Networking, Prestige, Future Career "
    "Impact, Overall Career Value.\n"
    "- Recommendation: APPLY_NOW when it is a strong, eligible fit; "
    "APPLY_IF_TIME when it is plausible but needs real tailoring or has gaps; "
    "SKIP when a hard requirement rules the candidate out or the fit is poor.\n"
    "- Deal breakers are only hard, stated disqualifiers (for example citizenship "
    "or clearance the candidate cannot hold). Preferences are concerns, not deal "
    "breakers.\n"
    "- currentMatch should equal overallScore. matchAfterTailoring is the "
    "realistic score after the listed changes; never promise a perfect score, and "
    "tailoring cannot fix a hard eligibility deal breaker.\n"
    "- confidence reflects how complete and specific the job description is, not "
    "how good the candidate is.\n"
    "- Never guarantee an interview or an outcome.\n"
    "- Write in plain, direct prose. No markdown, no bullets inside string fields."
)


def resume_analyze(payload):
    rtext = resume_text()
    if not rtext:
        return {"error": "no_resume",
                "message": "Upload a resume first so there is something to compare."}
    jd = str(payload.get("jd", "")).strip()[:JD_MAX_TEXT]
    if len(jd) < 40:
        return {"error": "no_jd",
                "message": "Paste the full job description so the analysis has something to work with."}
    key = anthropic_key()
    # Local is the default and always works. AI only runs when asked for and paid for.
    if payload.get("mode") != "ai" or not key:
        out = local_analyze(rtext, jd)
        if payload.get("mode") == "ai" and not key:
            out["sourceNote"] = ("No Anthropic API key found, so this ran locally instead. "
                                 + out["sourceNote"])
        return out
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        resp = client.messages.create(
            model="claude-sonnet-5", max_tokens=6000, system=MATCH_PROMPT,
            messages=[{"role": "user", "content":
                       f"RESUME:\n{rtext}\n\n---\n\nJOB DESCRIPTION:\n{jd}"}],
            output_config={"format": {"type": "json_schema", "schema": MATCH_SCHEMA}},
        )
        text = next(b.text for b in resp.content if getattr(b, "type", "") == "text")
        out = json.loads(text)
        out["source"] = "ai"
        out["sourceNote"] = ("Reviewed by Claude against the full posting, so the reasoning weighs "
                             "your actual experience rather than only matching words.")
        return out
    except Exception as e:
        # a failed AI call should never cost you the analysis
        out = local_analyze(rtext, jd)
        out["sourceNote"] = f"The AI call failed ({str(e)[:90]}), so this ran locally. " + out["sourceNote"]
        return out


MATCH_ACTIONS = {
    "rewrite": ("Rewrite this candidate's resume for this specific job. Keep every "
                "fact true to the original resume: you may reorder, reword, "
                "re-emphasise and cut, but never invent experience. Return the "
                "full rewritten resume as clean plain text."),
    "cover": ("Write a cover letter for this candidate for this job. Specific, "
              "confident, no cliches, about 250 to 320 words, grounded only in "
              "the real resume. Plain text, ready to send."),
    "keywords": ("List the concrete keyword and phrasing edits that would raise "
                 "this resume's ATS score for this job. For each: the current "
                 "wording, the suggested wording, and where it appears. Plain text."),
    "outreach": ("Write a short LinkedIn or email outreach message from this "
                 "candidate to a recruiter or engineer at this company about this "
                 "role. Under 120 words, specific, not needy. Plain text."),
    "interview": ("Write the interview questions this candidate should expect for "
                  "this specific role, grouped into technical, behavioural and "
                  "role-specific. For the hardest few, add a one-line note on what "
                  "a strong answer covers, drawing on the candidate's real "
                  "experience. Plain text."),
    "explain": ("Explain this job description in plain language: what the team "
                "actually does, what the day to day looks like, what they are "
                "really screening for, and which requirements are hard versus "
                "soft. Plain text."),
}


def resume_action(payload):
    kind = str(payload.get("kind", ""))
    if kind not in MATCH_ACTIONS:
        return {"error": "bad_action"}
    rtext = resume_text()
    if not rtext:
        return {"error": "no_resume", "message": "Upload a resume first."}
    jd = str(payload.get("jd", "")).strip()[:JD_MAX_TEXT]
    if len(jd) < 40:
        return {"error": "no_jd", "message": "Paste the job description first."}
    key = anthropic_key()
    if not key:
        return {"error": "no_ai",
                "message": "This needs an Anthropic API key in anthropic_key.txt."}
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        resp = client.messages.create(
            model="claude-sonnet-5", max_tokens=3000,
            system=("You are a seasoned technical recruiter and career coach helping "
                    "one candidate with one specific job. Ground everything in the "
                    "real resume; never invent experience. " + MATCH_ACTIONS[kind]),
            messages=[{"role": "user", "content":
                       f"RESUME:\n{rtext}\n\n---\n\nJOB DESCRIPTION:\n{jd}"}])
        text = next((b.text for b in resp.content if getattr(b, "type", "") == "text"), "")
        return {"text": text}
    except Exception as e:
        return {"error": "ai", "message": str(e)[:200]}


_mkt_cache = {"at": 0, "data": None}


def fetch_markets():
    """BTC + SOL from CoinGecko, S&P 500 from Yahoo Finance. Cached 60s."""
    now = time.time()
    if _mkt_cache["data"] is not None and now - _mkt_cache["at"] < 60:
        return _mkt_cache["data"]
    try:
        s = _session()
    except Exception:
        return {"error": "deps", "message": "The 'requests' package is missing. Run: pip3 install requests"}

    def downsample(pts, n=40):
        pts = [p for p in pts if p is not None]
        if len(pts) <= n:
            return pts
        step = len(pts) / n
        return [pts[int(i * step)] for i in range(n)] + [pts[-1]]

    assets = []
    try:
        r = s.get("https://api.coingecko.com/api/v3/coins/markets",
                  params={"vs_currency": "usd", "ids": "bitcoin,solana",
                          "sparkline": "true", "price_change_percentage": "24h"},
                  timeout=15)
        r.raise_for_status()
        for c in r.json():
            assets.append({
                "symbol": "BTC" if c["id"] == "bitcoin" else "SOL",
                "name": "Bitcoin" if c["id"] == "bitcoin" else "Solana",
                "price": c.get("current_price"),
                "change": c.get("price_change_percentage_24h"),
                "spark": downsample((c.get("sparkline_in_7d") or {}).get("price") or []),
                "range": "7d",
            })
    except Exception:
        pass
    try:
        r = s.get("https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC",
                  params={"range": "1d", "interval": "5m"},
                  headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        r.raise_for_status()
        res = r.json()["chart"]["result"][0]
        meta = res.get("meta", {})
        closes = downsample(res["indicators"]["quote"][0].get("close") or [])
        price = meta.get("regularMarketPrice")
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
        change = (100 * (price - prev) / prev) if (price and prev) else None
        assets.append({"symbol": "S&P 500", "name": "S&P 500", "price": price,
                       "change": change, "spark": closes, "range": "1d"})
    except Exception:
        pass

    data = {"assets": assets} if assets else {"error": "markets",
            "message": "Couldn't reach the market data services."}
    if assets:
        _mkt_cache["data"], _mkt_cache["at"] = data, now
    return data


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
        if path == "/api/markets":
            self._send_json(fetch_markets())
            return
        if path == "/api/kb/list":
            self._send_json({"docs": kb_load()})
            return
        if path == "/api/resume":
            self._send_json({"resume": resume_meta(), "ai": bool(anthropic_key())})
            return
        if path == "/api/resume/file":
            # the one stored resume, streamed inline so the app can preview it
            m = resume_meta()
            fp = os.path.join(RESUME_DIR, f"resume.{m['kind']}") if m else None
            if not m or not fp or not os.path.exists(fp):
                self.send_error(404, "No resume stored")
                return
            ctype = {"pdf": "application/pdf",
                     "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                     "doc": "application/msword", "txt": "text/plain",
                     "md": "text/plain"}.get(m["kind"], "application/octet-stream")
            with open(fp, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Content-Disposition", f'inline; filename="{m["name"]}"')
            self.end_headers()
            self.wfile.write(data)
            return
        # private folders: never served as static files
        if path == "/knowledge" or path.startswith("/knowledge/"):
            self.send_error(404, "Not found")
            return
        if path == "/resume" or path.startswith("/resume/"):
            self.send_error(404, "Not found")
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
        if path in ("/api/kb/upload", "/api/kb/delete", "/api/kb/ask"):
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 40_000_000:
                self.send_error(413, "Bad size")
                return
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception as e:
                self.send_error(400, f"Bad request: {e}")
                return
            if path == "/api/kb/upload":
                self._send_json(kb_upload(payload))
            elif path == "/api/kb/delete":
                self._send_json(kb_delete(str(payload.get("id", ""))))
            else:
                self._send_json(kb_ask(payload))
            return
        if path.startswith("/api/resume/"):
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 20_000_000:
                self.send_error(413, "Bad size")
                return
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception as e:
                self.send_error(400, f"Bad request: {e}")
                return
            if path == "/api/resume/upload":
                self._send_json(resume_upload(payload))
            elif path == "/api/resume/delete":
                self._send_json(resume_delete())
            elif path == "/api/resume/analyze":
                self._send_json(resume_analyze(payload))
            elif path == "/api/resume/action":
                self._send_json(resume_action(payload))
            else:
                self.send_error(404, "Not found")
            return
        if path == "/api/assistant":
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 30000:
                self.send_error(413, "Bad size")
                return
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception as e:
                self.send_error(400, f"Bad request: {e}")
                return
            self._send_json(assistant_reply(payload))
            return
        if path == "/api/speak":
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 20000:
                self.send_error(413, "Bad size")
                return
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                text = str(body.get("text", "")).strip()
                if not text:
                    raise ValueError("empty text")
            except Exception as e:
                self.send_error(400, f"Bad request: {e}")
                return
            audio, err = speak_text(text)
            if err:
                self._send_json(err)
                return
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
            return
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
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    try:
        httpd = socketserver.ThreadingTCPServer(("", PORT), Handler)
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
        if eleven_key():
            print(f"ElevenLabs voice: ready ({ELEVEN_VOICE_NAME}). 'Read it to me' will sound human.")
        else:
            print("ElevenLabs voice: no key found — falling back to the browser voice.")
            print("Put your key in elevenlabs_key.txt to enable it.")
        if anthropic_key():
            print("Assistant brain: Claude connected. Sarah can hold a full conversation.")
        else:
            print("Assistant brain: pattern matching only. Put an Anthropic API key in")
            print("anthropic_key.txt to let Sarah hold real conversations.")
        print("\nKeep this window open while you use the dashboard. Ctrl+C to stop.")
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
