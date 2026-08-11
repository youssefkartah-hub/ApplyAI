# SARAH — Personal Command Center

**The complete guide to everything the app does.**

Sarah is a personal operating system that runs entirely on your Mac. She tracks your job search live from Notion, syncs your day from Google Calendar, manages your faith, training, learning and income goals, watches the markets, and talks to you out loud like a real assistant. One Python file is the server, one HTML file is the entire interface, and all your data stays on your machine.

---

## 1. The big picture

| Piece | What it is |
|---|---|
| `notion_server.py` | The local server. Serves the app at `localhost:8000`, talks to Notion, Google Calendar, ElevenLabs, Anthropic, CoinGecko and Yahoo Finance on your behalf, and saves your data. |
| `job-dashboard.html` | The entire app: interface, logic, styling. Opens in your browser. |
| `personal_data.json` | Your life data: tasks, habits, prayers, income log, goals, projects, everything. Saved automatically within half a second of any change. |
| `start.command` | Double-click launcher. Starts the server and opens the app. |
| Key files | `notion_token.txt`, `credentials.json` + `token_calendar.json`, `elevenlabs_key.txt`, `anthropic_key.txt`. All gitignored, never served over HTTP. |

Nothing is hosted in the cloud. Closing the terminal stops the app; nothing is ever lost, because every change is written to disk immediately (with a second copy in the browser's local storage as backup).

---

## 2. Starting up

Run `python3 notion_server.py` (or double-click `start.command`). The terminal reports the status of each connection: Notion token found or not, ElevenLabs voice ready or not, Claude brain connected or not. The browser opens automatically.

The first time each browser session, you get the **boot sequence**: a glowing arc reactor, a typed checklist (your applications, your calendar, your priorities, your markets), and a greeting — "Good morning, Youssef. Let's get after it." It plays once per session, then stays out of your way.

The whole interface is a JARVIS-style HUD: deep navy background with a faint cyan grid, glowing panels, a breathing arc-reactor logo, and a live clock in the header. A 🌓 button toggles a light theme, remembered across sessions.

---

## 3. The header

- **SARAH ▾** — hover over the name (or click it) and the navigation menu slides down: Assistant (Today, Goals, Planner, Inbox), Career (Job Insights, Applications, Calendar, Interviews·CRM), Life (Projects, Habits, Focus). It closes when you pick a destination, move away, or press Escape.
- **Ask anything bar** (top right) — one input for everything. See section 5.
- **Live clock**, a **connection dot** (green = Notion feed live, red = offline), **day %** (your overall daily completion), when data last refreshed, an auto-refresh interval picker (30s / 60s / 5m), **Refresh**, **Export CSV**, **🎤 Talk**, and the theme toggle.

**Keyboard shortcuts:** `Cmd+K` focuses the ask bar. Keys `1–8` jump between tabs (1 Today, 2 Planner, 3 Inbox, 4 Habits, 5 Focus, 6 Job Insights, 7 Calendar, 8 Applications). `C` opens quick capture, `N` starts a new task, `F` opens Focus. `Escape` closes menus and popups.

---

## 4. Talking to Sarah (the voice assistant)

Click **🎤 Talk** and speak. Chrome transcribes you, Sarah figures out what you meant, updates the app, and answers out loud in the ElevenLabs **Elise** voice. A small bubble in the corner shows the exchange in text. After she answers, she listens again automatically — a real back-and-forth conversation. The button becomes 🔴 Stop while a conversation is live; click it or stay silent to end.

**Two brains, in order:**

1. **Claude (when `anthropic_key.txt` is present).** Everything you say goes to Claude Sonnet with a full snapshot of your day — prayers left, training scheduled, income progress, applications sent, interviews in play, companies gone quiet, focus minutes, habits, today's calendar, top tasks — plus the last 8 exchanges of conversation memory. She can hold an open conversation: interview advice, planning, motivation, anything. When you report something done, Claude emits structured actions the app applies instantly: check a prayer, check training, check a lesson, log income, add a task, complete an existing task by name.
2. **Pattern matching (always available, no key).** Built-in understanding for the common phrases: "I prayed fajr and dhuhr" (or "all five"), "just finished BJJ" / "muay thai" / "I trained", "I made 45 dollars", "I did my lesson", "watched narcos", "remind me to email the recruiter", "what do I still need to do?", "how much have I made?", "read my rundown".

Anything she checks off also completes the matching calendar task, so your planner, progress bars and overall percentage all move in real time while she's confirming it out loud.

**The "Read it to me" button** on the daily rundown speaks the whole briefing. If ElevenLabs is unreachable or out of credits, it falls back to the built-in browser voice and tells you why via a small toast.

---

## 5. The ask-anything bar

One text input that routes by prefix:

| You type | What happens |
|---|---|
| `goal: get a Boeing internship` | Jumps to Goals and generates a full phased plan |
| `find airbus` / `search boeing` / `?spacex` | Jumps to Applications filtered to that search |
| `habit: read 20 minutes` | Creates a new daily habit |
| `focus` | Opens the Focus timer |
| `apply to SpaceX tomorrow` | Smart-detected as a task: categorized (Career), due date parsed from "today"/"tomorrow" |
| anything else | Captured to the Inbox, auto-sorted into a life area |

---

## 6. The Today tab (the main screen)

Top to bottom:

### 6.1 Your next move + Daily rundown (one combined card)

**Your next move** is the single highest-value thing to do right now, chosen by the priority engine (section 7) from all open tasks and goal actions. It shows the task, its area, duration, and two buttons: ✅ Done and ⏱ Focus on it (which opens the timer).

**Your daily rundown** is a human-written briefing, rebuilt live:
- Greeting with the date.
- Calendar summary: how many events today and what's next at what time.
- Applications: sent today out of your daily goal of 20, companies gone quiet that need a nudge, interviews in play.
- Overdue tasks, if any, with the one to clear first.
- Best use of your time right now.
- **Everything still on the board today, by name**: remaining prayers (e.g. "3 prayers (Asr, Maghrib, Isha)"), scheduled training sessions, language lesson, Narcos episode, and dollars left to the income goal. When it's all done: "Every daily category is done. That's a perfect day."
- Habits not yet checked.
- Deep work so far ("No deep work logged yet. One focused session gets the ball rolling.").
- On Sundays, a weekly review: applications, tasks done, deep-work hours, interview movement over the last 7 days.

🔊 **Read it to me** speaks the whole thing in Elise's voice.

### 6.2 Markets

Live tiles for **Bitcoin**, **Solana** (7-day area graphs, 24-hour change) and the **S&P 500** (today's intraday graph vs previous close). Green graph and ▲ when up, red and ▼ when down. Prices come from CoinGecko and Yahoo Finance through your local server (cached 60 seconds server-side), refreshed every minute while the app is open. Free, no keys.

### 6.3 Your day at a glance (daily performance)

A big overall percentage with an animated bar, plus a motivating line that changes with progress ("Fresh slate. Pick one and get started." → "Almost there. Finish strong." → "Perfect day. Every single category closed out. 💯"). The overall number is the average of every category active today and also appears in the header as **day %**.

Five life-area cards, each with its own percentage and progress bar, glowing green when complete:

- **🕌 Faith** — the five daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) around a **circular tracker split into five equal segments**. Each prayer you check fills one segment with a cyan glow and adds 20% to the ring's center number; at five the whole ring turns green. Checked items get a satisfying strikethrough.
- **🥋 Training** — today's sessions from the weekly plan (Mon Upper Body A + Muay Thai, Tue Lower Body Strength + BJJ, Wed Recovery & Mobility, Thu Upper Body B + BJJ, Fri Muay Thai then Lower Body Power + Athletic Work, Sat & Sun Rest), plus anything training-related your calendar adds. Every session is a plain checkbox, exactly like prayers: check it once you've been, nothing else to log. Checking one off also completes its task in the planner. On rest days the card is excluded from the overall average so it never drags your score.
- **🧴 Body** — two daily non-negotiables: creatine (5 g) and your nightly skincare routine. Plain checkboxes with the same Monday-to-Sunday dots and weekly / 30-day percentages as prayers, so a missed streak is obvious at a glance. Say "took my creatine" or "did my skincare" and Sarah checks them off.
- **🧠 Mind** — Language lesson, one episode of Narcos.
- **💵 Income** — a full money log (next section).

### 6.4 The income log

Goal: **$100 a day**. Type any amount and hit "Log it" (or Enter) each time you make money. The card shows: total earned today in large type, dollars left to the goal ("$25 left to make" → "Goal hit. Everything extra is a bonus. 🎉"), every entry logged today with an ✕ to remove mistakes, and a running **all-time total** that keeps growing forever. The category percentage (earned ÷ 100, capped at 100%) feeds your overall day. If the page refreshes while you're mid-typing, your input survives.

### 6.5 Up next

Your top seven actions ranked by score — regular tasks and goal-plan actions mixed together, each with its priority number (red-tinted when 70+, meaning hot). Check them off right there.

### 6.6 Worth keeping an eye on

A radar of things that aren't tasks but matter: interviews coming up (prep!), companies waiting on a reply (with days silent), active goals with percent complete, later calendar events, and today's habits with streak counts and checkboxes.

### 6.7 Today's schedule

Every calendar event today with its time, dimmed once it has ended, and a status tag showing whether it became a task ("⚡ in tasks" / "✅ done"). Empty state: "Nothing scheduled today. The day is yours."

### 6.8 Where your time goes

Sarah counts every module you open and every meaningful action (tasks completed, focus sessions, captures, command-bar uses, habit checks) — locally, kept 30 days, never leaves your machine. This panel ranks your most-used modules over the last 14 days with bars, plus action counts as pills. It's your own usage mirror.

### 6.9 Milestones

Achievement badges that unlock as you go: 🚀 first 10 applications, 💯 50 applications, 🎤 first interview, 🔥 7-day habit streak, 🧠 10 hours of deep work, ✅ 25 tasks done, 🏆 offer received. Locked ones are greyed out.

---

## 7. The priority engine

Every open task gets a score from 0–100:

- Base 20, plus importance × 14 (importance is Low/Med/High = 1/2/3).
- Area bonus: Career +12, University +8.
- Deadline pressure: overdue +40, due today +32, tomorrow +24, within 3 days +14, within a week +6.
- Quick-win bonus: +6 if it takes 30 minutes or less.
- Anti-rot: +1 per day old, up to +8, so nothing gets buried forever.

Goal-plan actions are scored separately (base 30 + importance, +20 if it's a daily habit-type action, earlier phases beat later ones, short actions get a nudge). If you ignore a suggested goal action for 3+ days its score drops and it gets flagged "stuck, break it down?" instead of nagging you.

The highest score becomes **Your next move**; the top seven become **Up next**.

---

## 8. Calendar sync (Google Calendar)

- Connected once via a browser approval; after that a saved token refreshes itself.
- Reads **all calendars on your account** — primary, gym apps, shared and secondary calendars — deduped and sorted.
- Checks every **5 minutes** while the app is open, plus on every load.
- **Every event on today's schedule automatically becomes a task**: named after the event, auto-categorized by title (a lecture → University, an interview call → Career, BJJ → Health, tuition → Finance), duration taken from the event's real length (clamped 15 min–4 h), and dropped into the planner at the event's actual hour if it falls between 09:00 and 20:00.
- Each event imports **once per day** (tracked by event ID), so nothing duplicates no matter how many times the sync runs. Events that already ended before the sync are skipped rather than added as stale to-dos.
- Training events additionally appear in the Faith/Training daily card as described above.
- The rundown and the schedule card both reflect it, and a toast tells you when new events land ("Added 2 calendar events to today's plan").

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

## 11. Planner

Twelve hourly slots, 09:00–20:00. Unscheduled tasks sit on the left as draggable chips (with score and duration) — drag them onto a slot to plan your day. Calendar-imported tasks arrive already slotted at their real times. **✨ Auto-plan my day** fills the slots by priority in one click. Your Google Calendar events for the next two days sit alongside for reference.

---

## 12. Inbox

Press `C` anywhere and dump whatever's in your head. Every capture is auto-sorted into a life area by its words — University (exam, homework, GPA...), Career (apply, resume, recruiter...), Health (gym, BJJ, muay thai...), Finance (pay, tuition, rent...), Projects (build, CAD, prototype...), Knowledge (read, learn, course...), Goals, or Productivity — and links are detected. From the inbox, one click turns an item into a task or archives it. Below sits the full task board grouped by area, with a proper add-task form (area, due date, importance, duration).

---

## 13. Habits

Add any habit. Each shows the last 7 days as tappable cells, a 🔥 current streak counter, and appears on Today with a checkbox. Streaks count consecutive days backward from today (today being unchecked yet doesn't break it).

---

## 14. Focus

A deep-work timer: 25, 50, or 90 minutes, with the countdown mirrored in the browser tab title. Finish and it logs the session; stop early and it logs the real minutes (under 5 minutes isn't logged). It suggests what to focus on (your top task). History shows minutes today, hours this week, hours all time, and total sessions — which also feed the daily rundown and the 🧠 10-hour milestone.

---

## 15. Projects

Name a project, press ▶ Start when you work on it, ⏹ Stop when you're done — sessions are timed to the second, accumulated forever, and logged automatically. Add written log entries anytime ("printed bracket v3"); the last five show per project.

---

## 16. The server (what runs behind the scenes)

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

The server is threaded, so a slow market fetch or the one-time Google approval never freezes the rest of the app, and it can restart immediately after Ctrl+C. It refuses to serve any secret file over HTTP (`notion_token.txt`, `credentials.json`, `token.json`, `token_calendar.json`, `elevenlabs_key.txt`, `anthropic_key.txt`, `personal_data.json`, `.sync_state.json`, `notion_config.json`).

**The voice pipeline**: your text goes to ElevenLabs pinned to the Elise voice ID; if that voice isn't on your account it finds her by name or auto-adds her from the voice library; if all else fails it falls back to a standard voice, and the frontend falls back further to the browser's built-in voice — you always get audio.

---

## 17. Data, privacy, and cost

- **Everything personal lives on your Mac.** Tasks, prayers, income, habits, usage stats: `personal_data.json` + a browser localStorage backup. Job data lives in your Notion. Nothing is sent anywhere except the API calls you configured, each using its own key from your own account.
- **API keys** sit in plain files in the app folder, gitignored, never served, never leaving your machine except to their own service.
- **Cost**: the app, market data, calendar, and Notion are free. ElevenLabs has a free tier (~10 min of speech/month; $5/mo for more). The Claude conversation brain is pay-as-you-go — roughly half a cent per exchange, a few dollars a month with heavy daily use, and it's optional: without a key, Sarah still works with pattern matching.

---

## 18. Everyday flow

Morning: double-click `start.command`. Boot sequence, then Today. Your calendar has already become your plan. Hit "Read it to me" while making coffee. Through the day: check prayers as you pray (watch the ring fill), tell Sarah "just finished BJJ, made 60 bucks today" on your way out of the gym, capture stray thoughts with `C`, run Focus sessions for deep work, and keep the application pace bar green. Evening: the day-at-a-glance percentages tell you exactly what's left; clear them and get the perfect-day message. The all-time income counter and the milestones make the compounding visible.

---

## 19. Sarah 2.0 additions

Since this guide was written, five major phases shipped (full detail in ROADMAP.md):

- **Pattern engine**: Sarah learns your productive hours, strong and weak days,
  prayer consistency, habit difficulty, stale tasks, income rhythm, deep-work
  trends, training days, stalled goals and best resume version — locally, with
  zero setup — and weaves two observations into every daily rundown.
- **Weekly and monthly reviews**: automatic on Sundays or on demand ("review" /
  "monthly review"), with deltas, six-month trend graphs, suggestions, and voice.
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
- **💰 Finance**: expenses with budgets, savings goals, net worth with
  live-valued crypto holdings, six-month trends; markets mirrored in; voice
  expense logging.
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
