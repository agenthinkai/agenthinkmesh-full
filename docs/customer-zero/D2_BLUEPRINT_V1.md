# D2 — AgenThink Mesh Decision Twin Blueprint v1.0

**Blueprint ID:** `bp-agenthink`
**Version:** 1.0.0
**Industry:** `ai_company`
**Status:** ACTIVE — Customer Zero
**Registered:** 2026-08-03

---

## Overview

The AgenThink Mesh Blueprint defines the Decision Twin configuration for an AI-native company operating in the GCC. It specifies the council composition, decision routing rules, KPI set, connector manifest, and operating parameters that govern how the twin processes decisions.

---

## Blueprint Specification

```json
{
  "blueprintId": "bp-agenthink",
  "name": "AgenThink Mesh — Executive Decision Twin",
  "version": "1.0.0",
  "industryTag": "ai_company",
  "description": "Decision Twin blueprint for AgenThink Mesh — an AI-native company building sovereign intelligence infrastructure for GCC enterprises. Covers strategic, commercial, technical, and regulatory decisions.",
  "councilPersonaSetId": "ai_company",
  "kpiSetId": "ai_company",
  "ontologyId": "ai_company_gcc",
  "defaultCouncilMode": "FULL_COUNCIL",
  "decisionTypeIds": [
    "strategic-investment",
    "talent-acquisition",
    "partnership",
    "pricing-strategy",
    "model-deployment",
    "market-entry",
    "product-launch",
    "regulatory-compliance",
    "capital-allocation",
    "risk-assessment"
  ],
  "connectorIds": [
    "agenthink-quickbooks",
    "agenthink-hubspot",
    "agenthink-github",
    "agenthink-aws-cost",
    "agenthink-jupiter-shot"
  ],
  "reportTypeIds": [
    "daily-operating-rhythm",
    "weekly-performance-review"
  ],
  "operatingParameters": {
    "currency": "USD",
    "timezone": "Asia/Kuwait",
    "fiscalYearEnd": "12-31",
    "headcount": 12,
    "stage": "pre-series-a",
    "primaryMarket": "Kuwait",
    "secondaryMarkets": ["UAE", "Saudi Arabia", "Bahrain"]
  }
}
```

---

## Council Composition

| Role | Weight | Bias Profile | Primary Focus |
|------|--------|--------------|---------------|
| CEO | 1.5× | Strategic, Growth | Product-market fit, revenue velocity, strategic moat |
| CTO | 1.2× | Technical | Model quality, infrastructure scalability, compute efficiency |
| CFO | 1.2× | Financial | Burn rate, unit economics, capital efficiency |
| Chief AI Officer | 1.3× | AI/Research | Model capability, research roadmap, safety |
| Head of GCC Partnerships | 1.0× | Commercial | Enterprise relationships, government engagement |
| Legal & Compliance | 1.0× | Risk | Regulatory compliance, IP protection, data governance |

---

## Decision Routing Rules

| Decision Type | Minimum Council | Quorum Required | Escalation Threshold |
|---------------|-----------------|-----------------|----------------------|
| Strategic Investment | Full Council | 4/6 | Confidence < 60% |
| Talent Acquisition | CEO + CTO + CFO | 2/3 | Confidence < 70% |
| Model Deployment | CTO + CAIO | 2/2 | Any safety flag |
| Partnership | CEO + GCC Head | 2/2 | Deal value > $500K |
| Pricing Strategy | CEO + CFO | 2/2 | Confidence < 65% |
| Regulatory Compliance | Legal + CEO | 2/2 | Any regulatory flag |

---

## KPI Monitoring Thresholds

| KPI | Good | Warning | Critical |
|-----|------|---------|----------|
| ARR | > $1M | > $250K | < $50K |
| NRR | > 120% | > 100% | < 85% |
| Burn Multiple | < 1.5× | < 2.5× | > 3× |
| GPU Utilisation | > 70% | > 40% | < 20% |
| Model Accuracy | > 85% | > 75% | < 65% |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-08-03 | Initial Customer Zero blueprint |

---

*Registered in `server/lib/twinBlueprintService.ts` FALLBACK_BLUEPRINTS*
