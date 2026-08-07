# LP Twin v1 — Success Metrics Framework

**Version:** 1.0.0
**Status:** APPROVED
**Last Updated:** 2026-08-07

---

## Product Success Metrics

### Tier 1: Engagement (measurable from day 1)

| Metric | Definition | Target (90 days) |
|---|---|---|
| Fund profiles created | Count of `lp_twin_funds` records | ≥ 1 per founding customer |
| Simulations run | Count of `lp_twin_sessions` with status=completed | ≥ 3 per founding customer |
| Segments analysed | Count of `lp_twin_segment_results` records | ≥ 27 (3 sessions × 9 segments) |
| Scenarios created | Count of `lp_twin_scenarios` records | ≥ 2 per founding customer |
| Meeting briefs generated | Count of meeting brief procedure calls | ≥ 3 per founding customer |
| Ask-an-LP queries | Count of `lp_twin_ask_lp` records | ≥ 5 per founding customer |
| Reports generated | Count of report procedure calls | ≥ 2 per founding customer |
| Pipeline entries | Count of `lp_twin_actual_meetings` records | ≥ 3 per founding customer |

### Tier 2: Validation (measurable after real LP meetings)

| Metric | Definition | Target (90 days) |
|---|---|---|
| Actual meetings recorded | Count of `lp_twin_actual_meetings` records | ≥ 3 per founding customer |
| Validation participants | Count of `lp_twin_validation_participants` records | ≥ 1 |
| Human responses collected | Count of `lp_twin_human_responses` records | ≥ 3 |
| Comparisons completed | Count of `lp_twin_validation_comparisons` records | ≥ 3 |
| Validation quality score | `validationEngine.computeQualityScore()` label | Reach "early" (≥ 5 comparisons) |

### Tier 3: Outcome (measurable after fundraising campaign)

| Metric | Definition | Target |
|---|---|---|
| LP meetings held | Count of actual meetings recorded | ≥ 5 |
| Soft circles | Count of pipeline entries with status=soft_circle | ≥ 1 |
| Founding customer NPS | Net Promoter Score from feedback session | ≥ 7/10 |
| Accuracy rating | Founding customer's subjective rating of synthetic outputs | Collected (no target) |

---

## Technical Success Metrics

| Metric | Target | Current |
|---|---|---|
| LP Twin test suite | 222/222 passed | ✓ 222/222 |
| Pen-test suite | 35/35 passed | ✓ 35/35 |
| TypeScript errors | 0 | ✓ 0 |
| Prohibited commercial claims | 0 | ✓ 0 |
| Cross-tenant access attempts blocked | 100% | ✓ 100% |
| Consent revocation enforcement | 100% | ✓ 100% |

---

## Validation Accuracy Milestones

These milestones define when LP Twin can make progressively stronger accuracy claims:

| Milestone | Requirement | Permitted claim |
|---|---|---|
| M0 (current) | 0 comparisons | "Evidence-based synthetic simulation" |
| M1 | ≥ 5 comparisons | "Early validation data collected" |
| M2 | ≥ 20 comparisons, ≥ 40% agreement | "Developing evidence base" |
| M3 | ≥ 50 comparisons, ≥ 60% agreement | "Established evidence base" |
| M4 | ≥ 100 comparisons, ≥ 75% agreement + external review | "Validated against real LP responses" |

**Current milestone: M0**

---

## Commercial Success Metrics

| Metric | Definition | Target (12 months post-launch) |
|---|---|---|
| Paying customers | Orgs with active LP Twin subscription | ≥ 3 |
| Monthly active simulations | Sessions run per month across all orgs | ≥ 20 |
| Annual recurring revenue | LP Twin subscription revenue | > $0 (first commercial customer) |
| Customer retention | % of customers renewing after 12 months | ≥ 80% |
| Validation data contributors | Orgs contributing actual LP response data | ≥ 1 |

---

## Review Cadence

| Review | Frequency | Participants |
|---|---|---|
| Engagement metrics | Weekly | Engineering |
| Validation metrics | Monthly | Engineering + founding customer |
| Commercial metrics | Quarterly | Leadership |
| Accuracy milestone review | When M1 threshold is reached | Engineering + external reviewer |

