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

| # | Code | Date claimed | Time claimed | Timestamp (ISO) |
|---|------|--------------|--------------|-----------------|

It opens directly in Excel, Google Sheets, or Numbers.

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
