# D3 — AgenThink Mesh Domain Ontology

**Ontology ID:** `ai_company_gcc`
**Version:** 1.0.0
**Industry:** AI-Native Company, GCC Region
**Status:** ACTIVE

---

## Overview

The AgenThink Mesh Domain Ontology defines the conceptual vocabulary, entity relationships, and semantic rules that govern how the Decision Twin interprets and reasons about decisions in the context of an AI-native company operating in the Gulf Cooperation Council region.

---

## Core Entity Classes

### Company Entities

| Entity | Definition | Examples |
|--------|-----------|---------|
| `Product` | A software or AI system delivered to customers | Decision Twin Factory, Jupiter Shot, AdMesh |
| `Model` | A trained ML model or model family | Dense 1.3B, MoE prototype, Whisper integration |
| `Customer` | An enterprise or institution paying for services | Warba Bank, DAMAC, NBK |
| `Partner` | A strategic or commercial relationship | AWS, Microsoft, KFAS |
| `Investor` | A current or prospective capital provider | Angel, VC, sovereign fund |

### Financial Entities

| Entity | Definition | Unit |
|--------|-----------|------|
| `ARR` | Annual Recurring Revenue — contracted recurring revenue | USD |
| `MRR` | Monthly Recurring Revenue | USD |
| `Burn` | Net cash outflow per month | USD/month |
| `Runway` | Months of cash remaining at current burn | months |
| `CAC` | Customer Acquisition Cost | USD |
| `LTV` | Customer Lifetime Value | USD |

### Technical Entities

| Entity | Definition |
|--------|-----------|
| `ComputeCluster` | A group of GPUs used for training or inference |
| `TrainingRun` | A single model training experiment |
| `Checkpoint` | A saved model state at a specific training step |
| `Benchmark` | A standardised evaluation task (HellaSwag, ARC, etc.) |
| `Deployment` | A live model serving endpoint |

### Regulatory Entities (GCC-specific)

| Entity | Definition |
|--------|-----------|
| `PDPL` | Personal Data Protection Law (Kuwait, Saudi Arabia) |
| `CBUAE` | Central Bank of UAE — AI in financial services guidance |
| `CBK` | Central Bank of Kuwait |
| `DataResidency` | Requirement to store data within national borders |
| `SovereignAI` | National AI capability owned by a government entity |

---

## Key Relationships

```
Company → produces → Product
Product → powered_by → Model
Model → trained_on → ComputeCluster
Customer → pays_for → Product
Customer → subject_to → Regulation
Partner → provides → ComputeCluster
Decision → affects → [Product | Model | Customer | Partner | Investor]
Decision → constrained_by → Regulation
KPI → measures → [Product | Company | Model]
```

---

## Decision Semantic Rules

The following semantic rules govern how the council interprets decisions:

1. **Regulatory primacy:** Any decision that touches `DataResidency` or `PDPL` must route through Legal & Compliance persona regardless of decision type.
2. **Model deployment gate:** Any `model-deployment` decision requires a `Benchmark` result above the minimum threshold before council deliberation begins.
3. **Capital efficiency:** All `strategic-investment` decisions must include a `Burn Multiple` impact assessment.
4. **GCC context:** All `market-entry` decisions must include a `DataResidency` assessment for the target market.

---

*Embedded in `bp-agenthink` blueprint JSON. Standalone ontology editor planned for Q4 2026 (GAP-003).*
