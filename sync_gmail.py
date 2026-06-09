#!/usr/bin/env python3
"""
Self-updating Gmail -> data.json sync for the Job Search Dashboard.

What changed vs. the original (why tracking was "iffy"):
  * Applications are now keyed by Gmail THREAD id, not a fragile
    "company|position" string. Every recruiter follow-up about the same
    application lands in the same thread, so status changes are tracked on
    one row instead of spawning near-duplicates.
  * Status only moves FORWARD through a state machine
    (Applied -> Interview Scheduled -> Rejected/Offer Received). A late
    "thanks for applying" auto-reply can no longer downgrade an interview.
  * Classification/extraction can use Claude (set ANTHROPIC_API_KEY) for far
    better company/role/country/status detection, and falls back to improved
    heuristics automatically when no key is present or the API is unreachable.
  * Every message id is cached after classification, so re-runs never
    re-classify the same email (cheaper + faster).
  * Gmail calls retry with exponential backoff; UTC handling is timezone-aware.

Usage:
    python3 sync_gmail.py --once --verbose
    python3 sync_gmail.py --loop --interval 300
    python3 sync_gmail.py --once --no-ai      # force heuristic mode
    python3 sync_gmail.py --once --days 7     # widen the lookback window
"""
import argparse
import base64
import datetime as dt
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(HERE, "data.json")
STATE_FILE = os.path.join(HERE, ".sync_state.json")
TOKEN_FILE = os.path.join(HERE, "token.json")
CREDS_FILE = os.path.join(HERE, "credentials.json")
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

AI_MODEL = "claude-haiku-4-5"  # cheap + fast; right tier for per-email classification

DEFAULT_TARGETS = {"USA": 10, "Australia": 3, "UK": 3, "UAE": 3, "Europe": 1}
STATUSES = ("Applied", "Interview Scheduled", "Rejected", "Offer Received")
COUNTRIES = ("USA", "UK", "UAE", "Australia", "Europe", "Other")

# Forward-only state machine. A message can only raise a thread's status,
# never lower it. Rejected/Offer are terminal outcomes and outrank the
# in-progress states.
STATUS_RANK = {"Applied": 1, "Interview Scheduled": 2, "Rejected": 3, "Offer Received": 4}

GMAIL_QUERY_TMPL = (
    'newer_than:{days}d -category:promotions -from:linkedin.com '
    '(subject:(application OR applying OR interview OR offer OR position OR role OR candidacy) '
    'OR "your application" OR "thank you for applying" OR "we received your application" '
    'OR "moving forward" OR "not be moving forward" OR "pursue other candidates")'
)

# ---------------------------------------------------------------------------
# Heuristic classification (fallback when AI is unavailable)
# ---------------------------------------------------------------------------
US_STATES = (" AL ", " AK ", " AZ ", " AR ", " CA ", " CO ", " CT ", " FL ", " GA ",
             " OH ", " TX ", " NJ ", " NY ", " MD ", " WA ", " MA ", " VA ", " PA ", " MI ")
COUNTRY_HINTS = [
    ("Australia", ["australia", "sydney", "melbourne", "brisbane", "perth"]),
    ("UK", ["united kingdom", "england", "london", "manchester", " uk ", "bristol"]),
    ("UAE", ["united arab emirates", "dubai", "abu dhabi", " uae "]),
    ("Europe", ["germany", "france", "netherlands", "spain", "italy", "munich",
                "paris", "berlin", "amsterdam", "zurich", "switzerland", "ireland", "sweden"]),
    ("USA", ["united states", "u.s.", " usa ", "california", "texas", "new york",
             "ohio", "florida", "maryland", "new jersey", "remote, us"]),
]
CLASSIFIERS = [
    ("Offer Received", [r"\boffer\b.{0,40}\b(letter|position|join|employment)\b",
                        r"pleased to offer", r"extend(ing)? (you )?an offer"]),
    ("Interview Scheduled", [r"\binterview\b", r"availability", r"schedule a (call|time|chat)",
                             r"phone screen", r"speak with you", r"book a time", r"20-minute",
                             r"preliminary call", r"next steps.{0,30}\bcall\b"]),
    ("Rejected", [r"not be moving forward", r"decided not to", r"pursue other candidates",
                  r"will not be", r"\bunfortunately\b.{0,60}\b(not|unable|other|decided|won)",
                  r"not (to )?pursue", r"other applicants", r"won'?t be moving",
                  r"not a (close|match)", r"unable to offer"]),
    ("Applied", [r"application was sent", r"thank you for applying",
                 r"we received your application", r"received your application",
                 r"successfully (applied|submitted)", r"application (has been )?received"]),
]
# Email infrastructure / applicant-tracking-system domains: never the employer name.
ATS_DOMAINS = {
    "greenhouse.io", "greenhouse-mail.io", "us.greenhouse-mail.io", "lever.co",
    "hire.lever.co", "myworkday.com", "myworkdayjobs.com", "icims.com",
    "successfactors.com", "taleo.net", "smartrecruiters.com", "ashbyhq.com",
    "bamboohr.com", "jobvite.com", "workable.com", "breezy.hr", "recruitee.com",
    "applytojob.com", "oraclecloud.com", "brassring.com", "gmail.com",
    "outlook.com", "googlemail.com", "hotmail.com", "yahoo.com",
}
JUNK_NAME_TOKENS = ("noreply", "no-reply", "donotreply", "recruiting", "talent",
                    "careers", "jobs", "hr", "notification", "notifications",
                    "mailer", "team", "hello", "info", "msg", "successfactors",
                    "icims", "greenhouse", "lever", "workday")
GENERIC_SUBDOMAINS = {"mail", "email", "careers", "jobs", "recruiting", "notifications",
                      "notification", "smtp", "e", "em", "send", "no-reply", "noreply",
                      "talent", "apply", "hire", "info", "reply"}


def classify_status(text):
    low = text.lower()
    for status, patterns in CLASSIFIERS:
        if any(re.search(p, low) for p in patterns):
            return status
    return None


def detect_country(text):
    padded = f" {text.lower()} "
    for country, hints in COUNTRY_HINTS:
        if any(h in padded for h in hints):
            return country
    if any(s.lower() in padded for s in US_STATES):
        return "USA"
    return "Other"


def _company_from_domain(domain):
    if not domain:
        return ""
    domain = domain.lower().strip()
    if domain in ATS_DOMAINS:
        return ""
    labels = [l for l in domain.split(".") if l]
    # Drop generic leading subdomains (mail.airbus.com -> airbus.com)
    while len(labels) > 2 and labels[0] in GENERIC_SUBDOMAINS:
        labels = labels[1:]
    if len(labels) < 2:
        return ""
    # registrable label is the one before the TLD (handles foo.com and foo.co.uk-ish)
    label = labels[-3] if (len(labels) >= 3 and labels[-2] in {"co", "com", "org", "gov"}) else labels[-2]
    if label in ATS_DOMAINS or f"{label}.com" in ATS_DOMAINS:
        return ""
    return label.capitalize()


def guess_company(sender, subject):
    # 1) Subject patterns are the most explicit signal when present.
    for pat in [
        r"application was sent to ([A-Z][\w&.\- ]{2,40})",
        r"applying to (?:the .+ position at )?([A-Z][\w&.\- ]{2,40})",
        r"interest in ([A-Z][\w&.\- ]{2,40}?)(?: [-–|:]|$)",
        r"\bat ([A-Z][\w&.\- ]{2,40})",
        r"^([A-Z][\w&.\- ]{2,40}?) [-–|:]",
    ]:
        sm = re.search(pat, subject)
        if sm:
            cand = re.sub(r"\b(careers?|recruiting|talent|team)\b", "", sm.group(1),
                          flags=re.I).strip(" .-")
            if cand:
                return cand
    # 2) A clean display name.
    m = re.match(r'\s*"?([^"<]+?)"?\s*<', sender)
    name = m.group(1).strip() if m else ""
    if name and not any(j in name.lower() for j in JUNK_NAME_TOKENS):
        return name
    # 3) The sending domain, if it isn't an ATS / generic mail host.
    dm = re.search(r"@([\w.-]+)", sender)
    company = _company_from_domain(dm.group(1)) if dm else ""
    return company or "Unknown"


def guess_position(subject):
    for pat in [r"position of ([^.,|]+)", r"for the ([^.,|]+?) (?:role|position)",
                r":\s*([A-Z][^.,|]+)", r"\bfor (?:a |an )?([A-Z][\w/ \-]{3,50})"]:
        m = re.search(pat, subject)
        if m:
            return m.group(1).strip(" .-")
    return ""


def classify_heuristic(subject, sender, body):
    text = f"{subject}\n{body}"
    status = classify_status(text)
    if not status:
        return None
    return {
        "company": guess_company(sender, subject),
        "position": guess_position(subject) or "",
        "location": "",
        "country": detect_country(text),
        "status": status,
    }


# ---------------------------------------------------------------------------
# AI classification (Claude) — optional, with graceful fallback
# ---------------------------------------------------------------------------
_AI_CLIENT = None
_AI_DISABLED = False

AI_SYSTEM = (
    "You classify job-application emails for a personal application tracker. "
    "Given one email (sender, subject, body), decide whether it is a direct "
    "response or update about a job the user applied to (confirmation, interview "
    "invite, assessment, rejection, or offer) and extract structured fields. "
    "Job alerts, newsletters, 'jobs you may like', and marketing are NOT "
    "applications. Return only the structured object."
)
AI_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "is_application": {"type": "boolean"},
        "company": {"type": "string"},
        "position": {"type": "string"},
        "location": {"type": "string"},
        "country": {"type": "string", "enum": list(COUNTRIES)},
        "status": {"type": "string", "enum": list(STATUSES) + ["Other"]},
    },
    "required": ["is_application", "company", "position", "location", "country", "status"],
}


def _get_ai_client():
    global _AI_CLIENT, _AI_DISABLED
    if _AI_DISABLED:
        return None
    if _AI_CLIENT is not None:
        return _AI_CLIENT
    if not os.environ.get("ANTHROPIC_API_KEY"):
        _AI_DISABLED = True
        return None
    try:
        import anthropic
        _AI_CLIENT = anthropic.Anthropic()
    except Exception:
        _AI_DISABLED = True
        return None
    return _AI_CLIENT


def classify_ai(subject, sender, body):
    client = _get_ai_client()
    if not client:
        return None
    content = f"From: {sender}\nSubject: {subject}\n\n{body[:4000]}"
    try:
        resp = client.messages.create(
            model=AI_MODEL,
            max_tokens=400,
            system=AI_SYSTEM,
            messages=[{"role": "user", "content": content}],
            output_config={"format": {"type": "json_schema", "schema": AI_SCHEMA}},
        )
        raw = next((b.text for b in resp.content if getattr(b, "type", "") == "text"), "")
        data = json.loads(raw)
    except Exception as e:
        # On any AI failure, fall back to heuristics for this message.
        log(f"  (ai unavailable: {type(e).__name__}: {str(e)[:80]}; using heuristics)")
        return None
    if not data.get("is_application") or data.get("status") not in STATUSES:
        return {"_skip": True}
    return {
        "company": (data.get("company") or "").strip() or "Unknown",
        "position": (data.get("position") or "").strip(),
        "location": (data.get("location") or "").strip(),
        "country": data.get("country") if data.get("country") in COUNTRIES else "Other",
        "status": data["status"],
    }


def classify_email(subject, sender, body, use_ai=True):
    """Return a dict of fields, or None to skip this email."""
    if use_ai:
        ai = classify_ai(subject, sender, body)
        if ai is not None:
            return None if ai.get("_skip") else ai
    return classify_heuristic(subject, sender, body)


# ---------------------------------------------------------------------------
# Gmail plumbing
# ---------------------------------------------------------------------------
def log(msg):
    print(f"[{dt.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def get_service():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDS_FILE):
                sys.exit(f"Missing {CREDS_FILE}. See SETUP.md.")
            flow = InstalledAppFlow.from_client_secrets_file(CREDS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def execute_with_retry(request, tries=4, base=2.0):
    """Run a Gmail API request with exponential backoff on transient errors."""
    from googleapiclient.errors import HttpError
    last = None
    for attempt in range(tries):
        try:
            return request.execute()
        except HttpError as e:
            status = getattr(e.resp, "status", None)
            if status and int(status) < 500 and int(status) != 429:
                raise  # client error — don't retry
            last = e
        except (TimeoutError, OSError) as e:
            last = e
        if attempt < tries - 1:
            time.sleep(base * (2 ** attempt))
    raise last


def header(headers, name):
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def extract_body(payload):
    def walk(part):
        if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
            return base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", "ignore")
        for sub in part.get("parts", []) or []:
            t = walk(sub)
            if t:
                return t
        return ""
    return walk(payload)


def now_utc_iso():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def msg_date(full):
    ts = int(full["internalDate"]) / 1000
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------
def merge_into_thread(apps_by_thread, thread_id, entry, date, note):
    """Apply forward-only status logic for a thread's row."""
    new_rank = STATUS_RANK.get(entry["status"], 0)
    existing = apps_by_thread.get(thread_id)
    if existing is None:
        row = {
            "company": entry["company"],
            "position": entry["position"] or "—",
            "location": entry["location"] or "—",
            "country": entry["country"],
            "date": date,
            "status": entry["status"],
            "note": note,
            "threadId": thread_id,
            "firstSeen": date,
            "lastUpdated": now_utc_iso(),
            "history": [{"date": date, "status": entry["status"], "note": note}],
        }
        apps_by_thread[thread_id] = row
        return "added", entry["status"]

    # Fill in fields that were previously unknown, without clobbering good data.
    if existing["company"] in ("", "Unknown") and entry["company"] not in ("", "Unknown"):
        existing["company"] = entry["company"]
    if existing["position"] in ("", "—") and entry["position"]:
        existing["position"] = entry["position"]
    if existing["location"] in ("", "—") and entry["location"]:
        existing["location"] = entry["location"]
    if existing["country"] in ("", "Other") and entry["country"] != "Other":
        existing["country"] = entry["country"]

    existing.setdefault("history", []).append(
        {"date": date, "status": entry["status"], "note": note})
    existing["lastUpdated"] = now_utc_iso()

    old_rank = STATUS_RANK.get(existing["status"], 0)
    if new_rank > old_rank:
        existing["status"] = entry["status"]
        existing["note"] = note
        existing["date"] = date
        return "updated", entry["status"]
    return None, None


def sync_once(service, verbose=False, days=2, use_ai=True):
    data = load_json(DATA_FILE, {"applications": [], "targets": dict(DEFAULT_TARGETS)})
    data.setdefault("targets", dict(DEFAULT_TARGETS))
    state = load_json(STATE_FILE, {"seen_ids": [], "skipped_ids": []})
    seen = set(state.get("seen_ids", []))
    skipped = set(state.get("skipped_ids", []))

    # Rebuild the thread index from whatever is already in data.json.
    apps_by_thread = {}
    orphans = []
    for a in data.get("applications", []):
        tid = a.get("threadId")
        if tid:
            apps_by_thread[tid] = a
        else:
            orphans.append(a)

    query = GMAIL_QUERY_TMPL.format(days=days)
    msgs, token = [], None
    while True:
        resp = execute_with_retry(service.users().messages().list(
            userId="me", q=query, maxResults=100, pageToken=token))
        msgs.extend(resp.get("messages", []))
        token = resp.get("nextPageToken")
        if not token:
            break

    added, updated = [], []
    for m in msgs:
        mid = m["id"]
        if mid in seen or mid in skipped:
            continue
        full = execute_with_retry(service.users().messages().get(
            userId="me", id=mid, format="full"))
        payload = full.get("payload", {})
        headers = payload.get("headers", [])
        subject = header(headers, "Subject")
        sender = header(headers, "From")
        body = extract_body(payload)
        thread_id = full.get("threadId", mid)

        entry = classify_email(subject, sender, body, use_ai=use_ai)
        if not entry:
            skipped.add(mid)
            if verbose:
                log(f"skip (not an application): {subject[:60]!r}")
            continue

        seen.add(mid)
        date = msg_date(full)
        note = subject[:140].strip()
        action, status = merge_into_thread(apps_by_thread, thread_id, entry, date, note)
        label = f"{entry['company']} ({status})" if entry["company"] else status
        if action == "added":
            added.append(label)
        elif action == "updated":
            updated.append(f"{entry['company']}: → {status}")

    data["applications"] = orphans + list(apps_by_thread.values())
    data["lastSync"] = now_utc_iso()
    data["today"] = dt.date.today().strftime("%Y-%m-%d")
    save_json(DATA_FILE, data)
    save_json(STATE_FILE, {"seen_ids": sorted(seen), "skipped_ids": sorted(skipped)})

    if added or updated:
        for a in added:
            log(f"  + added   {a}")
        for u in updated:
            log(f"  ~ updated {u}")
        log(f"data.json updated — {len(added)} added, {len(updated)} updated.")
    else:
        log("no change — tracker is up to date.")


def main():
    ap = argparse.ArgumentParser(description="Self-updating Gmail -> data.json sync.")
    ap.add_argument("--loop", action="store_true", help="keep syncing on an interval")
    ap.add_argument("--once", action="store_true", help="single pass (default)")
    ap.add_argument("--interval", type=int, default=300,
                    help="seconds between passes when --loop (default 300, min 30)")
    ap.add_argument("--days", type=int, default=2, help="Gmail lookback window in days")
    ap.add_argument("--no-ai", action="store_true", help="force heuristic classification")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    interval = max(30, args.interval)
    use_ai = not args.no_ai
    if use_ai and not os.environ.get("ANTHROPIC_API_KEY"):
        log("ANTHROPIC_API_KEY not set — using built-in heuristics.")
    elif use_ai:
        log(f"AI classification enabled ({AI_MODEL}).")

    service = get_service()

    if args.loop:
        log(f"Self-updating every {interval}s. Ctrl+C to stop.")
        try:
            while True:
                try:
                    sync_once(service, args.verbose, args.days, use_ai)
                except Exception as e:
                    log(f"error during sync: {e}")
                time.sleep(interval)
        except KeyboardInterrupt:
            log("stopped.")
    else:
        sync_once(service, args.verbose, args.days, use_ai)


if __name__ == "__main__":
    main()
