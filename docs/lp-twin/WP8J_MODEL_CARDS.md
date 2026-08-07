# LP Twin v1 — Model Cards

**Version:** 1.0.0
**Status:** APPROVED FOR USE
**Last Updated:** 2026-08-07

> These model cards describe the 6 engines that power LP Twin v1.
> All outputs are synthetic simulations. No engine has been validated against real allocator responses.
> Validation data collection begins with the founding customer engagement (WP7).

---

## Engine 1: LP Agent Bank v1

**File:** `shared/captwin/agentBank.ts`
**Version:** `1.0.0`
**Type:** Static archetype registry

### What it does
Defines 9 synthetic institutional LP archetypes with 26 attributes each. Provides the
data foundation for all scoring and simulation engines.

### Segments

| ID | Name | Type |
|---|---|---|
| `swf-001` | Sovereign Wealth Fund | Sovereign Wealth Fund |
| `ppf-001` | Public Pension Fund | Public Pension Fund |
| `cpf-001` | Corporate Pension Fund | Corporate Pension Fund |
| `ins-001` | Insurance Company | Insurance Company |
| `sfo-001` | Single Family Office | Single Family Office |
| `mfo-001` | Multi-Family Office | Multi-Family Office |
| `end-001` | University Endowment | Endowment |
| `ifa-001` | Islamic Finance Allocator | Islamic Finance |
| `dfo-001` | Development Finance Institution | Development Finance |

### Data sources
Constructed from publicly available information about institutional investor behaviour,
including ILPA guidelines, institutional investor surveys, academic research on LP
decision-making, and public LP disclosure documents.

### Known limitations
- Archetypes are generalisations — individual LPs within each category vary significantly
- No archetype has been validated against real LP responses
- Geographic and cultural nuances within each category are not fully captured
- Sharia compliance scoring is simplified and does not substitute for a qualified Sharia adviser
- Development Finance Institution archetype is based on limited public data

### Validation status
**NOT VALIDATED** — Validation data collection begins with the founding customer engagement.

### Version history
- `1.0.0` (2026-08-07): Initial release with 9 segments and 26 attributes

---

## Engine 2: Fit Engine v2

**File:** `shared/captwin/fitEngine.ts`
**Version:** `2.0.0`
**Type:** Deterministic weighted scoring

### What it does
Scores a fund profile against an LP archetype across 18 dimensions. Returns an overall
fit score (0–100), a fit category (strong/moderate/weak/poor), confidence level,
evidence gaps, and disqualifying issues.

### Scoring dimensions (18)

| # | Dimension | Weight | Notes |
|---|---|---|---|
| 1 | Strategy alignment | 15% | Fund strategy vs LP mandate |
| 2 | Fund size | 10% | Target size vs LP ticket range |
| 3 | Track record | 12% | Years, IRR, MOIC vs LP thresholds |
| 4 | Economics | 8% | Fees and carry vs LP benchmarks |
| 5 | Geography | 8% | Fund geography vs LP preference |
| 6 | Vintage timing | 5% | Market cycle positioning |
| 7 | Liquidity terms | 7% | Fund life vs LP liquidity needs |
| 8 | Institutional requirements | 6% | ILPA, reporting, governance |
| 9 | ESG alignment | 5% | ESG policy vs LP requirements |
| 10 | Sharia compliance | 6% | Only relevant for ifa-001 |
| 11 | Impact mandate | 4% | Only relevant for dfo-001 |
| 12 | Concentration risk | 3% | Sector concentration vs LP limits |
| 13 | GP pedigree | 5% | Team background vs LP preferences |
| 14 | Co-investment rights | 3% | Availability vs LP appetite |
| 15 | Minimum ticket | 4% | Min ticket vs LP allocation size |
| 16 | Domicile | 3% | Fund domicile vs LP restrictions |
| 17 | Currency | 3% | Fund currency vs LP base currency |
| 18 | Evidence completeness | 3% | Completeness of fund profile data |

### Fit categories
- **Strong** (75–100): High probability of proceeding to diligence
- **Moderate** (50–74): Likely to engage with conditions
- **Weak** (25–49): Significant barriers; targeted positioning required
- **Poor** (0–24): Fundamental misalignment; not recommended to approach

### Known limitations
- Weights are based on expert judgment, not empirical calibration
- Confidence is reduced when evidence fields are incomplete
- Sharia scoring is simplified (binary compliant/non-compliant)
- Does not model LP portfolio construction constraints
- Does not model LP relationship history or prior fund exposure

### Validation status
**NOT VALIDATED** — Weights and thresholds have not been calibrated against real LP responses.

### Version history
- `2.0.0` (2026-08-07): 18-dimension engine replacing v1 3-dimension engine
- `1.0.0` (2026-07): Initial 3-dimension prototype (deprecated)

---

## Engine 3: Objection Engine v2

**File:** `shared/captwin/objectionEngine.ts`
**Version:** `2.0.0`
**Type:** Deterministic rule-based objection registry

### What it does
Generates a structured list of likely objections for a given fund profile and LP archetype
combination. Each objection includes: statement, category, severity, curable status,
recommended response, and evidence required to address it.

### Objection categories (30)
Track record, fund size, economics, strategy, geography, team, liquidity, ESG, Sharia,
impact, governance, concentration, domicile, currency, evidence, co-investment, reporting,
ILPA, minimum ticket, market timing, pedigree, reference, legal, tax, regulatory,
benchmark, portfolio fit, relationship, mandate, and other.

### Known limitations
- Objections are generated from archetypes, not from real LP conversations
- Severity ratings are based on expert judgment
- Does not model LP-specific objections based on existing portfolio
- Does not model objections arising from GP reputation or market positioning

### Validation status
**NOT VALIDATED** — Objection categories and severity ratings have not been calibrated.

### Version history
- `2.0.0` (2026-08-07): 30-category engine replacing v1 prototype

---

## Engine 4: Scenario Engine v1

**File:** `shared/captwin/scenarioEngine.ts`
**Version:** `1.0.0`
**Type:** Deterministic differential recomputation

### What it does
Computes the impact of proposed fund-term changes on allocator fit scores. Takes a
baseline fund profile and a set of proposed term changes, recomputes fit scores for
each affected segment, and returns deltas, objection changes, and net impact.

### Key capabilities
- 35 adjustable fund-term fields
- Live preview (no database write) and saved scenarios
- Fundraising objectives model (10 objectives, transparent weights)
- Sequence engine (6 outreach templates)
- Market stress scenarios (12 conditions)
- Sensitivity analysis (single-dimension impact)
- Recommended fund configuration

### Known limitations
- Recomputation uses the same fit engine weights — limitations of Fit Engine v2 apply
- Does not model LP portfolio construction constraints
- Market stress scenarios are illustrative, not predictive
- Recommended configuration optimises for synthetic fit, not real LP appetite

### Validation status
**NOT VALIDATED** — Scenario deltas have not been validated against real LP responses.

### Version history
- `1.0.0` (2026-08-07): Initial release

---

## Engine 5: Meeting Engine v1

**File:** `shared/captwin/meetingEngine.ts`
**Version:** `1.0.0`
**Type:** Deterministic brief generation + LLM-assisted rehearsal

### What it does
Generates structured LP meeting briefs, evaluates GP responses to objections, and
simulates a multi-agent LP IC panel discussion.

### Components
- **Meeting brief generator:** Deterministic, based on fit scores and objection registry
- **Objection rehearsal evaluator:** Scores GP responses on 5 dimensions (directness, evidence quality, specificity, credibility, conciseness)
- **LP panel simulation:** 3-agent IC panel with LLM-generated questions and GP response evaluation

### Known limitations
- Meeting briefs are generated from synthetic archetypes, not real LP intelligence
- Rehearsal scoring is based on rubric criteria, not real LP feedback
- LP panel simulation uses LLM-generated responses — quality depends on LLM
- Does not model LP relationship dynamics or prior fund history

### Validation status
**NOT VALIDATED** — Brief quality and rehearsal scoring have not been validated.

### Version history
- `1.0.0` (2026-08-07): Initial release

---

## Engine 6: Validation Engine v1

**File:** `shared/captwin/validationEngine.ts`
**Version:** `1.0.0`
**Type:** Comparison and quality scoring

### What it does
Compares synthetic LP archetype outputs against human validator responses. Computes
agreement metrics across 5 dimensions and produces a validation quality score.

### Agreement dimensions
1. Verdict agreement (invest/conditional/decline)
2. Objection overlap (shared objections / total objections)
3. Evidence request overlap
4. Terms challenged overlap
5. Confidence calibration (|synthetic_confidence - human_confidence|)

### Validation quality score labels
- **insufficient** (< 5 comparisons): Not enough data
- **early** (5–19 comparisons, < 40% agreement): Early-stage data
- **developing** (20–49 comparisons, ≥ 40% agreement): Developing evidence base
- **established** (50–99 comparisons, ≥ 60% agreement): Established evidence base
- **validated** (≥ 100 comparisons, ≥ 75% agreement): Validated (external review required)

### Known limitations
- Agreement metrics measure consistency, not accuracy
- A high agreement rate does not prove the archetypes are correct
- Validation requires independent external review before "validated" label is used commercially
- Human validator responses may themselves be biased

### Validation status
**OPERATIONAL** — Engine is functional. No validation data collected yet.

### Version history
- `1.0.0` (2026-08-07): Initial release

---

## Commercial Claims Policy

The following claims are **PROHIBITED** until the corresponding evidence threshold is met:

| Prohibited claim | Required evidence |
|---|---|
| "LP Twin predicts LP behaviour" | ≥ 100 comparisons, ≥ 75% agreement, external review |
| "LP Twin is validated" | Same as above |
| "LP Twin improves fundraising outcomes" | Longitudinal study with control group |
| "LP Twin is accurate" | Validated label achieved |
| "LP Twin replaces placement agents" | Never — this claim is permanently prohibited |

The following claims are **PERMITTED**:

| Permitted claim | Basis |
|---|---|
| "LP Twin generates evidence-based synthetic simulations" | Accurate description of methodology |
| "LP Twin identifies likely objections based on institutional archetypes" | Accurate |
| "LP Twin helps GPs prepare for LP meetings" | Accurate |
| "LP Twin models the impact of fund-term changes on synthetic fit scores" | Accurate |
| "LP Twin is not validated against real LP responses" | Required disclosure |
