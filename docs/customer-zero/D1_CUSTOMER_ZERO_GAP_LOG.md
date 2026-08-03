# D1 — Customer Zero Gap Log

**Organisation:** AgenThink Mesh
**Onboarding Date:** 2026-08-03
**Prepared by:** Decision Twin Factory — Platform Engineering
**Status:** LIVE — Customer Zero active

---

## Purpose

This document records every gap, workaround, and engineering debt item discovered during the AgenThink Mesh Customer Zero onboarding. It is the primary input to the Product Roadmap for the next platform release.

---

## Gap Summary

| ID | Severity | Category | Description | Status | Resolution |
|----|----------|----------|-------------|--------|------------|
| GAP-001 | HIGH | Org Onboarding | `createOrganization` procedure exists but no self-service UI wizard exists — org must be created via API call or seed script | OPEN | Build org onboarding wizard (Q3 2026) |
| GAP-002 | HIGH | Blueprint | Blueprint registry is fallback-only; no UI to create/edit blueprints without code changes | OPEN | Build Blueprint Studio UI (Q3 2026) |
| GAP-003 | MEDIUM | Ontology | Domain ontology is embedded in blueprint JSON; no standalone ontology editor | OPEN | Standalone ontology editor (Q4 2026) |
| GAP-004 | MEDIUM | Council Personas | Persona sets are fallback-only; no UI to customise personas per org | OPEN | Persona customisation UI (Q3 2026) |
| GAP-005 | MEDIUM | Decision Library | 14 decision types available; no UI to add custom types without code changes | OPEN | Custom decision type builder (Q4 2026) |
| GAP-006 | LOW | KPI Registry | KPI sets are fallback-only; no UI to add/edit KPIs or set org-specific thresholds | OPEN | KPI configuration UI (Q4 2026) |
| GAP-007 | LOW | Connector Manifest | Connectors are registered as fallback constants; no live OAuth flow for QuickBooks/HubSpot | OPEN | OAuth connector flow (Q4 2026) |
| GAP-008 | HIGH | Outcome Ledger | No UI to seed historical decisions; must use API directly | OPEN | Historical decision importer (Q3 2026) |
| GAP-009 | MEDIUM | Executive UX | AgenThink cockpit uses static KPI data; no live data pull from connectors | OPEN | Live connector data pull (Q4 2026) |
| GAP-010 | LOW | Reports | Report generation is registered but no UI to trigger on-demand reports | OPEN | Report trigger UI (Q3 2026) |
| GAP-011 | LOW | Daily Rhythm | Heartbeat job registered at startup but no UI to pause/resume/configure schedule | OPEN | Heartbeat management UI (already in Settings → Schedules) |
| GAP-012 | MEDIUM | Multi-Tenant | All fallback data is global; no per-org override mechanism for blueprints/personas/KPIs | OPEN | Per-org registry overrides (Q3 2026) |

---

## Critical Path Items

The following gaps must be resolved before the second enterprise customer is onboarded:

1. **GAP-001** — Self-service org onboarding wizard (blocks all future customers)
2. **GAP-008** — Historical decision importer (blocks Outcome Ledger accuracy from day 1)
3. **GAP-012** — Per-org registry overrides (blocks customisation for different industries)

---

## Workarounds Applied for Customer Zero

| Gap | Workaround Applied |
|-----|--------------------|
| GAP-001 | Org created via `seed-customer-zero.mjs` script |
| GAP-002 | Blueprint added to `twinBlueprintService.ts` FALLBACK_BLUEPRINTS |
| GAP-003 | Ontology embedded in blueprint JSON |
| GAP-004 | Persona set added to `councilPersonaService.ts` FALLBACK_PERSONA_SETS |
| GAP-005 | Decision types added to `decisionTypeService.ts` FALLBACK_DECISION_TYPES |
| GAP-006 | KPI set added to `kpiService.ts` FALLBACK_KPI_SETS |
| GAP-007 | Connectors added to `connectorAdapterInterface.ts` BUILTIN_CONNECTORS |
| GAP-008 | Historical decisions to be seeded via direct API call post-launch |
| GAP-009 | KPI data hardcoded in AgenThinkTwin.tsx for launch; to be replaced with live data |
| GAP-010 | Reports accessible via direct API call |
| GAP-011 | Heartbeat visible in Settings → Schedules panel |
| GAP-012 | All AgenThink data in global fallbacks; acceptable for single-customer phase |

---

## Engineering Debt Created

| Item | File | Description |
|------|------|-------------|
| Static KPI data | `client/src/pages/AgenThinkTwin.tsx` | KPI values hardcoded; replace with `trpc.twinFactory.kpis.list` |
| Global fallback pollution | `server/lib/*.ts` | AgenThink-specific data in global fallbacks; move to per-org DB rows |
| No seed idempotency | `scripts/seed-customer-zero.mjs` | Script creates duplicate rows if run twice |

---

*Last updated: 2026-08-03*
