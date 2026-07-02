---
name: transfer business-date key
description: how a transfer's reporting date is derived, and the two places that must agree.
---

# Transfer business-date key

A transfer's reporting/period date is its **transferDate** (OCR-parsed or manually
entered), falling back to **createdAt** only when transferDate is missing or
unparseable. It is compared as a **UTC `YYYY-MM-DD`** string.

**Why:** transferDate is a nullable `text` column in mixed formats (YYYY-MM-DD from
manual/cash entry, or an OCR date string from scans). Statements were showing today's
date because scans with unreadable dates left transferDate null → fell back to
createdAt (today). Also client (statement) and server (all-agents summary) once used
different timezone bases (local en-CA vs UTC), so they disagreed at date boundaries.

**How to apply:** The key is computed in TWO places that must stay identical:
- client statement period filter (`effectiveDateKey`/`ymdUTC` in Statement.tsx)
- server `/agents/summary` range filter (`transferDateKey`/`ymdUTC` in agents.ts)
Both must prefer transferDate, fall back to createdAt, and format via UTC. Change them
in lockstep. Scanned dates are normalized to `YYYY-MM-DD` at capture time in Scan.tsx
(`toDateInput`) and the date field there is user-editable so a real date is always
stored.
