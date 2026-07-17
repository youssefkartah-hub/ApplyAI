# S.A.R.A.H. 2.0 — Roadmap

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

## Phase 2 — AI Athletic Performance System ✅ (shipped)

Goal: complete athlete (lean muscle, visible abs, explosiveness for football/Muay
Thai/BJJ, joint durability, proper recovery), not bodybuilding.

- Weekly split planner (Mon Upper A + MT, Tue Lower Strength + BJJ, Wed Recovery &
  Mobility, Thu Upper B + BJJ, Fri MT, Sat Lower Power/Athletic, Sun Rest); today's
  session on Today; adapts when combat sessions move.
- Workout library: every exercise with sets, rep ranges, notes; swap exercises within
  equivalent movement patterns while keeping progression.
- Logging: weight × reps per set; auto e1RM, PRs, weekly volume by muscle group.
- Progressive overload: top-of-range across all sets → recommend next weight.
- Fatigue management: combined load across lifting + combat + conditioning; warnings
  ("six hard days in a row") and encouragement when recovery is good.
- Deload every 6–8 weeks, automatic volume/intensity reduction with reasoning.
- Athletic dashboard: bodyweight trend, strength progression, consistency, fatigue and
  recovery estimates, combat/football session counts, volume by muscle group, streaks,
  measurements, PRs — long-term graphs.
- Injury prevention tracking (mobility, face pulls, rotator cuff, nordics, tibialis,
  calves, stretching, foam rolling) with nudges when skipped.
- AI coaching lines from real data ("pushing improving faster than pulling").

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

## Later ideas (unscheduled)

- Journal, spaced-repetition flashcards, richer language stats, deeper knowledge
  base (embeddings), auto-start at login packaging.

## Standing performance requirements (apply to every phase)

Instant-feeling UI; low CPU/RAM; no unnecessary background work; poll only what the
visible page needs; lazy-load heavy modules; debounce expensive operations; batch
updates; stay fast after years of data (thousands of tasks, years of history); prefer
local computation, call AI services only when genuinely necessary; cache aggressively;
simple maintainable code, no unnecessary dependencies.
