# LP Twin v1 — Commercial Claims Review

**Version:** 1.0.0
**Status:** APPROVED
**Last Updated:** 2026-08-07

> This document records the commercial claims review performed as part of WP8.
> All LP Twin marketing materials, UI copy, and documentation must comply with this review.

---

## Review Scope

All user-facing text in:
- LP Twin frontend pages (LPTwin.tsx, LPTwinSession.tsx, LPTwinFundDetail.tsx, etc.)
- Backend procedure responses (disclaimers in runSegmentAnalysis, askLp, etc.)
- Documentation files (WP8G, WP8H, WP8J, etc.)
- Model cards (WP8J)

---

## Required Disclaimers

The following disclaimer MUST appear on every simulation result, export, and report:

> **SYNTHETIC SIMULATION** — These outputs are evidence-based synthetic simulations
> derived from anonymised institutional archetypes. They are not validated predictions
> of real allocator behaviour. Do not rely on these outputs as investment advice.

**Verified present in:**
- `runSegmentAnalysis` procedure response: ✓
- `askLp` procedure response: ✓
- `exportSession` payload: ✓
- `generateReport` procedure response: ✓
- `computeScenario` procedure response: ✓
- `generateMeetingBrief` procedure response: ✓

---

## Prohibited Claims — Audit Results

The following prohibited claims were searched for in all LP Twin source files:

| Prohibited phrase | Found | Action |
|---|---|---|
| "predicts LP behaviour" | No | — |
| "validated against real" | No | — |
| "improves fundraising outcomes" | No | — |
| "replaces placement" | No | — |
| "guaranteed" | No | — |
| "accurate prediction" | No | — |
| "proven to" | No | — |

**Result: No prohibited claims found in LP Twin source files.**

---

## Permitted Claims — Verification

| Claim | Location | Verified |
|---|---|---|
| "evidence-based synthetic simulations" | All result panels | ✓ |
| "not validated predictions" | All disclaimers | ✓ |
| "do not rely on these outputs as investment advice" | All disclaimers | ✓ |
| "synthetic LP archetypes" | Agent Bank view | ✓ |
| "Synthetic Demonstration Fund" | Demo fund GP name | ✓ |

---

## Accuracy Labels

All LP Twin outputs use the following accuracy label system:

| Label | Meaning |
|---|---|
| `SYNTHETIC SIMULATION` | Output from deterministic engine, not validated |
| `AGREEMENT METRIC` | Comparison between synthetic and human responses |
| `NOT VALIDATED` | Engine has not been calibrated against real LP responses |
| `DEVELOPING` | Validation data collection in progress |
| `VALIDATED` | Reserved — requires ≥ 100 comparisons, ≥ 75% agreement, external review |

---

## Review Sign-Off

This review was performed as part of WP8 (Security, Regression Testing, and Pilot Readiness).

```
CLAIMS_REVIEW_ATTESTATION
  Review date: 2026-08-07
  Reviewer: AgenThinkMesh Engineering
  Prohibited claims found: 0
  Required disclaimers present: YES (all 6 locations)
  Accuracy labels consistent: YES
  Status: APPROVED
END_CLAIMS_REVIEW_ATTESTATION
```

