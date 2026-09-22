# SARAH — Personal Command Center

**The complete guide to everything the app does.**

Sarah is a personal operating system that runs entirely on your Mac. It is built on one rule: **you only ever score yourself on inputs you control, never on outcomes.** Customers, belts and money are lagging results; your job is to hit the daily numbers and let the results arrive on their own schedule. Sarah tracks those numbers, your job search (live from Notion), your calendar (both ways), your money (from Rocket Money), and talks to you out loud like a real assistant. One Python file is the server, one HTML file is the entire interface, and all your data stays on your machine.

---

## 1. The big picture

| Piece | What it is |
|---|---|
| `notion_server.py` | The local server. Serves the app at `localhost:8000`, talks to Notion, Google Calendar, ElevenLabs, Anthropic, CoinGecko and Yahoo Finance on your behalf, and saves your data. |
| `job-dashboard.html` | The entire app: interface, logic, styling. Opens in your browser. |
| `personal_data.json` | Your life data: lead measures, tasks, prayers, outreach, reviews, income, imported spending, everything. Saved automatically within half a second of any change. |
| `start.command` | Double-click launcher. Starts the server and opens the app. |
| Key files | `notion_token.txt`, `credentials.json` + `token_calendar.json` (+ `.sarah_calendar.json`), `elevenlabs_key.txt`, `anthropic_key.txt`. All gitignored, never served over HTTP. |

Nothing is hosted in the cloud. Closing the terminal stops the app; nothing is ever lost, because every change is written to disk immediately (with a second copy in the browser's local storage as backup).

---

## 2. Starting up

Run `python3 notion_server.py` (or double-click `start.command`). The terminal reports the status of each connection: Notion token found or not, ElevenLabs voice ready or not, Claude brain connected or not. The browser opens automatically.

The first time each browser session, you get the **boot sequence**: a glowing arc reactor, a typed checklist (your applications, your calendar, your priorities, your markets), and a greeting — "Good morning, Youssef. Let's get after it." It plays once per session, then stays out of your way.

The whole interface is a JARVIS-style HUD: deep navy background with a faint cyan grid, glowing panels, a breathing arc-reactor logo, and a live clock in the header. A 🌓 button toggles a light theme, remembered across sessions.

---

## 3. The header

- **SARAH ▾** — hover over the name (or click it) and the navigation menu slides down: System (Today, Scoreboard, Goals, Docs), Career (Job Insights, Applications, Calendar, Interviews·CRM, Resume Match), Life (Train, Finance, Projects). It closes when you pick a destination, move away, or press Escape.
- **Command bar** (top right) — one input for everything. See section 5.
- **Live clock**, a **connection dot** (green = Notion feed live, red = offline), **day %** (today's lead measures), when data last refreshed, an auto-refresh interval picker (30s / 60s / 5m), **Refresh**, **Export CSV**, **🎤 Talk**, and the theme toggle.

**Keyboard shortcuts:** `Cmd+K` focuses the command bar. Keys `1–8` jump between tabs (1 Today, 2 Scoreboard, 3 Job Insights, 4 Applications, 5 Calendar, 6 Interviews·CRM, 7 Train, 8 Finance). `N` jumps to a new task. `Escape` closes menus and popups.

---

## 4. Talking to Sarah (the voice assistant)

Click **🎤 Talk** and speak. Chrome transcribes you, Sarah figures out what you meant, updates the app, and answers out loud in the ElevenLabs **Elise** voice. A small bubble in the corner shows the exchange in text. After she answers, she listens again automatically — a real back-and-forth conversation.

**Two brains, in order:**

1. **Claude (when `anthropic_key.txt` is present).** Everything you say goes to Claude with a snapshot of your day and your system — today's lead measures, this week's numbers, the venture and its 90-day lock, training, tasks, applications, money — plus recent conversation memory. She knows your rules and holds you to them: if you start talking about polishing a product instead of contacting people, she'll name it. When you report something done, she applies it: prayers, Quran, sales study, sleep, training, outreach and replies, the call home, a social evening, income, expenses, tasks.
2. **Pattern matching (always available, no key).** Understands the common phrases: "I prayed fajr and dhuhr" (or "all five"), "read Quran", "sent 15 DMs", "got 3 replies", "studied sales", "slept 8 hours", "called my parents", "went out with friends", "just finished BJJ", "took my creatine", "made 45 dollars", "spent 12 on lunch", "later: drone mapping idea", "remind me to email the recruiter tomorrow at 3pm", and questions like "what's left?", "how many conversations today?", "what do my subscriptions cost?".

**The "Read it to me" button** on the rundown speaks it. If ElevenLabs is unreachable it falls back to the browser's built-in voice.

---

## 5. The command bar

| You type | What happens |
|---|---|
| `call Onset lead tomorrow at 3pm` | A task, due tomorrow at 3:00 PM, titled "call Onset lead". Understands today, tonight, tomorrow, weekday names, and times like `3pm` or `at 15:30`. |
| `sent 15` / `15 dms` / `+15` | Logs 15 outreach conversations |
| `3 replies` | Logs 3 replies |
| `later: drone mapping startup` | Parks a new business idea in Later (the 90-day lock) |
| `review` | Opens the Scoreboard |
| `goal: get a Boeing internship` | Jumps to Goals and generates a phased plan |
| `find airbus` / `?spacex` | Jumps to Applications filtered to that search |
| anything else | Becomes a task |

---

## 6. The Today tab (the main screen)

### 6.1 Your next move + rundown

**Your next move** is the single highest-value open task or goal action. **Your rundown** is five to seven short bullets, rebuilt live: the date and what's next on the calendar; outreach today and this week; today's training; everything still open, by name; tasks due; applications today; and on Sundays, a reminder that the review is due.

### 6.2 Today's numbers — the daily lead measures

One overall percentage (also the header's **day %**) and a card per area, each with its own bar, Monday-to-Sunday dots, and this-week and 30-day percentages. Click any dot to fix a past day.

- **🕌 Faith** — five prayers on the ring, then Quran (10 min). On Fridays, Jummah.
- **📞 The venture** (Onset Listings by default) — a conversation counter with −/+1/+5 buttons against 15 a day (weekdays; 75 a week), a replies counter, and 30 minutes of sales study.
- **🥋 Training** — today's sessions from the weekly plan.
- **🧴 Body** — slept 7+ hours, creatine, skincare.
- **🧠 Mind** — language lesson and immersion.
- **💵 Income** — a log, deliberately **not scored**: money is an outcome. It still feeds the Sunday review and Finance.

New measures only count from the day the system went live, so older days aren't dragged down retroactively.

### 6.3 This week

Martial arts against 4, lifting against 3, and outreach against 75 — coloured by pace, never red early in the week — plus checkboxes for the call home and a social evening out, and a link to the Sunday review.

### 6.4 The venture card

Day X of 90 on the lock, outreach this week, progress toward 1,000 conversations, the reply rate, paying customers (add them by name; three lifts the lock), and **Later**, where new business ideas go to be parked and closed.

### 6.5 Tasks and today's schedule

Add a task with a date and optional time; check it off; delete it. With calendar sync on, every dated task also lives on your SARAH calendar (section 8). Beside it, today's schedule from every calendar, with SARAH's own blocks tagged.

### 6.6 Markets

Bitcoin, Solana and the S&P 500 with small graphs, refreshed every minute.

---

## 7. The Scoreboard tab

- **🗒 Sunday review** — the five numbers for the week, filled in automatically: prayers on time, training sessions, outreach conversations, replies received, dollars earned. Write one line on what to change, save it. Step back through past weeks with ‹ ›, and see the last eight weeks in a table. 🔊 reads it aloud.
- **🧭 Destination · September 2027** — every domain, with live progress where the data exists: Faith (30-day prayers, Quran, Jummah, a knowledge area), Body (blue belt, no-gi competitions, weeks hitting 4 + 3), Money (paying customers, income this month), Skill (conversations toward 1,000), Degree (capstone, graduation countdown), People (call-home streak, social evenings), Place (relocation plan and savings).
- **🗺 Milestones to graduation** — Now → December, January → April, May 2027, Summer 2027, with the current quarter highlighted and live bars for customers, outreach and monthly income.
- **🛡 The rules** — the 90-day lock (with its live status), build time capped / outreach not, rejection is the metric, faith / training / sleep never traded for work, and the money rule.
- **🗓 Calendar** — connect sync and set up your daily blocks (section 8).

---

## 8. Calendar (both ways)

**Reading** works as before: every calendar on your account is read every 5 minutes, and today's events from your other calendars become tasks once each.

**Writing** is new and opt-in. Press **Connect** once and Google asks for permission to write to your calendars (one approval in the browser). From then on:

- SARAH creates its own calendar called **"SARAH"** and only ever writes there. Your other calendars are never edited.
- **Every task with a date goes on it** — timed tasks at their time, dateless-time tasks as all-day events.
- **Check a task off in the app** → it shows **✓** in Google and turns grey.
- **Drag it to a new time or day in Google** → it moves in the app.
- **Put ✓ at the start of its title in Google** (e.g. from your phone) → it's marked done in the app.
- **Delete it in the app** → it's removed from Google. **Delete it in Google** → the task stays in the app but comes off the calendar.
- If both sides changed, the most recent edit wins. Sync runs a couple of seconds after any change, every 5 minutes, and on **Sync now**.

**Daily blocks** put the system itself on your calendar as recurring events, with times you choose: Quran + sales study (Mon–Fri, 7:00 for 40 min), Outreach · 15 conversations (Mon–Fri, 12:15 for 60 min, before the 1:30 shift), and the Sunday review (Sunday 8:00 PM, 30 min). Change the times and press Update; untick one to remove it.

---

## 9. Job search (the Career section)

### 9.1 Where the data comes from

Your **Notion Job Application Tracker** is the source of truth. The server reads it with your private integration token (20-second cache so Notion never gets hammered) and auto-detects your columns regardless of exact naming: the title property is the company, and it finds position/role, status, country/region, notes, and application date. Statuses are normalized (anything containing "offer" → Offer Received, "interview"/"assessment" → Interview Scheduled, "reject"/"declin" → Rejected, "withdraw" → Withdrawn, else Applied). Countries are normalized to USA 🇺🇸, UK 🇬🇧, UAE 🇦🇪, Australia 🇦🇺, Europe 🇪🇺, or Other 🌐.

The dashboard polls on your chosen interval (default 60 s) with a countdown, flashes the live dot on refresh, and re-syncs whenever you return to the tab.

### 9.2 Job Insights tab

- **Stat tiles**: total all-time, applied today vs the 20/day goal, per-status counts, response rate, and how many need follow-up.
- **Daily goal by region**: progress bars for USA 10, Australia 3, UK 3, UAE 3, Europe 1 — resets every day.
- **Today's pace and what to do about it**: a pace bar, week-over-week comparison, and concrete recommendations — how many more to send, which regions are furthest behind, which role keywords are earning you interviews ("Lean into *propulsion* roles"), which get auto-rejected fastest ("Tailor or skip *analyst* roles"), and how many applications have been quiet over a week.
- **Follow-up worklist**: every application silent past your threshold (configurable 5/7/10/14 days), sorted oldest first, each with a **Copy email** button that puts a ready-to-send, personalized follow-up email on your clipboard.
- **Pipeline funnel**: Applied → Interviewed → Offers with conversion percentages.
- **Applications per week**: a 10-week bar chart.
- **Insights**: interview rate, response rate, average days to rejection, quick rejections (≤3 days — usually a machine, not a human), which keywords in role titles correlate with interviews, which get fast-rejected, which application portals (LinkedIn, Workday, Greenhouse, etc., detected from your notes) auto-filter you, and which country gives you the most interviews.

### 9.3 Applications tab

The full table: company + role, country flag, date, status badge, notes. Filter chips by status and follow-up, live search across everything, sortable columns, a "follow up · Nd" tag on stale rows. Click a company name for a popup with every application you've ever sent them. **Edit** any row to change status/country/notes or archive it — edits are saved locally as an overlay, so your Notion data is never touched. Export the current view to CSV anytime.

### 9.4 Calendar tab

A month-view heatmap of your application activity — each day colored by how many you sent, browsable across months, with month and all-time totals. Click a day to see exactly what you sent that day.

### 9.5 Interviews · CRM tab

- **Interview Center**: log each interview (company, role, date) and work a six-point prep checklist per interview — research the company, review the JD, prepare STAR stories, questions to ask, technical review, logistics — with a progress bar and a free-notes area that autosaves.
- **Recruiter contacts**: a lightweight rolodex (name, company, email/LinkedIn).
- **Resume version performance**: add each resume version you send, tap +app and +interview as results come in, and the app ranks which version converts best.

---

## 10. Goals

Type a goal in plain English ("Get a Boeing internship", "Improve GPA to 3.6"). The engine decomposes it into 3–5 strategic phases, each with small executable tasks — durations, importance, and whether they repeat daily. With an Anthropic key it's decomposed by Claude, personalized to your goal; without one, built-in strategy templates cover job hunts, GPA, languages, and interviews.

Progress is measured honestly: one-off tasks count when done, daily tasks count by **14-day adherence** (doing it once doesn't complete it), phases weigh equally. The next actions from the earliest incomplete phase feed straight into Today's "Up next", and daily goal-tasks keep their streaks visible. Goals can be paused, collapsed, and celebrate at 100% ("🏆 achieved!").

---

## 11. Projects

Name a project, press ▶ Start when you work on it, ⏹ Stop when you're done — sessions are timed to the second, accumulated forever, and logged automatically. Add written log entries anytime ("printed bracket v3"); the last five show per project.

---

## 12. The server (what runs behind the scenes)

Endpoints, all on localhost only:

| Endpoint | What it does |
|---|---|
| `GET /api/applications` | Your Notion tracker, normalized, cached 20 s |
| `GET /api/calendar` | Today + tomorrow from all Google calendars |
| `GET /api/markets` | BTC + SOL (CoinGecko) and S&P 500 (Yahoo), cached 60 s |
| `GET/POST /api/store` | Loads/saves `personal_data.json` (5 MB cap, atomic writes) |
| `POST /api/goal-plan` | Goal decomposition (Claude or templates) |
| `POST /api/assistant` | Sarah's conversational brain (Claude, with state + history) |
| `POST /api/speak` | Text-to-speech through ElevenLabs |
| `GET /api/calsync/status` | Whether calendar write access is on |
| `POST /api/calsync/connect` | The one-time Google approval, then finds or creates the SARAH calendar |
| `POST /api/calsync/sync` | One two-way task sync pass |
| `POST /api/calsync/blocks` | Puts the daily blocks on the calendar as recurring events |

The server is threaded, so a slow market fetch or the one-time Google approval never freezes the rest of the app, and it can restart immediately after Ctrl+C. It refuses to serve any secret file over HTTP (`notion_token.txt`, `credentials.json`, `token.json`, `token_calendar.json`, `elevenlabs_key.txt`, `anthropic_key.txt`, `personal_data.json`, `.sync_state.json`, `notion_config.json`, `.sarah_calendar.json`).

**The voice pipeline**: your text goes to ElevenLabs pinned to the Elise voice ID; if that voice isn't on your account it finds her by name or auto-adds her from the voice library; if all else fails it falls back to a standard voice, and the frontend falls back further to the browser's built-in voice — you always get audio.

---

## 13. Data, privacy, and cost

- **Everything personal lives on your Mac.** Lead measures, tasks, reviews, income, imported spending: `personal_data.json` + a browser localStorage backup. Job data lives in your Notion. Your Rocket Money export is read in the browser and never sent anywhere. Dated tasks and blocks go to your own Google Calendar only if you turn sync on.
- **API keys** sit in plain files in the app folder, gitignored, never served, never leaving your machine except to their own service.
- **Cost**: the app, market data, calendar, and Notion are free. ElevenLabs has a free tier (~10 min of speech/month; $5/mo for more). The Claude conversation brain is pay-as-you-go — roughly half a cent per exchange, a few dollars a month with heavy daily use, and it's optional: without a key, Sarah still works with pattern matching.

---

## 14. Everyday flow

Morning, before class: Fajr, then Quran, then 30 minutes of sales study (the morning block). Open Sarah; the rundown tells you what's left. Midday, before the 1:30 shift: the outreach block, fifteen conversations, pressing +5 as you go. After 5:30: training, already on the plan. Through the day, tell Sarah "sent 15, got 2 replies" or "slept 8 hours" instead of clicking. New business idea? `later:` it and close it. Sunday: open the Scoreboard, read the five numbers, write one line, save. That's the whole system.

---

## 15. Sarah 2.0 additions

Since this guide was written, five major phases shipped (full detail in ROADMAP.md):

- **Pattern engine**: Sarah learns your productive hours, strongest outreach
  days, prayer consistency, stale tasks, income rhythm, training days, stalled
  goals and best resume version — locally, with zero setup — and shares them
  with the voice assistant.
- **🏋️ Train**: attendance, not logging. Today's sessions as simple checkboxes,
  a week view showing every scheduled session as went / missed / upcoming, a
  performance card with this-week and 30-day attendance percentages plus a list
  of missed sessions, and the full weekly plan with the exercise lists as a
  read-only reference. Faith and Mind get the same treatment on the Today page:
  week dots plus weekly and 30-day percentages for prayers and languages.
  The Train tab also carries a **BJJ skill path**: a 10-week curriculum, one
  skill a week (Closed Guard through Submission Defenses), each with its
  techniques as checkboxes you tick once you can hit them live. A skill turns
  "mastered" when all its techniques are checked; the card tracks overall
  percentage, skills mastered out of ten, the current week, and highlights the
  next unmastered skill as this week's focus.
- **💰 Finance**: spending comes from **Rocket Money**. It has no public API, so
  the connection is its export: on rocketmoney.com open Transactions, Export a
  CSV, and drop it on the Finance tab. Sarah reads it locally, shows this month
  by category, and finds your **subscriptions** from recurring charges (what
  each costs, how often, when it hits next; ones that stopped charging are
  treated as cancelled). Re-import any time; the new file replaces the dates it
  covers without duplicating. Savings goals, net worth with live-valued crypto,
  six-month trends and cash spending said by voice sit alongside.
- **🎯 Resume Match**: upload your resume once, then paste any job description
  and get a recruiter-style read on whether to apply. APPLY NOW / APPLY IF YOU
  HAVE TIME / SKIP with an overall score, an eight-category breakdown,
  eligibility checks, strong/partial/missing skills, a requirement-by-requirement
  experience comparison, ATS keywords with suggested rewrites, resume
  improvements, red flags, career value, interview probability, effort estimate,
  a confidence score, and your expected match after tailoring alongside the exact
  edits that get you there. It runs in two modes: **⚡ Local** is the default and
  needs no API key, no network and no money — it reads the requirements the
  posting actually states and checks them against your resume, giving you the
  eligibility check, skills, ATS keywords, experience comparison and tailoring
  advice for free. **✨ AI review** is opt-in per analysis and adds Claude's
  judgement about the quality of your experience for a few cents. Six one-click
  actions (these do need a key) cover rewriting the resume, a cover letter,
  keyword optimization, recruiter outreach, interview prep and
  explaining the posting. Only the resume is stored: job descriptions and
  analyses live in the page for that session and are erased when you dismiss
  them, so export or copy anything worth keeping.
- **📚 Docs**: a private document library. Upload PDFs, Word docs, notes and
  slides; ask questions about them in the tab or by voice; everything stays on
  your machine and only matching excerpts reach Claude.
