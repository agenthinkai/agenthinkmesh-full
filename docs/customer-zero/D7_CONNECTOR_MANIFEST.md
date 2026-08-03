# D7 — AgenThink Mesh Connector Manifest

**Version:** 1.0.0
**Status:** REGISTERED — OAuth flows pending (GAP-007)
**Registered in:** `connectorAdapterInterface.ts` BUILTIN_CONNECTORS

---

## Overview

The Connector Manifest defines the 5 data source connectors that feed live operational data into the AgenThink Mesh Decision Twin. At Customer Zero launch, connectors are registered with their schema and authentication requirements but OAuth flows are not yet implemented. KPI data is currently static in the cockpit UI.

---

## Connector 1 — QuickBooks Online

| Attribute | Value |
|-----------|-------|
| Connector ID | `agenthink-quickbooks` |
| Provider | Intuit QuickBooks Online |
| Auth Method | OAuth 2.0 |
| Base URL | `https://quickbooks.api.intuit.com/v3` |
| Status | REGISTERED — OAuth pending |

**Data Provided:**

| KPI | QuickBooks Field | Refresh |
|-----|-----------------|---------|
| ARR | Sum of recurring invoice lines | Daily |
| MRR | ARR / 12 | Daily |
| Gross Margin | (Revenue - COGS) / Revenue | Daily |
| Burn Rate | Net cash outflow (P&L) | Daily |
| Runway | Cash balance / Burn rate | Daily |

**Required Scopes:** `com.intuit.quickbooks.accounting`

---

## Connector 2 — HubSpot CRM

| Attribute | Value |
|-----------|-------|
| Connector ID | `agenthink-hubspot` |
| Provider | HubSpot |
| Auth Method | OAuth 2.0 |
| Base URL | `https://api.hubapi.com` |
| Status | REGISTERED — OAuth pending |

**Data Provided:**

| KPI | HubSpot Object | Refresh |
|-----|---------------|---------|
| Pipeline Value | Deals (open, weighted) | Daily |
| Win Rate | Deals (closed-won / total closed) | Weekly |
| ACV | Average deal amount | Weekly |
| NRR | Renewal deal tracking | Monthly |
| Churn Rate | Churned deal tracking | Monthly |

**Required Scopes:** `crm.objects.deals.read`, `crm.objects.contacts.read`

---

## Connector 3 — GitHub

| Attribute | Value |
|-----------|-------|
| Connector ID | `agenthink-github` |
| Provider | GitHub |
| Auth Method | OAuth App / GitHub App |
| Base URL | `https://api.github.com` |
| Status | REGISTERED — OAuth pending |

**Data Provided:**

| KPI | GitHub API | Refresh |
|-----|-----------|---------|
| Commit velocity | Commits per week (main branch) | Daily |
| PR cycle time | PR open → merge duration | Daily |
| Open issues | Issues by label | Daily |
| Release cadence | Releases per month | Weekly |

**Repositories monitored:** `agenthinkai/jupiter-shot`, `agenthinkai/decision-twin-factory`

---

## Connector 4 — AWS Cost Explorer

| Attribute | Value |
|-----------|-------|
| Connector ID | `agenthink-aws-cost` |
| Provider | Amazon Web Services |
| Auth Method | IAM Role (read-only) |
| Base URL | `https://ce.us-east-1.amazonaws.com` |
| Status | REGISTERED — IAM role pending |

**Data Provided:**

| KPI | AWS Service | Refresh |
|-----|------------|---------|
| GPU Utilisation | EC2 CloudWatch metrics | Hourly |
| Compute Spend | Cost Explorer by service | Daily |
| Cost per Token | SageMaker endpoint metrics | Per inference |
| Training Cost | EC2 spot instance billing | Per run |

**Required IAM Permissions:** `ce:GetCostAndUsage`, `cloudwatch:GetMetricData`

---

## Connector 5 — Jupiter Shot Metrics

| Attribute | Value |
|-----------|-------|
| Connector ID | `agenthink-jupiter-shot` |
| Provider | Internal — Jupiter Shot training platform |
| Auth Method | Internal API key |
| Base URL | `http://jupiter-shot-metrics.internal` |
| Status | REGISTERED — internal endpoint pending |

**Data Provided:**

| KPI | Jupiter Shot Source | Refresh |
|-----|-------------------|---------|
| Training Loss | `benchmarks/results/*/training_metrics.json` | Per run |
| Model Benchmark | `benchmarks/results/*/eval_results.json` | Per run |
| GPU Utilisation | `benchmarks/results/*/system_metrics.json` | Per run |
| Checkpoint Status | `benchmarks/results/*/checkpoint_info.json` | Per run |

---

## Implementation Roadmap

| Phase | Connectors | Target Date |
|-------|-----------|-------------|
| Phase 1 | Jupiter Shot (internal) | Q3 2026 |
| Phase 2 | AWS Cost Explorer (IAM) | Q3 2026 |
| Phase 3 | QuickBooks + HubSpot (OAuth) | Q4 2026 |
| Phase 4 | GitHub (OAuth App) | Q4 2026 |

---

*Registered in `server/lib/connectorAdapterInterface.ts` BUILTIN_CONNECTORS*
*OAuth flows tracked in GAP-007*
