# D9 — Report Templates

**Version:** 1.0.0
**Status:** REGISTERED — registered in `reportRegistryService.ts`

---

## Report 1 — Daily Operating Rhythm

**Report Type ID:** `daily-operating-rhythm`
**Schedule:** Weekdays at 07:00 Kuwait time (04:00 UTC)
**Delivery:** Owner notification via `notifyOwner`
**Handler:** `server/scheduled/agenthinkDailyRhythm.ts`

### Template Structure

```
Subject: AgenThink Mesh — Daily Brief [DATE]

## Today's Decision Queue
[List of pending decisions with confidence scores and days open]

## KPI Alerts
[Any KPIs in warning or critical status]

## Yesterday's Activity
[Twin sessions started, decisions made, outcomes logged]

## Model Training Status
[Jupiter Shot latest checkpoint, training loss, GPU status]

## Action Items
[Decisions requiring attention today]
```

### Trigger Conditions

The daily rhythm handler fires on every weekday heartbeat and:
1. Queries `twinSessions` for sessions opened in the last 24 hours
2. Queries `outcomeLedger` for outcomes logged in the last 24 hours
3. Queries KPI thresholds for any metrics in warning/critical status
4. Generates a structured brief and sends via `notifyOwner`

---

## Report 2 — Weekly Performance Review

**Report Type ID:** `weekly-performance-review`
**Schedule:** Mondays at 08:00 Kuwait time (05:00 UTC)
**Delivery:** Owner notification via `notifyOwner`
**Handler:** `server/scheduled/agenthinkDailyRhythm.ts` (weekly branch)

### Template Structure

```
Subject: AgenThink Mesh — Weekly Review [WEEK]

## Decision Outcomes This Week
[Decisions made, council verdicts, confidence scores]

## KPI Trends (7-day)
[ARR, MRR, Burn, GPU Util, Model Accuracy — with direction arrows]

## Outcome Ledger Accuracy
[Decisions closed this week vs. predicted outcomes]

## Jupiter Shot Progress
[Training steps completed, benchmark improvements]

## Next Week Priorities
[Top 3 decisions pending, top 3 KPI risks]
```

---

## Report Generation Architecture

```
Heartbeat trigger (daily/weekly)
    ↓
agenthinkDailyRhythm.ts handler
    ↓
Query: twinSessions (last 24h / 7d)
Query: outcomeLedger (last 24h / 7d)
Query: KPI thresholds
    ↓
Generate structured brief (Markdown)
    ↓
notifyOwner({ title, content })
    ↓
Owner receives notification in Manus platform
```

---

*Registered in `server/lib/reportRegistryService.ts` FALLBACK_REPORT_TYPES*
*Handler: `server/scheduled/agenthinkDailyRhythm.ts`*
*Route: `POST /api/scheduled/agenthink-daily-rhythm`*
