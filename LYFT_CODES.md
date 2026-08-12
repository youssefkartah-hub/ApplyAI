# Lyft Ride Codes — how this works

Two pieces, deliberately kept apart so the codes never reach the internet.

| | What it is | Where it lives | Contains codes? |
|---|---|---|---|
| **Claim page** (`index.html`) | What the customer's phone opens after scanning | Public, on GitHub Pages | **No — none at all** |
| **Dispenser** (`lyft-dispenser.html`) | The staff tool that hands out codes | Your counter device only | **No — you load your own** |
| **Your code list** | The codes themselves | This browser's local storage, on your device | Yes |

Neither file that changes hands ever contains a code. You load your list once,
on your own machine, and it is stored only in that browser — never uploaded,
never written back into the file. So the dispenser file is safe to copy, email
or back up.

## Loading your codes (first run)

Open the dispenser and it asks for your list. Either:

- **Choose my code list…** — pick a `.txt` or `.csv` file, or
- **Or paste the codes instead** — paste them straight in.

One code per line is ideal, but numbered lists (`1  EXAMPLE01`), commas, blank
lines and stray spaces are all handled. Duplicates are removed automatically.

To swap in a new batch later: **Manage → ⬆ Load / replace code list**. Codes
already given out stay marked as given.

## Why this is safe

The claim page holds no code list. It only displays the single code passed to it
in the link fragment (`…/#c=EXAMPLE01`). Two properties make that safe:

- **Anyone opening the page directly sees nothing** — just "Nothing to show here".
  There is no list to scrape, because the list isn't there.
- **Fragments are never sent to the web server.** Everything after `#` stays in
  the visitor's own browser, so GitHub never receives or logs a single code.

The dispenser file contains no codes either — your list lives only in that
browser's local storage. Neither file is ever committed to this repository, and
`.gitignore` plus a pre-commit hook block a code from being committed by accident.

## Day-to-day use

1. Open **`lyft-dispenser.html`** on your counter device (double-click it, or
   bookmark it after opening once).
2. Tap **🚗 Get Ride Code**. A code appears with a QR code.
3. The customer scans the QR. Their phone opens the claim page showing **just
   that one code**, already copied to their clipboard, with a big **Copy code**
   button and the steps to add it in the Lyft app.
4. Tap **✓ I gave this out** or **✗ I didn't**. That's what actually records it.

## The three states

Nothing is recorded as given until you confirm it, so the records match what
really happened at the counter rather than what you tapped.

| State | Icon | Meaning |
|---|---|---|
| **Not given out** | ○ | Still in the pool, will be dispensed later |
| **Pending** | ⏳ | Shown to a customer, waiting on your confirmation |
| **Given out** | ✓ | Confirmed and recorded, with a timestamp |

- **✓ I gave this out** — records it and returns to the ready screen for the next
  customer. This is the moment the timestamp is taken.
- **✗ I didn't** — the customer walked off, the scan failed, they changed their
  mind. The code goes straight back into the pool and will come out again.

If you walk away without confirming, the code stays **Pending** and an amber
banner appears on the main screen — tap **Review** to resolve it. Pending codes
are never handed out again in the meantime, so no one gets a duplicate.

In **Manage**, the chips **All / ○ Not given out / ⏳ Pending / ✓ Given out**
filter the list, and every code carries its status icon. You can change any
code's state by hand from there too.

Only confirmed codes appear in the spreadsheet and the calendar.

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

The backup contains your code list as well as the used history, so restoring on a
new device brings everything back in one step. **Treat that backup file as
sensitive** — unlike the dispenser, it does contain your codes. Keep it off
shared drives and out of email.

## Manage panel

- Search and filter by status: All, Not given out, Pending, Given out
- Change any individual code between given, pending and not given
- Download spreadsheet, backup, restore, reset
- **Customer link** — only needed if you ever move the claim page to a different
  address; the dispenser ships pointing at the right one already.

## If you get a new batch of codes

Do it yourself, and don't send the list anywhere: **Manage → ⬆ Load / replace
code list**, pick the new file, done. Codes already given out stay marked as
given, and nothing about the public claim page changes.
