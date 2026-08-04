# Lyft Ride Codes — how this works

Two pieces, deliberately kept apart so the codes never reach the internet.

| | What it is | Where it lives | Contains codes? |
|---|---|---|---|
| **Claim page** (`index.html`) | What the customer's phone opens after scanning | Public, on GitHub Pages | **No — none at all** |
| **Dispenser** (`lyft-dispenser.html`) | The staff tool that hands out codes | Your counter device only | Yes — all 1,400 |

## Why this is safe

The claim page holds no code list. It only displays the single code passed to it
in the link fragment (`…/#c=ABC123XYZ`). Two properties make that safe:

- **Anyone opening the page directly sees nothing** — just "Nothing to show here".
  There is no list to scrape, because the list isn't there.
- **Fragments are never sent to the web server.** Everything after `#` stays in
  the visitor's own browser, so GitHub never receives or logs a single code.

The dispenser file — the one with all 1,400 codes — is never committed to this
repository and is never hosted. It sits on your device. `.gitignore` blocks it
from being committed by accident.

## Day-to-day use

1. Open **`lyft-dispenser.html`** on your counter device (double-click it, or
   bookmark it after opening once).
2. Tap **🚗 Get Ride Code**. A code appears with a QR code.
3. The customer scans the QR. Their phone opens the claim page showing **just
   that one code**, already copied to their clipboard, with a big **Copy code**
   button and the steps to add it in the Lyft app.
4. The code is marked used automatically — the same one never comes out twice.

The dispenser already knows the claim page address, so there is nothing to
configure. It works offline too: the QR still points at the public claim page
even when the dispenser device has no internet.

## Getting your records out

Tap **⬇ Download used codes (spreadsheet)**. You get a CSV of every code handed
out:

| # | Code | Date claimed | Time claimed | Timestamp (UTC) |
|---|------|--------------|--------------|-----------------|
| 1 | EXAMPLE01 | 08/02/2026 | 4:11:20 AM EDT | 2026-08-02T08:11:20.247Z |

(`EXAMPLE01` is a placeholder — never put a real code in this file.)

It opens directly in Excel, Google Sheets, or Numbers.

**Times are recorded in State College, PA local time** (`America/New_York`), not
in whatever time zone the dispensing device happens to be set to — so the record
is right even if you use a travel laptop or a tablet with a wrong clock. Daylight
saving is handled automatically, and the time column is labelled **EDT** or
**EST** so a row is never ambiguous. The final column keeps the exact UTC instant
for precise sorting.

## Usage calendar (📅 in the top bar)

A month grid showing how many codes went out each day, with a **Week** column on
the right for weekly totals and a running total for the month at the top.

- **Tap any highlighted day** — see every code given out that day with its exact
  time.
- **Tap a week total** — same, for that whole week.
- **Tap the month box** — same, for the whole month.
- Each of those views has a **⬇ Download these** button, so you can pull a
  spreadsheet for just that day, week, or month.
- **‹ ›** move between months; **Today** jumps back to the current one.

Days are grouped by **State College (Eastern) date**, so a code handed out at
11:30pm files under that day — not the next one, which is what would happen if
the app used UTC.

Nothing extra is being recorded for this: the calendar reads the same history the
spreadsheet does, so it already covers every code you have ever dispensed.

## Back up your used-codes list

The record of which codes are spent lives in the browser on your counter device.
If that browser's data is cleared, you lose track and could hand out duplicates.

**Once a week, tap Manage → Backup all** and keep the file. Restoring takes seconds.

## Manage panel

- Search any code, see whether it's Available or Given
- Mark given / restore individual codes
- Download spreadsheet, backup, restore, reset
- **Customer link** — only needed if you ever move the claim page to a different
  address; the dispenser ships pointing at the right one already.

## If you get a new batch of codes

Send the new list over and it gets rebuilt into a fresh dispenser file. Nothing
about the public claim page changes.
