#!/usr/bin/env python3
"""
Tracker diagnostic: finds out exactly where applications go missing.

Run it from the ApplyAI folder:

    python3 diagnose_tracker.py

It talks to Notion with the same token and database the app uses, counts
everything at each stage of the pipeline, and reports where rows are lost.
Nothing is written or changed; it is read-only.
"""
import json
import os
import sys

sys.argv = [sys.argv[0]]  # keep notion_server from reading a port argument
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import notion_server as ns  # noqa: E402


def rule(title):
    print("\n" + "=" * 68)
    print(title)
    print("=" * 68)


def main():
    token, db = ns.load_token_and_db()
    if not token:
        print("No Notion token found. Expected notion_token.txt or NOTION_TOKEN.")
        return 1
    print(f"Database id : {db}")
    print(f"Token       : {token[:7]}…{token[-4:]} ({len(token)} chars)")
    print(f"API version : {ns.NOTION_VERSION}")

    import requests
    headers = {"Authorization": f"Bearer {token}",
               "Notion-Version": ns.NOTION_VERSION,
               "Content-Type": "application/json"}

    # ---- 1. what does the database look like? ----
    rule("1. DATABASE SCHEMA (what properties the app can see)")
    meta = requests.get(f"https://api.notion.com/v1/databases/{db}", headers=headers, timeout=25)
    if meta.status_code != 200:
        print(f"  Could not read the database: HTTP {meta.status_code}")
        print(f"  {meta.text[:300]}")
        return 1
    mj = meta.json()
    title = "".join(t.get("plain_text", "") for t in mj.get("title", []))
    print(f"  Title: {title!r}")
    props = mj.get("properties", {})
    for name, p in props.items():
        print(f"    - {name!r}: {p.get('type')}")
    if mj.get("is_inline"):
        print("  (inline database)")

    # ---- 2. raw pagination straight from Notion ----
    rule("2. RAW ROWS FROM NOTION (with pagination)")
    results, cursor, pages = [], None, 0
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        r = requests.post(f"https://api.notion.com/v1/databases/{db}/query",
                          headers=headers, json=body, timeout=30)
        if r.status_code != 200:
            print(f"  HTTP {r.status_code}: {r.text[:300]}")
            return 1
        d = r.json()
        got = d.get("results", [])
        pages += 1
        results.extend(got)
        print(f"  page {pages}: {len(got)} rows (has_more={d.get('has_more')})")
        if d.get("has_more"):
            cursor = d.get("next_cursor")
        else:
            break
    print(f"  TOTAL ROWS NOTION RETURNED: {len(results)}")

    trashed = sum(1 for p in results if p.get("archived") or p.get("in_trash"))
    if trashed:
        print(f"  ...of which Notion marks archived/trashed: {trashed}")

    # ---- 3. what the app's own fetch returns ----
    rule("3. WHAT THE APP'S FETCH RETURNS")
    ns._cache["data"] = None  # bypass the 20s cache
    out = ns.fetch_applications()
    if "error" in out:
        print(f"  ERROR: {out}")
        return 1
    apps = out["applications"]
    print(f"  Applications the server hands the dashboard: {len(apps)}")
    if len(apps) != len(results):
        print(f"  !! MISMATCH: Notion had {len(results)}, server produced {len(apps)}")
    else:
        print("  Matches the raw Notion count.")

    # ---- 4. field quality ----
    rule("4. FIELD QUALITY (how well properties were detected)")
    unknown = [a for a in apps if a["company"] == "Unknown"]
    nodate = [a for a in apps if not a["date"]]
    nostatus = [a for a in apps if not a["status"]]
    nocountry = [a for a in apps if not a["country"]]
    noposition = [a for a in apps if not a["position"]]
    print(f"  Blank company (shown as 'Unknown') : {len(unknown)}")
    print(f"  Blank application date             : {len(nodate)}")
    print(f"  Blank status  (dashboard calls these 'Applied'): {len(nostatus)}")
    print(f"  Blank country (dashboard calls these 'Other')  : {len(nocountry)}")
    print(f"  Blank position                     : {len(noposition)}")
    for label, sample in (("company", unknown), ("status", nostatus)):
        if sample:
            print(f"    e.g. missing {label}: " +
                  ", ".join(repr(a["company"]) for a in sample[:5]))

    statuses = {}
    for a in apps:
        statuses[a["status"] or "(blank)"] = statuses.get(a["status"] or "(blank)", 0) + 1
    print("  Status values coming from Notion:")
    for k, v in sorted(statuses.items(), key=lambda kv: -kv[1]):
        print(f"    {v:5}  {k!r}")

    # ---- 5. the collision check: the dashboard's override key ----
    rule("5. DUPLICATE KEY CHECK  <-- the likely culprit")
    print("  The dashboard identifies a row by company|position (lowercased).")
    print("  Rows that share a key share one saved edit, so archiving or editing")
    print("  one of them hits every other row with the same key.\n")
    keys = {}
    for a in apps:
        k = (a["company"] + "|" + (a["position"] or "")).lower()
        keys.setdefault(k, []).append(a)
    dupes = {k: v for k, v in keys.items() if len(v) > 1}
    total_dupe_rows = sum(len(v) for v in dupes.values())
    print(f"  Distinct keys              : {len(keys)}")
    print(f"  Keys used by >1 application: {len(dupes)}")
    print(f"  Applications sharing a key : {total_dupe_rows}")
    if dupes:
        hidden = total_dupe_rows - len(dupes)
        print(f"  If any of these were archived, up to {hidden} real applications")
        print("  would disappear from the dashboard together.")
        print("\n  Worst offenders:")
        for k, v in sorted(dupes.items(), key=lambda kv: -len(kv[1]))[:12]:
            dates = ", ".join(sorted(x["date"][:10] for x in v if x["date"])[:6])
            print(f"    {len(v):3}x  {k[:58]:58}  {dates}")

    # ---- 6. summary ----
    rule("6. SUMMARY")
    print(f"  Notion rows                 : {len(results)}")
    print(f"  Delivered to the dashboard  : {len(apps)}")
    print(f"  Rows sharing an identity key: {total_dupe_rows}")
    print("\n  Next: in the browser, open the app, press Cmd+Option+J and run")
    print("        Object.values(JSON.parse(localStorage.jd_overrides||'{}'))")
    print("          .filter(o=>o.archived).length")
    print("  That prints how many identity keys are archived on this machine.")
    print("  Multiply by the duplicates above and you have the rows being hidden.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
