<div style="page-break-after: always; text-align: center; padding-top: 120px;">

# AgenThink Mesh

## Technical Due Diligence

### Technical Architecture & System Overview

&nbsp;

&nbsp;

**Version:** v1.0 — April 2026

&nbsp;

---

**Confidential**

Provided for technical evaluation purposes only.  
Not for redistribution.

&nbsp;

&nbsp;

*[Space reserved for company logo]*

</div>

---

# AgenThink Mesh — Technical Due Diligence

**Document Type:** Internal preparation — technical DD base  
**Audience:** Product Lead / Tech Lead, Tier 1 enterprise evaluation  
**Date:** April 2026  
**Status:** v1.0 — Approved for external technical review

---

## 1. System Architecture

AgenThink Mesh is structured as a modular, server-side evaluation pipeline.

Data enters as user-provided text or files, is processed and structured by the API layer, evaluated by the councilEngine, aggregated via consensus logic, persisted to a relational database, and returned as a structured report or UI output.

**Data Flow**

```
Client Browser
  → Input (text / uploaded files)
  → tRPC API Layer (typed procedures, server-side)
  → Parsing + Structuring (schema normalization)
  → councilEngine.ts (parallel evaluation orchestration)
  → LLM API Layer (model calls)
  → Consensus Logic (server-side aggregation)
  → MySQL Database (session + deal storage)
  → Report Generation + Output
```

LLM calls occur exclusively within the councilEngine orchestration layer. The model layer is abstracted from core business logic.

The system is modular. Components can be modified or replaced without affecting the overall workflow.

---

## 2. Model Selection & Workflow

Evaluation is structured as a multi-perspective analysis across ten defined analytical roles ("Council of 10").

Each role represents a distinct analytical lens — for example: financial risk, market positioning, regulatory exposure, operational feasibility.

- Roles are defined in prompt architecture, not hardcoded to any model
- Each perspective executes independently and in parallel
- Outputs are constrained to structured formats
- Free-form generation is not used

Final decisions are derived via server-side consensus logic, not a single model output.

The council architecture and consensus methodology are model-agnostic and not dependent on any single LLM provider.

The system can operate with alternative models, including locally hosted or region-compliant LLMs.

The system is designed to structure decisions, not predict outcomes.

---

## 3. Data Handling & Validation

- All inputs are user-provided
- No external proprietary datasets are used unless explicitly integrated
- Outputs are grounded strictly in provided inputs
- No financial or market data is fabricated

Where data is missing, the system explicitly flags gaps rather than making assumptions.

- No client data is used for model training
- Each session is isolated
- No cross-client data reuse occurs

---

## 4. Reliability & Consistency

The evaluation structure is fixed across all use cases.

- Each perspective follows a constrained output format
- Aggregation occurs across multiple independent outputs
- Dependence on a single model output is reduced

LLM variance is acknowledged. The architecture mitigates this through:

- Structured prompting
- Multi-perspective evaluation
- Deterministic aggregation logic

The system is designed to enforce structured reasoning and reduce variability.

---

## 5. Data Security & Compliance

- Data is used only within the session in which it is submitted
- No data is shared across clients
- No data is used for model training or fine-tuning
- No third-party analytics or tracking is applied

The system can be deployed in controlled environments:

- Private cloud
- Enterprise VPC
- Locally hosted infrastructure

**Certifications:** No SOC 2, ISO 27001, or equivalent certifications are currently in place.

---

## 6. Limitations

- Output quality depends on input quality
- The system does not guarantee correctness
- The system does not predict outcomes
- The system supports decision-making; it does not replace it

LLM inference introduces non-determinism. Identical inputs may produce outputs within a controlled variance range.

---

## 7. Core Intellectual Property

Core IP includes:

- Multi-perspective evaluation framework (Council of 10)
- Prompt architecture and orchestration logic
- Consensus and aggregation methodology
- End-to-end evaluation workflow

These components are independent of hosting infrastructure.

The codebase is version-controlled in a private repository under the control of the founding entity.

---

## 8. Portability

Current deployment uses managed infrastructure (hosting, database, domain). This is an operational dependency, not an architectural constraint.

**Stack:**

| Layer | Technology |
|---|---|
| Backend | Node.js (Express + tRPC) |
| Frontend | React 19 + Vite |
| Database | MySQL-compatible (TiDB) |
| LLM Layer | Abstracted API integration |

No platform-specific lock-in exists. Migration to AWS, Azure, GCP, or Alibaba Cloud requires standard DevOps work only.

---

## 9. Architecture Diagram

```
Client (React frontend)
        ↓
tRPC API Layer (server-side)
        ↓
Parsing + Structuring
        ↓
councilEngine (10 parallel evaluations)
        ↓
LLM API Layer (abstracted)
        ↓
Consensus Logic (server-side aggregation)
        ↓
Database (MySQL-compatible)
        ↓
Report Generation / UI Output
```

All evaluation logic executes server-side. No decision logic is executed on the client.

---

## Positioning Note

AgenThink Mesh is not a model. It is a structured decision layer that operates on top of LLM systems.

The architecture is designed to integrate with multiple model providers, including enterprise or region-specific LLM stacks.

---

*This document reflects the current implemented state of the system. Features not yet implemented are not described.*
