# Job Search Dashboard — Setup

A small local tool that reads your Gmail, tracks job applications, and shows
them on an auto-refreshing dashboard.

## 1. Install dependencies

```bash
pip3 install -r requirements.txt
```

## 2. Add your Google credentials

Put your OAuth client file at `credentials.json` in this folder (Google Cloud
Console → APIs & Services → Credentials → OAuth client ID → **Desktop app**).
Enable the **Gmail API** for the project. `credentials.json` and the generated
`token.json` are gitignored — **never commit them.**

## 3. (Optional) Enable AI classification

Classification quality is much higher with Claude. Set a key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Without it, the sync automatically falls back to built-in heuristics — it still
runs, just less accurately on messy recruiter emails. Force heuristics with
`--no-ai`.

## 4. Run

```bash
# one pass
python3 sync_gmail.py --once --verbose

# keep syncing every 5 minutes
python3 sync_gmail.py --loop --interval 300

# serve the dashboard (separate terminal)
python3 serve.py
```

Useful flags: `--days 7` (wider lookback), `--no-ai` (skip Claude).

## How tracking works

- Applications are keyed by Gmail **thread id**, so follow-ups about the same
  job update one row instead of creating duplicates.
- Status only moves **forward**: Applied → Interview Scheduled →
  Rejected / Offer Received. A late auto-reply can't downgrade an interview.
- Each email is classified once and cached in `.sync_state.json`; re-runs never
  re-classify the same message.

## Security note

`credentials.json`, `token.json`, and `.sync_state.json` are never served over
HTTP and are gitignored. If a token is ever exposed, revoke it at
<https://myaccount.google.com/permissions>.
