# SARAH 2.0 — Roadmap

North star: not more pages, a smarter Sarah. An executive assistant that thinks ahead,
learns patterns automatically, and gets more useful over time. JARVIS identity,
local-first architecture, and instant-feel performance are non-negotiable. Every
feature must answer yes to: "does this genuinely help make better decisions and
execute life more effectively?"

## Phase 1 — The intelligence layer ✅ (shipped)

- **Pattern engine (long-term memory)**: learns from existing data with zero setup and
  zero API cost — productive hours, strongest/weakest weekdays, prayer consistency and
  which prayer slips, easiest/hardest habits, stale tasks, income rhythm and best
  earning day, deep-work trend vs 3-week average, usual training days, stalled goals,
  best-converting resume version. Cached per day, recomputed only when data changes.
- **Proactive briefing**: two learned observations woven into the daily rundown,
  rotating daily.
- **Weekly review**: auto-appears Sundays (or on demand via "review" in the command
  bar or voice). Tasks, deep work, habits, prayers, income, applications, interviews,
  project time — each with last-week deltas — plus strongest/weakest day, biggest
  improvement, weakest area, and concrete suggestions. Speakable.
- **Executive-assistant personality** for the conversational brain, with learned
  patterns passed as context so Sarah references them naturally and challenges
  decisions when warranted.
- **Performance foundation**: render only the visible pane, keep the header live via a
  light path, suspend calendar/market polling and the clock while the tab is hidden,
  refresh immediately on return. Usage telemetry retention extended to 90 days for
  pattern learning.

## Phase 2 — Training ✅ (shipped, simplified July 2026)

Goal: complete athlete (lean muscle, visible abs, explosiveness for football/Muay
Thai/BJJ, joint durability, proper recovery), not bodybuilding. Tracking is
deliberately minimal: show up and check the box, exactly like prayers.

- Weekly split planner (Mon Upper A + Muay Thai, Tue Lower Strength + BJJ, Wed
  Recovery & Mobility, Thu Upper B + BJJ, Fri Muay Thai then Lower Power +
  Athletic Work, Sat & Sun Rest); today's sessions on Today as plain checkboxes.
- Train tab: today's checkboxes, a week view marking every scheduled session as
  went / missed / upcoming, attendance performance (this week %, last 30 days %,
  sessions attended, missed-session list), and the full weekly plan with
  exercise lists as a read-only reference.
- The same attendance treatment for prayers (Faith) and languages (Mind) on the
  Today page: Monday-to-Sunday dots plus weekly and 30-day percentages.
- BJJ skill path: a 10-week curriculum on the Train tab, one skill per week
  (Closed Guard, Guard Passing, Side Control, Mount, Back Control, Open Guard,
  Half Guard, Standing, Straight Ankle Locks, Submission Defenses), each with its
  concrete techniques as checkboxes. A skill is "mastered" when all its
  techniques are checked; the card tracks overall percentage, skills mastered,
  and the current week, auto-highlighting the next unmastered skill as the focus.
- The earlier set-by-set logging system (e1RM, PRs, overload recommendations,
  fatigue/recovery scores, deloads, bodyweight) was removed by design in July
  2026: it was more than the training habit needed.

## Phase 3 — Finance ✅ (shipped)

- Dedicated Finance tab: this-month overview (income, spent, net + savings rate,
  net worth) with inline insights; expense logging with categories and delete;
  editable monthly budgets per category with over-budget warnings; savings goals
  with deposits and progress; net worth from assets and debts with crypto holdings
  valued live from the market feed; six-month income-vs-spending trend; markets
  card mirrored into Finance. Voice: "I spent 35 on gas", "how much did I spend",
  "what's my net worth". Claude gains a log_expense action and a finance state
  snapshot. Budget/overspend insights feed the pattern engine and daily briefing.
  The Today income card keeps feeding the same income log.

## Phase 4 — Knowledge base ✅ (shipped)

- 📚 Docs tab: upload PDFs, Word docs, notes, slides and images (drag-and-drop or
  picker, 25 MB per file). Files live in ./knowledge on your machine, gitignored
  and never served over HTTP. Text extracted locally (txt/md natively, docx via
  the stdlib, PDF via optional pypdf). Ask questions in the tab or by voice
  ("what did my advisor recommend?"); retrieval is local keyword scoring, and only
  the matching excerpts are sent to Claude, which answers citing the document.
  Without an AI key you still get the best matching passages.

## Phase 5 — Consolidation & monthly reviews ✅ (shipped)

- Monthly reviews: week/month toggle on the review card, month-over-month deltas
  (tasks, deep work, habits, prayers, income, spending, applications, lifting
  sessions) plus six-month trend graphs for tasks, deep work and income. Open with
  "monthly review" in the command bar or by voice; speakable.
- Language tracker generalized: the Mind category now tracks a language lesson
  plus a generic immersion session; customize the immersion item anytime with
  "mind: <label>" in the command bar. Old data keeps counting.
- Module boundaries (the intended split): Tasks are one-off actions; Habits are
  daily repeatables; Goals decompose ambitions into phased actions that feed
  Today; Planner is time-boxing for today only; Projects are long-running efforts
  measured in tracked hours; Train owns physical performance; Finance owns money.
  Everything surfaces on Today, which remains the center of the app.

## Phase 6 — Resume Match Analyzer ✅ (shipped)

- 🎯 Resume Match tab. One resume is stored (PDF/DOCX, uploaded, replaceable,
  previewable, removable); text is extracted locally the same way the knowledge
  base does it. Paste any job description, hit Analyze Job, and Claude returns a
  structured recruiter-grade review: APPLY NOW / APPLY IF YOU HAVE TIME / SKIP
  with an overall score, an eight-category score breakdown, eligibility checks
  (matches, concerns, deal breakers), strong/partial/missing skills, a
  requirement-by-requirement experience comparison, ATS matched/missing keywords
  with concrete rewrites, resume improvements, red flags, career-value ratings,
  interview probability, application effort, a confidence percentage, and the
  expected match after tailoring with the exact changes that produce it.
- Six one-click AI actions: rewrite resume for this job, cover letter, keyword
  optimization, recruiter outreach, interview prep, explain the job description.
- Privacy by construction: only the resume is persisted. Job descriptions,
  analyses and AI action output exist in the open page and the request only —
  never written to disk, never in personal_data.json, and erased from memory by
  "Analyze another job" or "Done". Export to PDF or copy to clipboard first if
  you want to keep one.

## Later ideas (unscheduled)

- Journal, spaced-repetition flashcards, richer language stats, deeper knowledge
  base (embeddings), auto-start at login packaging.

## Standing performance requirements (apply to every phase)

Instant-feeling UI; low CPU/RAM; no unnecessary background work; poll only what the
visible page needs; lazy-load heavy modules; debounce expensive operations; batch
updates; stay fast after years of data (thousands of tasks, years of history); prefer
local computation, call AI services only when genuinely necessary; cache aggressively;
simple maintainable code, no unnecessary dependencies.
