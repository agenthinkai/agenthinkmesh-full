# D8 — Executive UX Specification

**Page:** AgenThink Mesh Executive Decision Twin Cockpit
**Route:** `/twin/agenthink`
**Component:** `client/src/pages/AgenThinkTwin.tsx`
**Status:** LIVE

---

## Overview

The AgenThink Mesh Executive Decision Twin Cockpit is a 3-panel dark-theme dashboard that provides the AgenThink leadership team with a real-time view of company health, pending decisions, and scenario analysis. It is the primary interface for the Customer Zero twin.

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: AgenThink Mesh — Executive Decision Twin               │
│  Status: LIVE | Blueprint: bp-agenthink | Stage: Pre-Series A   │
├──────────────────┬──────────────────────┬───────────────────────┤
│  Panel 1         │  Panel 2             │  Panel 3              │
│  Company         │  Decision Queue      │  Scenario             │
│  Overview        │                      │  Workspace            │
│                  │  Pending decisions   │                       │
│  KPI grid        │  with council        │  3 scenarios with     │
│  (5 groups)      │  status and          │  probability,         │
│                  │  confidence          │  impact, and          │
│  Health          │                      │  council verdict      │
│  indicators      │  Recent outcomes     │                       │
│                  │  from ledger         │  IC Verdict           │
└──────────────────┴──────────────────────┴───────────────────────┘
```

---

## Panel 1 — Company Overview

**Purpose:** Real-time company health dashboard showing KPI status across all 5 groups.

**Components:**

| Component | Data Source | Refresh |
|-----------|-------------|---------|
| ARR gauge | QuickBooks (static at launch) | Daily |
| MRR trend | QuickBooks (static at launch) | Daily |
| Burn/Runway | QuickBooks (static at launch) | Daily |
| GPU Utilisation | AWS Cost Explorer (static) | Hourly |
| Model Benchmark | Jupiter Shot (static) | Per run |
| Headcount | Manual (static) | Weekly |

**KPI Status Indicators:**
- Green: Metric is above "good" threshold
- Amber: Metric is between "warning" and "good" threshold
- Red: Metric is below "critical" threshold

---

## Panel 2 — Decision Queue

**Purpose:** Shows all pending and recently completed decisions, with council status and confidence scores.

**Components:**

| Component | Data Source |
|-----------|-------------|
| Pending decisions list | `trpc.twinFactory.sessions.list` |
| Council status per decision | `trpc.twinFactory.sessions.get` |
| Confidence score | Calculated from council votes |
| Recent outcomes | `trpc.outcomeLedger.list` |

**Decision Card Fields:**
- Decision title and type
- Council composition (which personas are active)
- Confidence score (0–100%)
- Status: PENDING / IN_COUNCIL / DECIDED / CLOSED
- Days open

---

## Panel 3 — Scenario Workspace

**Purpose:** Shows 3 strategic scenarios with probability estimates, financial impact, and council verdicts.

**Scenarios (Customer Zero):**

| Scenario | Description | Probability | Impact |
|----------|-------------|-------------|--------|
| Series A Raise | Raise $3M Series A at $15M pre-money | 65% | +18 months runway |
| Enterprise Anchor | Sign first $250K enterprise contract | 72% | ARR 2× |
| Jupiter Shot Milestone | Complete GPU validation, begin 1.3B training | 85% | Model capability gate |

**IC Verdict Component:**
- Overall recommendation (GO / CONDITIONAL GO / NO-GO)
- Confidence percentage
- Primary risk factor
- Council consensus summary

---

## Design Specifications

| Attribute | Value |
|-----------|-------|
| Theme | Dark (slate-900 background) |
| Accent Color | Indigo-500 / Indigo-400 |
| Typography | Inter (sans-serif) |
| Grid | 3-column responsive (collapses to 1 on mobile) |
| Status Indicators | Green/Amber/Red semantic colors |
| Charts | Chart.js (line charts for trends, gauge for KPIs) |

---

## Current Limitations

| Limitation | Status | Resolution |
|-----------|--------|------------|
| KPI data is static | GAP-009 | Live connector data pull Q4 2026 |
| Decision queue shows mock data if no sessions exist | Acceptable | Seed decisions via API |
| Scenario workspace uses hardcoded scenarios | Acceptable | Dynamic scenarios via twinFactory Q4 2026 |

---

*Component: `client/src/pages/AgenThinkTwin.tsx`*
*Route registered in `client/src/App.tsx` at `/twin/agenthink`*
