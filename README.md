# ApplyAI

AI-powered job search platform with application tracking, resume optimization, and intelligent job matching — modeled after Jobright.ai.

ApplyAI aggregates real job postings from LinkedIn, Indeed, Glassdoor and 3,000+ boards, scores every job against your CV using AI, tracks applications through their full lifecycle, auto-detects email replies, and provides AI tools (cover letters, ATS optimization, interview prep, networking strategy, and a career-coach chat). It runs **frontend-only** with `localStorage` persistence — no backend or database required.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production build into dist/
npm run preview  # serve the production build
```

The entire app lives in a single file: **`src/App.jsx`**. Drop it into any React project (Vite, CRA, StackBlitz, CodeSandbox) and it runs identically.

## Configuration

The app works out of the box with **live job-board search links** and a 4-step onboarding flow. To unlock live postings, AI scoring, and Gmail tracking, add your API keys at the top of `src/App.jsx`:

```js
const RAPIDAPI_KEY = "..."; // rapidapi.com → JSearch (aggregates LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs)
const CLAUDE_KEY   = "..."; // console.anthropic.com → API Keys (job scoring, generation, classification, chat)
const GMAIL_CID    = "..."; // console.cloud.google.com → OAuth 2.0 Client ID (Web App, gmail.readonly)
const EMAILJS_SERVICE_ID  = ""; // emailjs.com (optional, email reminders)
const EMAILJS_TEMPLATE_ID = "";
const EMAILJS_PUBLIC_KEY  = "";
```

Graceful degradation when keys are missing:

| Missing key | Behavior |
| --- | --- |
| `RAPIDAPI_KEY` | Falls back to real LinkedIn/Indeed/Google search URLs per country (no mock data) |
| `CLAUDE_KEY` | CV stored as-is; AI tools show a "add your key" prompt; jobs go unscored |
| `GMAIL_CID` | Tracker works manually; auto email-detection disabled |

## Features

- **Onboarding** — 4-step setup: profile, target countries + daily goals, CV upload (AI profile extraction), launch.
- **Job Feed** — Jobright-style two-column search engine. Every job shows three real, clickable links (Apply / LinkedIn / Indeed), an animated AI score ring, and a detail panel with AI tools. Includes a Tinder-style swipe mode.
- **My Matches** — curated grid of all 60%+ matches, sorted by AI score.
- **Tracker** — full application pipeline with stats, status flow, and Gmail auto-detection of interviews / offers / rejections.
- **Resume AI** — Tailor Resume, ATS Checker, Cover Letter, and a profile viewer.
- **Insider** — referral strategy + personalized outreach email for any company.
- **Orion AI** — full-screen career-coach chat with conversation memory.
- **Dashboard** — daily per-country goal counters, weekly activity strip, and stats.
- **Settings** — edit profile/targets, re-upload CV (re-scores jobs), manage integrations, reset app.
- **11AM daily reminders** + browser notifications + glassmorphic toast stack.

All data — profile, jobs, scores, applications, and the Gmail token — persists in `localStorage` across sessions.

## Tech

React 18 · inline styles + an injected global CSS template · JSearch (RapidAPI) · Anthropic Claude API · Gmail API via Google Identity Services · Inter + Syne fonts.
