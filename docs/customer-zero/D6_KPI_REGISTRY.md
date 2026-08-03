# D6 — KPI Registry (5 Groups, 40+ KPIs)

**KPI Set ID:** `ai_company`
**Version:** 1.0.0
**Status:** ACTIVE — registered in `kpiService.ts`

---

## Overview

The AgenThink Mesh KPI Registry defines 40+ key performance indicators across 5 groups. These KPIs are monitored by the Decision Twin and referenced during council deliberations to provide quantitative context for every decision.

---

## Group 1 — Revenue (8 KPIs)

| KPI ID | Name | Label | Unit | Direction | Good | Warning | Critical | Source |
|--------|------|-------|------|-----------|------|---------|----------|--------|
| `ai-arr` | Annual Recurring Revenue | ARR | USD | Higher | >$1M | >$250K | <$50K | QuickBooks |
| `ai-mrr` | Monthly Recurring Revenue | MRR | USD | Higher | >$83K | >$21K | <$4K | QuickBooks |
| `ai-nrr` | Net Revenue Retention | NRR | % | Higher | >120% | >100% | <85% | HubSpot |
| `ai-grr` | Gross Revenue Retention | GRR | % | Higher | >90% | >80% | <70% | HubSpot |
| `ai-arr-growth` | ARR Growth Rate (YoY) | ARR Growth | % | Higher | >100% | >50% | <25% | QuickBooks |
| `ai-pipeline` | Sales Pipeline Value | Pipeline | USD | Higher | >$500K | >$100K | <$25K | HubSpot |
| `ai-win-rate` | Sales Win Rate | Win Rate | % | Higher | >30% | >20% | <10% | HubSpot |
| `ai-avg-contract` | Average Contract Value | ACV | USD | Higher | >$50K | >$10K | <$2K | HubSpot |

---

## Group 2 — Unit Economics (8 KPIs)

| KPI ID | Name | Label | Unit | Direction | Good | Warning | Critical | Source |
|--------|------|-------|------|-----------|------|---------|----------|--------|
| `ai-cac` | Customer Acquisition Cost | CAC | USD | Lower | <$5K | <$15K | >$30K | HubSpot + QuickBooks |
| `ai-ltv` | Customer Lifetime Value | LTV | USD | Higher | >$100K | >$30K | <$10K | Calculated |
| `ai-ltv-cac` | LTV/CAC Ratio | LTV:CAC | ratio | Higher | >5× | >3× | <2× | Calculated |
| `ai-payback` | CAC Payback Period | Payback | months | Lower | <12 | <18 | >24 | Calculated |
| `ai-gross-margin` | Gross Margin | GM | % | Higher | >70% | >55% | <40% | QuickBooks |
| `ai-burn-multiple` | Burn Multiple | Burn× | ratio | Lower | <1.5× | <2.5× | >3× | QuickBooks |
| `ai-burn-rate` | Monthly Burn Rate | Burn | USD/mo | Lower | <$150K | <$250K | >$400K | QuickBooks |
| `ai-runway` | Cash Runway | Runway | months | Higher | >18 | >12 | <6 | QuickBooks |

---

## Group 3 — Product & Engagement (8 KPIs)

| KPI ID | Name | Label | Unit | Direction | Good | Warning | Critical | Source |
|--------|------|-------|------|-----------|------|---------|----------|--------|
| `ai-dau` | Daily Active Users | DAU | users | Higher | >100 | >20 | <5 | Platform |
| `ai-mau` | Monthly Active Users | MAU | users | Higher | >500 | >100 | <20 | Platform |
| `ai-dau-mau` | DAU/MAU Ratio | Stickiness | % | Higher | >30% | >15% | <5% | Calculated |
| `ai-session-depth` | Avg Session Depth | Session Depth | decisions | Higher | >3 | >1.5 | <1 | Platform |
| `ai-time-to-decision` | Avg Time to Decision | TTD | minutes | Lower | <15 | <30 | >60 | Platform |
| `ai-council-satisfaction` | Council Satisfaction Score | CSS | 1–5 | Higher | >4.2 | >3.5 | <3.0 | Platform |
| `ai-decision-accuracy` | Decision Outcome Accuracy | Accuracy | % | Higher | >75% | >60% | <50% | Outcome Ledger |
| `ai-churn-rate` | Monthly Churn Rate | Churn | % | Lower | <2% | <5% | >8% | HubSpot |

---

## Group 4 — Compute & Infrastructure (8 KPIs)

| KPI ID | Name | Label | Unit | Direction | Good | Warning | Critical | Source |
|--------|------|-------|------|-----------|------|---------|----------|--------|
| `ai-gpu-util` | GPU Utilisation | GPU Util | % | Higher | >70% | >40% | <20% | AWS Cost Explorer |
| `ai-cost-per-token` | Inference Cost per Token | CPT | USD/1M tokens | Lower | <$0.50 | <$2.00 | >$5.00 | AWS Cost Explorer |
| `ai-training-cost` | Training Cost per Run | Training Cost | USD | Lower | <$500 | <$2K | >$5K | AWS Cost Explorer |
| `ai-model-latency` | P95 Inference Latency | Latency P95 | ms | Lower | <500 | <1000 | >2000 | Platform |
| `ai-uptime` | Platform Uptime | Uptime | % | Higher | >99.9% | >99.5% | <99% | Platform |
| `ai-compute-budget` | Monthly Compute Spend | Compute | USD/mo | Lower | <$20K | <$50K | >$100K | AWS Cost Explorer |
| `ai-model-accuracy` | Primary Model Benchmark | Benchmark | % | Higher | >85% | >75% | <65% | Jupiter Shot |
| `ai-training-loss` | Latest Training Loss | Train Loss | nats | Lower | <2.5 | <3.5 | >4.5 | Jupiter Shot |

---

## Group 5 — People & Operations (8 KPIs)

| KPI ID | Name | Label | Unit | Direction | Good | Warning | Critical | Source |
|--------|------|-------|------|-----------|------|---------|----------|--------|
| `ai-headcount` | Total Headcount | HC | people | Neutral | 10–20 | 5–10 | <5 | Manual |
| `ai-revenue-per-hc` | Revenue per Headcount | Rev/HC | USD | Higher | >$100K | >$50K | <$20K | Calculated |
| `ai-eng-ratio` | Engineering Ratio | Eng % | % | Higher | >60% | >40% | <25% | Manual |
| `ai-time-to-hire` | Average Time to Hire | TTH | days | Lower | <30 | <60 | >90 | Manual |
| `ai-retention` | 12-Month Retention Rate | Retention | % | Higher | >90% | >80% | <70% | Manual |
| `ai-nps` | Employee NPS | eNPS | score | Higher | >40 | >20 | <0 | Manual |
| `ai-decision-velocity` | Decisions per Month | Dec/Mo | count | Higher | >10 | >5 | <2 | Platform |
| `ai-outcome-close-rate` | Outcome Ledger Close Rate | Close Rate | % | Higher | >80% | >60% | <40% | Outcome Ledger |

---

## KPI Benchmark Sources

| Source | Description | Update Frequency |
|--------|-------------|-----------------|
| SaaS Capital Index 2024 | SaaS company benchmarks (ARR, NRR, burn) | Annual |
| OpenAI/Anthropic public pricing | LLM inference cost benchmarks | Quarterly |
| GCC AI Market Report 2024 | GCC-specific AI company benchmarks | Annual |
| Platform telemetry | Live platform usage data | Real-time |
| AWS Cost Explorer | Compute cost data | Daily |
| Jupiter Shot Metrics | Model training and evaluation data | Per run |

---

*Registered in `server/lib/kpiService.ts` FALLBACK_KPI_SETS["ai_company"]*
