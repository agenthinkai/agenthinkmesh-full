# D5 — Decision Library (14 Types)

**Version:** 1.0.0
**Status:** ACTIVE — registered in `decisionTypeService.ts`

---

## Overview

The Decision Library defines the 14 decision types available to AgenThink Mesh through the Decision Twin Factory. Ten are platform-standard types; four are AI-company-specific additions registered for Customer Zero.

---

## Standard Decision Types (10)

| ID | Name | Category | Description |
|----|------|----------|-------------|
| `strategic-investment` | Strategic Investment | Strategic | Capital allocation for growth, M&A, or new capabilities |
| `market-entry` | Market Entry | Strategic | Entering a new geographic or vertical market |
| `product-launch` | Product Launch | Commercial | Launching a new product or major feature |
| `partnership` | Partnership | Commercial | Forming a strategic or commercial partnership |
| `regulatory-compliance` | Regulatory Compliance | Risk | Responding to regulatory requirements or changes |
| `capital-allocation` | Capital Allocation | Financial | Allocating budget across departments or initiatives |
| `risk-assessment` | Risk Assessment | Risk | Evaluating and mitigating identified risks |
| `pricing-strategy` | Pricing Strategy | Commercial | Setting or changing pricing for products/services |
| `operational-efficiency` | Operational Efficiency | Operational | Improving processes, reducing costs, or increasing throughput |
| `talent-strategy` | Talent Strategy | People | Workforce planning, compensation, and culture decisions |

---

## AI-Company-Specific Decision Types (4)

### DT-11: Talent Acquisition

| Attribute | Value |
|-----------|-------|
| ID | `talent-acquisition` |
| Category | People |
| Typical Timeline | 2–8 weeks |
| Key Metrics | Headcount impact, salary band, equity dilution, time-to-productivity |

**Description:** Hiring decisions for key technical and leadership roles. Includes evaluation of candidate fit, compensation structure, equity allocation, and team composition impact. Particularly relevant for AI researchers, ML engineers, and GCC market specialists.

**Council Routing:** CEO + CTO + CFO minimum. CAIO required for AI researcher hires.

---

### DT-12: Partnership

| Attribute | Value |
|-----------|-------|
| ID | `partnership` |
| Category | Commercial |
| Typical Timeline | 4–12 weeks |
| Key Metrics | Revenue potential, strategic value, exclusivity risk, integration cost |

**Description:** Forming strategic, commercial, or technology partnerships. Includes cloud provider agreements, enterprise customer co-development, government MoU, and distribution partnerships. GCC-specific considerations include sovereign AI alignment and data residency.

**Council Routing:** CEO + GCC Head minimum. Legal required for any exclusivity clause.

---

### DT-13: Pricing Strategy

| Attribute | Value |
|-----------|-------|
| ID | `pricing-strategy` |
| Category | Commercial |
| Typical Timeline | 1–4 weeks |
| Key Metrics | ARR impact, NRR effect, competitive positioning, churn risk |

**Description:** Setting, changing, or differentiating pricing for Decision Twin Factory, Jupiter Shot, or other products. Includes enterprise contract pricing, usage-based pricing design, and promotional pricing decisions.

**Council Routing:** CEO + CFO minimum. GCC Head required for enterprise contract pricing.

---

### DT-14: Model Deployment

| Attribute | Value |
|-----------|-------|
| ID | `model-deployment` |
| Category | Technical |
| Typical Timeline | 1–2 weeks |
| Key Metrics | Benchmark scores, latency, cost per token, safety evaluation status |

**Description:** Deploying a new model version or capability to production. Requires benchmark evidence above minimum thresholds and a completed safety evaluation. Includes decisions about model versioning, rollout strategy, and customer communication.

**Council Routing:** CTO + CAIO mandatory. Legal required if deployment involves customer data processing changes.

---

## Decision Type Usage Guidelines

All 14 decision types are available to AgenThink Mesh. When creating a new decision session, select the most specific applicable type. If a decision spans multiple types (e.g., a partnership that also involves a pricing change), use the primary type and note the secondary type in the decision context.

---

*Registered in `server/lib/decisionTypeService.ts` FALLBACK_DECISION_TYPES*
