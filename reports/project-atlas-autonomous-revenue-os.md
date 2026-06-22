# PROJECT ATLAS
## Autonomous Revenue Operating System — AgenThink Mesh
### Architecture & Implementation Document v1.0

**Classification:** Internal — Board Distribution Only  
**Date:** June 2026  
**Version:** 1.0  
**Status:** Architecture Complete — Implementation Pending

---

> **THE BET:** AgenThink Mesh can reach $20M ARR with 8 humans if and only if the revenue engine is autonomous, auditable, and continuously improving — and if every engineering decision is subordinated to customer acquisition, not agent sophistication.

---

## EXECUTIVE SUMMARY

Project ATLAS is the architecture for the Autonomous Revenue Operating System (AROS) of AgenThink Mesh. It defines how the company will discover, qualify, engage, and close 30+ enterprise customers across 9 geographies and 10 sectors using 200+ specialised agents coordinated by 8 human operators.

The architecture is organised around five production systems, six phases, and one governing principle: **every module must answer "Does this help acquire, retain, or expand customers?" If not, it is deferred.**

The end state is a commercial machine that operates at a scale no human team of 8 could reach manually: 100,000 companies indexed, 10,000 executive profiles maintained, 1,000 active opportunities tracked, and $20M+ ARR at 85%+ gross margins.

---

## PART 1 — SYSTEM ARCHITECTURE

### 1.1 Overview

The Autonomous Revenue Operating System consists of five production systems operating in a continuous loop:

```
DISCOVERY → INTELLIGENCE → DETECTION → OUTREACH → COMMAND
    ↑                                                   |
    └───────────── LEARNING FEEDBACK LOOP ──────────────┘
```

Each system is independently deployable, independently scalable, and independently auditable. They share a common data layer, a common agent orchestration framework, and a common token accounting system.

### 1.2 System Inventory

| System | Name | Purpose | Agent Swarm | Output |
|---|---|---|---|---|
| S1 | Global Target Discovery Engine | Continuously discover enterprise targets | Discovery Swarm | targets.csv |
| S2 | Account Intelligence Factory | Build 5–10 page account dossiers | Intelligence Swarm | account_dossier_[company].md |
| S3 | Decision Detection Engine | Identify strategic decisions before competitors | Decision Swarm | decision_pipeline.csv |
| S4 | Outreach Factory | Generate personalised outreach campaigns | Outreach Swarm + Proposal Swarm | outreach_queue.csv |
| S5 | Revenue Command Center | Executive dashboard and pipeline management | Finance Swarm + Governance Swarm | Live dashboard |

### 1.3 Data Flow Architecture

```
External Sources (web, news, filings, LinkedIn, databases)
        │
        ▼
[S1: Discovery Engine] ──────────────────────────────────────────────┐
        │ targets.csv                                                 │
        ▼                                                             │
[S2: Intelligence Factory] ───────────────────────────────────────── │
        │ account_dossier_[company].md                               │
        ▼                                                             │
[S3: Decision Detection] ─────────────────────────────────────────── │
        │ decision_pipeline.csv                                       │
        ▼                                                             │
[S4: Outreach Factory] ───────────────────────────────────────────── │
        │ outreach_queue.csv (pending human approval)                 │
        ▼                                                             │
[Human Approval Gate] ◄──────────────────────────────────────────────┘
        │ approved_outreach.csv
        ▼
[CRM / Engagement Tracking]
        │ outcomes.csv
        ▼
[S5: Revenue Command Center]
        │ performance_metrics.json
        ▼
[Learning Feedback Loop] ──────────────► back to S1 targeting criteria
```

### 1.4 Integration Layer

The five systems communicate through a shared PostgreSQL database (primary data store), an S3-compatible object store (dossiers, proposals, reports), a Redis message queue (agent task coordination), and a REST API gateway (human operator interfaces).

All agent outputs are written to the database before being consumed by downstream systems. No agent communicates directly with another agent — all coordination is mediated through the data layer. This is the primary architectural decision that enables auditability.

### 1.5 Human Touchpoints

Human operators interact with the system at exactly four points:

1. **Outreach approval queue** — review and approve/reject outreach before sending
2. **Opportunity qualification** — confirm or reject AI-scored opportunities above threshold
3. **Proposal review** — review AI-generated proposals before delivery
4. **System configuration** — adjust targeting criteria, scoring thresholds, agent parameters

Everything else is autonomous.

---

## PART 2 — DATABASE SCHEMA

### 2.1 Core Tables

The schema is organised into six domains: Companies, Contacts, Decisions, Outreach, Pipeline, and Agent Operations.

#### Domain 1: Companies

```sql
CREATE TABLE companies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  domain                TEXT UNIQUE,
  headquarters_country  TEXT,
  headquarters_city     TEXT,
  sector                TEXT,  -- enum: Banking, AssetMgmt, Insurance, Telecom, Infrastructure, Energy, Utilities, Logistics, Government, SovereignInvestor
  region                TEXT,  -- enum: Americas, EMEA, APAC
  revenue_estimate_usd  BIGINT,
  employee_count        INTEGER,
  digital_transform_score INTEGER CHECK (digital_transform_score BETWEEN 0 AND 100),
  ai_adoption_score     INTEGER CHECK (ai_adoption_score BETWEEN 0 AND 100),
  opportunity_score     INTEGER CHECK (opportunity_score BETWEEN 0 AND 100),
  estimated_acv_usd     INTEGER,
  estimated_buying_capacity TEXT,  -- Low / Medium / High / Very High
  dossier_status        TEXT DEFAULT 'pending',  -- pending / in_progress / complete / stale
  last_enriched_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id),
  signal_type   TEXT,  -- ai_adoption / digital_transform / m_and_a / leadership_change / expansion / cost_reduction
  signal_text   TEXT,
  source_url    TEXT,
  signal_date   DATE,
  confidence    INTEGER CHECK (confidence BETWEEN 0 AND 100),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_dossiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id),
  version         INTEGER DEFAULT 1,
  executive_brief TEXT,
  strategic_challenges TEXT,
  competitive_threats TEXT,
  ai_readiness_assessment TEXT,
  decision_twin   TEXT,
  historical_analogues TEXT,
  mesh_use_cases  TEXT,
  opportunity_score INTEGER,
  outreach_strategy TEXT,
  full_markdown   TEXT,  -- S3 key to full .md file
  generated_at    TIMESTAMPTZ DEFAULT now(),
  approved_by     UUID REFERENCES users(id),
  status          TEXT DEFAULT 'draft'  -- draft / approved / archived
);
```

#### Domain 2: Contacts

```sql
CREATE TABLE contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id),
  full_name       TEXT NOT NULL,
  title           TEXT,
  seniority       TEXT,  -- C-Suite / VP / Director / Manager
  function        TEXT,  -- CEO / CMO / CTO / CDO / CIO / CFO / Head-Clinical / Head-RD / Head-AI / Head-Digital
  linkedin_url    TEXT,
  email           TEXT,
  email_verified  BOOLEAN DEFAULT false,
  email_source    TEXT,
  phone           TEXT,
  location        TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

#### Domain 3: Decisions

```sql
CREATE TABLE decisions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID REFERENCES companies(id),
  decision_type         TEXT,  -- MA / DigitalTransform / AIAdoption / ETFLaunch / Infrastructure / MarketExpansion / CostOptimization / DataCenter / CloudMigration / Regulatory
  decision_brief        TEXT,
  stakeholder_map       TEXT,
  decision_twin         TEXT,
  estimated_value_usd   BIGINT,
  engagement_probability INTEGER CHECK (engagement_probability BETWEEN 0 AND 100),
  source_url            TEXT,
  detected_at           TIMESTAMPTZ DEFAULT now(),
  status                TEXT DEFAULT 'active'  -- active / engaged / closed / expired
);
```

#### Domain 4: Outreach

```sql
CREATE TABLE outreach_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id),
  contact_id      UUID REFERENCES contacts(id),
  decision_id     UUID REFERENCES decisions(id),
  campaign_type   TEXT,  -- intro_email / linkedin / followup_1 / followup_2 / exec_briefing / sdr_teaser
  subject_line    TEXT,
  body_text       TEXT,
  personalisation_notes TEXT,
  status          TEXT DEFAULT 'pending_approval',  -- pending_approval / approved / sent / replied / bounced / rejected
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  outcome         TEXT,  -- meeting_booked / not_interested / no_response / bounced
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

#### Domain 5: Pipeline

```sql
CREATE TABLE opportunities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID REFERENCES companies(id),
  contact_id          UUID REFERENCES contacts(id),
  stage               TEXT,  -- discovered / dossier_complete / decision_detected / outreach_sent / meeting_booked / proposal_delivered / negotiation / won / lost
  acv_estimate_usd    INTEGER,
  probability         INTEGER CHECK (probability BETWEEN 0 AND 100),
  expected_close_date DATE,
  account_director    UUID REFERENCES users(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE proposals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  UUID REFERENCES opportunities(id),
  version         INTEGER DEFAULT 1,
  title           TEXT,
  executive_summary TEXT,
  use_case        TEXT,
  pricing_model   TEXT,
  pilot_scope     TEXT,
  full_markdown   TEXT,  -- S3 key
  status          TEXT DEFAULT 'draft',  -- draft / approved / delivered / accepted / rejected
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

#### Domain 6: Agent Operations

```sql
CREATE TABLE agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name      TEXT NOT NULL,
  swarm           TEXT,  -- Discovery / Intelligence / Decision / Outreach / Proposal / CustomerSuccess / Finance / Governance
  task_type       TEXT,
  input_summary   TEXT,
  output_summary  TEXT,
  tokens_consumed INTEGER,
  cost_usd        NUMERIC(10,6),
  duration_ms     INTEGER,
  status          TEXT,  -- success / failure / timeout / throttled
  error_message   TEXT,
  revenue_influenced_usd BIGINT DEFAULT 0,
  roi_score       NUMERIC(10,4),  -- revenue_influenced / cost_generated
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_throttle_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name  TEXT,
  reason      TEXT,  -- low_roi / cost_overrun / rate_limit / manual
  throttled_at TIMESTAMPTZ DEFAULT now(),
  restored_at TIMESTAMPTZ,
  throttled_by TEXT  -- system / human
);
```

### 2.2 Key Indexes

```sql
CREATE INDEX idx_companies_sector ON companies(sector);
CREATE INDEX idx_companies_region ON companies(region);
CREATE INDEX idx_companies_opportunity_score ON companies(opportunity_score DESC);
CREATE INDEX idx_decisions_type ON decisions(decision_type);
CREATE INDEX idx_decisions_detected_at ON decisions(detected_at DESC);
CREATE INDEX idx_outreach_status ON outreach_campaigns(status);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);
CREATE INDEX idx_agent_runs_swarm ON agent_runs(swarm);
CREATE INDEX idx_agent_runs_roi ON agent_runs(roi_score DESC);
```

---

## PART 3 — AZURE ARCHITECTURE

### 3.1 Service Map

The AROS runs on Azure with the following service configuration:

| Service | Azure Product | Purpose | Tier |
|---|---|---|---|
| Primary Database | Azure Database for PostgreSQL Flexible Server | All structured data | General Purpose, 4 vCores |
| Object Storage | Azure Blob Storage | Dossiers, proposals, reports | LRS, Hot tier |
| Message Queue | Azure Service Bus | Agent task coordination | Standard |
| API Gateway | Azure API Management | Human operator interfaces | Developer |
| Agent Compute | Azure Container Apps | Agent execution environment | Consumption plan |
| LLM Gateway | Azure OpenAI Service | All LLM calls | GPT-4o deployment |
| Search | Azure AI Search | Company and contact search | Basic |
| Monitoring | Azure Monitor + Application Insights | Performance, cost, errors | Standard |
| Key Vault | Azure Key Vault | Secrets management | Standard |
| CDN | Azure Front Door | Dashboard delivery | Standard |

### 3.2 Agent Compute Architecture

All agents run as Azure Container Apps in the Consumption plan. This means:

- **Zero cost when idle** — agents only consume compute when processing tasks
- **Automatic scaling** — up to 300 replicas per agent type during peak discovery runs
- **Isolated execution** — each agent run is a separate container instance
- **Built-in retry** — failed tasks are automatically retried via Service Bus dead-letter queues

### 3.3 Cost Architecture

The primary cost driver is LLM tokens, not compute. The architecture is designed to minimise token consumption through three mechanisms:

1. **Tiered enrichment** — companies are enriched in stages (basic → signal → dossier) with human approval gates between stages. Only approved companies proceed to the next tier.
2. **Caching** — all LLM outputs are cached for 30 days. Repeated queries about the same company return cached results.
3. **Model routing** — simple classification tasks (sector assignment, signal scoring) use GPT-4o-mini. Complex generation tasks (dossiers, Decision Twins, proposals) use GPT-4o. Cost difference: approximately 15x.

### 3.4 Estimated Monthly Azure Spend

| Component | Monthly Cost (100 companies/day) | Monthly Cost (1,000 companies/day) |
|---|---|---|
| PostgreSQL | $180 | $360 |
| Blob Storage | $20 | $80 |
| Service Bus | $10 | $40 |
| Container Apps | $150 | $600 |
| Azure OpenAI (GPT-4o) | $1,200 | $8,000 |
| Azure OpenAI (GPT-4o-mini) | $80 | $400 |
| AI Search | $75 | $250 |
| Monitoring | $50 | $150 |
| **Total** | **~$1,765/month** | **~$9,880/month** |

At $9,880/month infrastructure cost and $20M ARR target, infrastructure is approximately 0.6% of revenue — well within the 85% gross margin target.

---

## PART 4 — AGENT ARCHITECTURE

### 4.1 Agent Design Principles

Every agent in the AROS follows four design rules:

1. **Single responsibility** — each agent does exactly one thing
2. **Deterministic inputs** — agents receive structured inputs from the database, not free-form instructions
3. **Auditable outputs** — all outputs are written to the database with full provenance
4. **Token-accounted** — every agent call records tokens consumed, cost, and revenue influenced

### 4.2 Agent Swarm Inventory

#### Discovery Swarm (8 agents)

| Agent | Task | Input | Output | Model |
|---|---|---|---|---|
| SectorScanner | Identify companies in target sector/region | Sector + Region | company_name, domain, country | GPT-4o-mini |
| CompanyProfiler | Extract basic company data | company_name | revenue, employees, HQ | GPT-4o-mini |
| AISignalDetector | Detect AI adoption signals | company_name, domain | signal_type, signal_text, confidence | GPT-4o-mini |
| DigitalTransformScorer | Score digital transformation activity | company signals | digital_transform_score | GPT-4o-mini |
| ExecutiveExtractor | Extract C-suite names and titles | company_name | contact list | GPT-4o-mini |
| OpportunityScorer | Score overall opportunity | company profile + signals | opportunity_score, estimated_acv | GPT-4o |
| DuplicateChecker | Prevent duplicate company entries | company_name, domain | is_duplicate, existing_id | GPT-4o-mini |
| QualityGatekeeper | Validate company data completeness | company record | pass/fail + missing fields | GPT-4o-mini |

#### Intelligence Swarm (6 agents)

| Agent | Task | Input | Output | Model |
|---|---|---|---|---|
| ExecutiveBriefWriter | Write executive brief section | company profile + signals | executive_brief (500 words) | GPT-4o |
| StrategicChallengesAnalyst | Identify strategic challenges | executive brief + sector context | strategic_challenges (400 words) | GPT-4o |
| CompetitiveThreatMapper | Map competitive threats | company profile + sector | competitive_threats (400 words) | GPT-4o |
| AIReadinessAssessor | Assess AI readiness | signals + digital score | ai_readiness_assessment (300 words) | GPT-4o |
| DecisionTwinBuilder | Build Decision Twin profile | executive brief + challenges | decision_twin (600 words) | GPT-4o |
| DossierAssembler | Assemble full dossier markdown | all sections | account_dossier_[company].md | GPT-4o-mini |

#### Decision Swarm (5 agents)

| Agent | Task | Input | Output | Model |
|---|---|---|---|---|
| NewsMonitor | Monitor for strategic news | company_name, domain | raw news items | GPT-4o-mini |
| DecisionClassifier | Classify decision type | news item | decision_type, confidence | GPT-4o-mini |
| StakeholderMapper | Map decision stakeholders | decision + company contacts | stakeholder_map | GPT-4o |
| DecisionTwinMatcher | Match decision to Decision Twin | decision + dossier | decision_twin, engagement_probability | GPT-4o |
| DecisionBriefWriter | Write decision brief | all decision data | decision_brief (300 words) | GPT-4o |

#### Outreach Swarm (5 agents)

| Agent | Task | Input | Output | Model |
|---|---|---|---|---|
| IntroEmailWriter | Write personalised intro email | dossier + decision + contact | intro_email (subject + body) | GPT-4o |
| LinkedInMessageWriter | Write LinkedIn outreach | dossier + contact | linkedin_message (300 chars) | GPT-4o |
| FollowUpSequenceWriter | Write follow-up 1 and 2 | intro email + outcome | followup_1, followup_2 | GPT-4o |
| ExecBriefingRequestWriter | Write executive briefing request | dossier + decision | exec_briefing_request | GPT-4o |
| SDRTeaserWriter | Write SDR teaser proposal | dossier + use cases | sdr_teaser (1 page) | GPT-4o |

#### Proposal Swarm (4 agents)

| Agent | Task | Input | Output | Model |
|---|---|---|---|---|
| UseCaseSelector | Select best Mesh use cases | dossier + decision | top 3 use cases | GPT-4o |
| ProposalWriter | Write full commercial proposal | use cases + pricing | proposal.md | GPT-4o |
| PricingModeller | Generate pricing options | company size + use case | pricing_model | GPT-4o |
| ProposalReviewer | Quality-check proposal | proposal.md | quality_score + suggested edits | GPT-4o |

#### Customer Success Swarm (3 agents)

| Agent | Task | Input | Output | Model |
|---|---|---|---|---|
| ExpansionSignalDetector | Detect expansion opportunities | customer usage + signals | expansion_opportunity | GPT-4o-mini |
| QBRPreparer | Prepare quarterly business review | customer data + outcomes | qbr_deck.md | GPT-4o |
| RenewalRiskScorer | Score renewal risk | customer engagement | renewal_risk_score | GPT-4o-mini |

#### Finance Swarm (3 agents)

| Agent | Task | Input | Output | Model |
|---|---|---|---|---|
| TokenCostTracker | Track token spend per agent | agent_runs table | cost_report.json | GPT-4o-mini |
| ROICalculator | Calculate agent ROI scores | cost + revenue_influenced | roi_score per agent | GPT-4o-mini |
| BudgetAlerter | Alert on budget overruns | daily spend vs budget | alert if > threshold | GPT-4o-mini |

#### Governance Swarm (3 agents)

| Agent | Task | Input | Output | Model |
|---|---|---|---|---|
| OutreachAuditor | Audit all outreach before approval | outreach_campaigns | audit_flag + notes | GPT-4o |
| DataQualityMonitor | Monitor data quality across tables | all tables | quality_report.json | GPT-4o-mini |
| ComplianceChecker | Check GDPR/CAN-SPAM compliance | outreach content + contact | compliance_pass/fail | GPT-4o-mini |

### 4.3 Agent ROI Formula

```
Agent ROI Score = Revenue Influenced (USD) / Cost Generated (USD)

Target ROI: > 100x (i.e., every $1 of agent cost should influence $100+ of revenue)
Warning threshold: < 50x
Shutdown threshold: < 20x (after 30-day evaluation period)
```

Revenue influenced is attributed using last-touch attribution: the agent whose output was most recently used in a won opportunity receives full revenue attribution. This is a simplification — a more sophisticated multi-touch attribution model is recommended at 50+ customers.

---

## PART 5 — WORKFLOW MAPS

### 5.1 Primary Revenue Workflow

```
TRIGGER: Daily scheduled run (06:00 UTC)
│
├── [S1: Discovery] SectorScanner runs for each target sector × region combination
│   ├── Output: 50–200 new company candidates per run
│   ├── CompanyProfiler enriches each candidate
│   ├── AISignalDetector scans for signals
│   ├── OpportunityScorer scores each company
│   └── QualityGatekeeper filters: only companies scoring ≥ 60 proceed
│
├── [Human Gate 1] Account Director reviews new companies ≥ 80 score
│   └── Approved companies enter Intelligence queue
│
├── [S2: Intelligence] Intelligence Swarm builds dossier
│   ├── All 6 agents run sequentially
│   ├── DossierAssembler produces account_dossier_[company].md
│   └── Dossier stored in S3 + database
│
├── [Human Gate 2] Account Director reviews dossier
│   └── Approved dossiers enter Decision Detection queue
│
├── [S3: Decision Detection] Decision Swarm monitors for triggers
│   ├── NewsMonitor runs every 6 hours per tracked company
│   ├── DecisionClassifier scores each news item
│   └── High-confidence decisions (≥ 70) trigger Outreach queue
│
├── [S4: Outreach Factory] Outreach Swarm generates campaign
│   ├── IntroEmailWriter personalises based on dossier + decision
│   ├── LinkedInMessageWriter generates connection note
│   ├── FollowUpSequenceWriter prepares follow-ups 1 and 2
│   └── All outputs enter approval queue with status = pending_approval
│
├── [Human Gate 3] Account Director reviews and approves outreach
│   └── Approved outreach is sent (manually or via CRM integration)
│
└── [Outcome Tracking] Replies, meetings, opportunities updated in CRM
    └── Outcomes feed Learning Feedback Loop
```

### 5.2 Proposal Workflow

```
TRIGGER: Meeting booked (opportunity.stage = meeting_booked)
│
├── [Proposal Swarm] UseCaseSelector identifies top 3 Mesh use cases
├── [Proposal Swarm] PricingModeller generates 3 pricing options
├── [Proposal Swarm] ProposalWriter generates full proposal
├── [Proposal Swarm] ProposalReviewer quality-checks
│
├── [Human Gate 4] Account Director reviews proposal
│   └── Approved proposals delivered to prospect
│
└── [Outcome Tracking] Proposal outcome updated in pipeline
```

### 5.3 Token Throttling Workflow

```
TRIGGER: Hourly agent ROI check (Finance Swarm)
│
├── ROICalculator computes rolling 7-day ROI for each agent
├── BudgetAlerter checks daily spend vs budget
│
├── If agent ROI < 50x for 7 days:
│   └── Agent flagged for review → AI Operations Lead notified
│
├── If agent ROI < 20x for 30 days:
│   └── Agent automatically throttled (50% capacity reduction)
│   └── agent_throttle_log entry created
│
└── If daily token spend > 120% of budget:
    └── All non-critical agents paused until next day
    └── CEO and AI Operations Lead notified
```

### 5.4 Learning Feedback Workflow

```
TRIGGER: Weekly (Sunday 23:00 UTC)
│
├── Analyse won opportunities: sector, region, decision_type, dossier_score
├── Analyse lost opportunities: same dimensions
├── Identify best-performing outreach sequences by response rate
├── Identify best-performing Decision Twin patterns by engagement probability
│
├── Update targeting criteria:
│   └── Increase weight for high-win sectors/regions
│   └── Decrease weight for low-win sectors/regions
│
└── Generate weekly performance report → Revenue Command Center
```

---

## PART 6 — DASHBOARD SPECIFICATIONS

### 6.1 Revenue Command Center — Layout

The Revenue Command Center is a single-page executive dashboard accessible at `/revenue-command` (authenticated, CEO and Account Directors only). It has four panels:

**Panel 1 — Pipeline Funnel (top left)**

A live funnel showing counts at each stage:

| Stage | Count | Week-over-Week Change |
|---|---|---|
| Companies Discovered | 0 | — |
| Dossiers Completed | 0 | — |
| Decisions Detected | 0 | — |
| Outreach Queued | 0 | — |
| Outreach Sent | 0 | — |
| Meetings Booked | 0 | — |
| Opportunities Created | 0 | — |
| Proposals Delivered | 0 | — |
| Customers Won | 0 | — |

**Panel 2 — Financial Metrics (top right)**

| Metric | Current | Target | Status |
|---|---|---|---|
| ARR | $0 | $20M | 🔴 |
| ACV Forecast | $0 | $667K avg | 🔴 |
| Pipeline Value | $0 | $60M | 🔴 |
| Win Rate | — | 15% | — |
| CAC Estimate | — | <$50K | — |
| Revenue per Employee | — | $2.5M | — |

**Panel 3 — Operations (bottom left)**

| Metric | Current | Target | Status |
|---|---|---|---|
| Agent Utilisation | — | >80% | — |
| Daily Token Spend | $0 | <$500 | 🟢 |
| Monthly Azure Spend | $0 | <$10K | 🟢 |
| Cost per Opportunity | — | <$200 | — |
| Cost per Customer | — | <$50K | — |
| Agents Below ROI | 0 | 0 | 🟢 |

**Panel 4 — Approval Queues (bottom right)**

Live count of items awaiting human review:

- Outreach pending approval: 0
- Dossiers pending review: 0
- Proposals pending review: 0
- Opportunities pending qualification: 0

### 6.2 Account Director View

Account Directors see a filtered view showing only their assigned accounts, with:

- Company list with opportunity score, stage, and last activity
- Outreach approval queue (their accounts only)
- Meeting calendar integration
- Proposal status tracker

### 6.3 AI Operations View

The AI Operations Lead sees:

- Agent run log (last 24 hours, last 7 days)
- Agent ROI scores (all agents, ranked)
- Throttled agents list
- Token spend by swarm
- Error rate by agent
- Queue depths (pending tasks per agent)

---

*[End of Parts 1–6]*

---

## PART 7 — COST MODEL

### 7.1 Cost Structure

The AROS has three cost categories: infrastructure (Azure), LLM tokens, and human operators. At scale, the dominant cost is human operators — not technology.

| Cost Category | Month 1 | Month 6 | Month 12 | Month 24 |
|---|---|---|---|---|
| Azure Infrastructure | $1,800 | $4,500 | $9,900 | $15,000 |
| LLM Tokens (OpenAI) | $1,200 | $6,000 | $12,000 | $18,000 |
| Human Operators (8 FTE) | $120,000 | $120,000 | $140,000 | $160,000 |
| Legal & Compliance | $5,000 | $3,000 | $3,000 | $3,000 |
| Sales & Marketing | $10,000 | $20,000 | $30,000 | $40,000 |
| **Total Monthly OpEx** | **$138,000** | **$153,500** | **$194,900** | **$236,000** |
| **Annual OpEx** | **$1.66M** | — | **$2.34M** | **$2.83M** |

### 7.2 Unit Economics

| Metric | Target | Notes |
|---|---|---|
| Cost per company discovered | $0.50 | Primarily token cost |
| Cost per dossier completed | $8.00 | 6 GPT-4o calls per dossier |
| Cost per decision detected | $1.50 | News monitoring + classification |
| Cost per outreach campaign | $3.00 | 5 email/LinkedIn variants |
| Cost per proposal | $15.00 | Full proposal generation |
| Cost per opportunity created | $150–$250 | All upstream costs amortised |
| Cost per customer acquired (CAC) | $30,000–$50,000 | Including human operator time |

### 7.3 Gross Margin Model

At $20M ARR with $2.83M annual OpEx:

| Metric | Value |
|---|---|
| ARR | $20,000,000 |
| Annual OpEx | $2,830,000 |
| Gross Profit | $17,170,000 |
| **Gross Margin** | **85.9%** |

This meets the 85%+ gross margin target. The model is sensitive to human operator headcount — adding a 9th operator at $160K/year reduces gross margin by approximately 0.8%.

### 7.4 Cost Scaling Triggers

Three events trigger a cost review:

1. **Monthly token spend exceeds $15,000** — review agent ROI scores; throttle underperformers
2. **Monthly Azure spend exceeds $12,000** — review database query patterns; consider read replicas
3. **CAC exceeds $75,000** — review outreach conversion rates; adjust targeting criteria

---

## PART 8 — TOKEN MODEL

### 8.1 Token Budget Architecture

The token budget is allocated by swarm, not by individual agent. This prevents any single agent from consuming disproportionate resources.

| Swarm | Monthly Token Budget | Estimated Cost | Priority |
|---|---|---|---|
| Intelligence Swarm | 8,000,000 tokens | $8,000 | P1 — revenue-critical |
| Outreach Swarm | 4,000,000 tokens | $4,000 | P1 — revenue-critical |
| Proposal Swarm | 2,000,000 tokens | $2,000 | P1 — revenue-critical |
| Discovery Swarm | 3,000,000 tokens | $900 | P2 — uses mini model |
| Decision Swarm | 2,000,000 tokens | $600 | P2 — uses mini model |
| Customer Success Swarm | 1,000,000 tokens | $300 | P2 |
| Finance Swarm | 500,000 tokens | $75 | P3 — uses mini model |
| Governance Swarm | 1,000,000 tokens | $300 | P3 |
| **Total** | **21,500,000 tokens** | **$16,175** | — |

### 8.2 Model Routing Rules

The model routing decision is made at the agent level, not the swarm level. The routing logic is:

- **GPT-4o-mini** ($0.15/1M input, $0.60/1M output): classification, scoring, deduplication, simple extraction, monitoring
- **GPT-4o** ($5.00/1M input, $15.00/1M output): dossier writing, Decision Twin construction, proposal generation, outreach personalisation

The 15x cost difference between models means that routing a classification task to GPT-4o instead of GPT-4o-mini is a 15x cost error. The Governance Swarm audits model routing weekly.

### 8.3 Token Efficiency Targets

| Agent Type | Target Tokens per Task | Maximum Tokens per Task |
|---|---|---|
| Company profiling | 1,500 | 3,000 |
| Signal detection | 800 | 1,500 |
| Dossier section (per section) | 2,500 | 4,000 |
| Full dossier assembly | 500 | 1,000 |
| Intro email | 1,200 | 2,000 |
| LinkedIn message | 300 | 500 |
| Full proposal | 8,000 | 12,000 |
| Decision brief | 1,500 | 2,500 |

### 8.4 Token ROI Tracking

Every agent run records:

```
token_roi = revenue_influenced_usd / cost_usd
```

A dossier that costs $8 to generate and contributes to a $200,000 ACV win has a token ROI of 25,000x. A dossier that costs $8 and contributes to nothing has a token ROI of 0.

The Finance Swarm calculates rolling 7-day and 30-day token ROI for every agent. Agents below 20x ROI for 30 consecutive days are automatically throttled.

---

## PART 9 — REVENUE MODEL

### 9.1 Pricing Architecture

AgenThink Mesh offers three commercial tiers:

| Tier | Name | ACV | Target Buyer | Scope |
|---|---|---|---|---|
| Tier 1 | Retrospective Pilot | $25,000–$75,000 | Innovation / R&D leads | Single case, 30 days, proof of concept |
| Tier 2 | Enterprise Annual | $150,000–$500,000 | CDO / CTO / Head of Strategy | Unlimited cases, 12 months, full platform |
| Tier 3 | Enterprise Platform | $500,000–$2,000,000 | C-Suite | Custom deployment, dedicated agents, SLA |

### 9.2 Revenue Scenarios

**Conservative Scenario (Year 1–3)**

| Year | Pilots | Enterprise Annual | Enterprise Platform | ARR |
|---|---|---|---|---|
| 1 | 5 × $50K | 2 × $200K | 0 | $650K |
| 2 | 8 × $50K | 6 × $250K | 1 × $750K | $2,650K |
| 3 | 10 × $50K | 12 × $300K | 3 × $1M | $7,100K |

**Base Scenario (Year 1–5)**

| Year | Pilots | Enterprise Annual | Enterprise Platform | ARR |
|---|---|---|---|---|
| 1 | 8 × $50K | 3 × $200K | 0 | $1,000K |
| 2 | 12 × $50K | 8 × $250K | 2 × $750K | $3,100K |
| 3 | 15 × $50K | 15 × $300K | 5 × $1M | $10,250K |
| 4 | 10 × $50K | 20 × $350K | 8 × $1.2M | $17,100K |
| 5 | 8 × $50K | 22 × $400K | 10 × $1.5M | $24,200K |

**Aggressive Scenario (Year 1–4)**

| Year | Pilots | Enterprise Annual | Enterprise Platform | ARR |
|---|---|---|---|---|
| 1 | 12 × $50K | 5 × $250K | 0 | $1,850K |
| 2 | 15 × $50K | 12 × $300K | 3 × $1M | $7,350K |
| 3 | 10 × $50K | 18 × $350K | 7 × $1.2M | $15,200K |
| 4 | 8 × $50K | 20 × $400K | 12 × $1.5M | $26,400K |

### 9.3 Revenue per Human Operator

At $20M ARR with 8 operators: **$2.5M revenue per human operator**. This is the primary metric that justifies the autonomous architecture investment. A traditional enterprise software company with 8 salespeople generates approximately $800K–$1.2M per rep. The AROS target is 2–3x higher because agents handle all discovery, intelligence, and outreach preparation.

### 9.4 Pipeline Velocity Model

To reach $20M ARR, the pipeline must maintain:

| Stage | Required Count | Conversion Rate | Upstream Required |
|---|---|---|---|
| Customers Won | 30 | — | — |
| Proposals Delivered | 200 | 15% | — |
| Meetings Booked | 600 | 33% | — |
| Outreach Sent | 6,000 | 10% | — |
| Dossiers Completed | 12,000 | 50% | — |
| Companies Discovered | 100,000 | 12% | — |

At 100 companies discovered per day, the 100,000 company index is reached in approximately 3 years of continuous operation.

---

## PART 10 — GOVERNANCE MODEL

### 10.1 Governance Principles

The AROS operates under four governance principles:

1. **No agent sends outreach without human approval.** The approval gate is non-negotiable and cannot be bypassed by any agent or automated workflow.
2. **All agent outputs are auditable.** Every agent run is logged with full input, output, token count, cost, and timestamp. Logs are retained for 7 years.
3. **All outreach is GDPR and CAN-SPAM compliant.** The Governance Swarm checks every outreach item before it enters the approval queue.
4. **All data is classified.** Company data, contact data, and dossiers are classified as Confidential. Customer data is classified as Restricted.

### 10.2 Human Approval Gates

| Gate | Trigger | Approver | SLA | Override |
|---|---|---|---|---|
| Gate 1: Company qualification | Opportunity score ≥ 80 | Account Director | 24 hours | CEO only |
| Gate 2: Dossier approval | Dossier completed | Account Director | 48 hours | CEO only |
| Gate 3: Outreach approval | Outreach generated | Account Director | 24 hours | None — no override |
| Gate 4: Proposal approval | Proposal generated | Account Director + CEO | 48 hours | None — no override |

Gate 3 has no override. No outreach is ever sent without explicit human approval. This is the primary compliance and reputational protection mechanism.

### 10.3 Data Governance

| Data Type | Classification | Retention | Access |
|---|---|---|---|
| Company profiles | Internal | 5 years | All operators |
| Contact data | Confidential | 3 years (GDPR) | Account Directors + CEO |
| Dossiers | Confidential | 5 years | Account Directors + CEO |
| Outreach content | Confidential | 7 years | Account Directors + CEO |
| Customer data | Restricted | 7 years | CEO + Finance Lead |
| Agent run logs | Internal | 7 years | AI Operations + CEO |
| Token cost data | Internal | 3 years | Finance Lead + CEO |

### 10.4 Compliance Framework

The AROS is designed for compliance with:

- **GDPR** (EU/UK): Right to erasure implemented via `DELETE FROM contacts WHERE id = ?` with cascade. Data processing agreements required before storing any EU/UK contact data.
- **CAN-SPAM** (US): All outreach includes unsubscribe mechanism. Unsubscribes are processed within 10 business days.
- **CASL** (Canada): Explicit consent required before contacting Canadian contacts. Consent records stored in `contacts.email_verified` field.
- **PDPA** (Singapore): Data localisation requirements reviewed before storing Singapore contact data.

### 10.5 Agent Governance Rules

| Rule | Description | Enforcement |
|---|---|---|
| AG-001 | No agent may send external communications | Technical block at API gateway |
| AG-002 | No agent may access customer data without explicit authorisation | Database row-level security |
| AG-003 | All agent outputs must be written to database before downstream use | Enforced by orchestration framework |
| AG-004 | Agents below 20x ROI for 30 days are automatically throttled | Finance Swarm automated enforcement |
| AG-005 | All outreach must pass Governance Swarm compliance check | Enforced before approval queue entry |
| AG-006 | No agent may modify its own configuration | Technical block |
| AG-007 | All agent runs must record token count and cost | Enforced at SDK level |

---

## PART 11 — OPERATING MANUAL

### 11.1 Daily Operations (8 Human Operators)

**CEO (1 hour/day)**
- Review Revenue Command Center dashboard
- Review and sign off on proposals > $500K
- Review weekly learning report
- Approve any Gate 4 proposals

**CTO (2 hours/day)**
- Review agent error logs
- Review token spend vs budget
- Approve any infrastructure scaling decisions
- Review Governance Swarm audit flags

**Product Lead (2 hours/day)**
- Review dossier quality samples (5 per day)
- Review outreach quality samples (10 per day)
- Flag quality issues to AI Operations Lead
- Manage product roadmap

**Account Director Americas (4 hours/day)**
- Process Gate 1 approvals (company qualification)
- Process Gate 2 approvals (dossier review)
- Process Gate 3 approvals (outreach review)
- Manage active opportunities
- Conduct meetings with prospects

**Account Director EMEA/APAC (4 hours/day)**
- Same as Account Director Americas for EMEA/APAC accounts

**AI Operations Lead (6 hours/day)**
- Monitor agent performance
- Investigate agent failures
- Tune agent prompts and parameters
- Manage agent throttling
- Coordinate with CTO on infrastructure

**Platform Engineer (6 hours/day)**
- Maintain Azure infrastructure
- Deploy agent updates
- Monitor system health
- Manage database performance

**Finance & Compliance Lead (3 hours/day)**
- Review daily token spend report
- Review agent ROI scores
- Process GDPR deletion requests
- Manage legal and compliance documentation

### 11.2 Weekly Cadence

| Day | Activity | Owner |
|---|---|---|
| Monday | Pipeline review meeting (30 min) | CEO + Account Directors |
| Tuesday | Agent performance review (30 min) | CTO + AI Operations Lead |
| Wednesday | Dossier quality review (1 hour) | Product Lead + Account Directors |
| Thursday | Outreach conversion review (30 min) | Account Directors + AI Operations |
| Friday | Weekly learning report review (30 min) | CEO + all |
| Sunday | Learning Feedback Workflow runs (automated) | System |

### 11.3 Escalation Paths

| Event | First Response | Escalation | Time Limit |
|---|---|---|---|
| Agent failure | AI Operations Lead | CTO | 2 hours |
| Data breach | Finance & Compliance Lead | CEO + Legal | 1 hour |
| GDPR deletion request | Finance & Compliance Lead | CEO | 72 hours |
| Budget overrun (>120%) | Finance & Compliance Lead | CEO | Same day |
| Outreach compliance flag | Account Director | Finance & Compliance Lead | 24 hours |
| Customer complaint | Account Director | CEO | 4 hours |

### 11.4 Onboarding New Operators

When a new operator joins (within the 8-person limit):

1. Complete data governance training (2 hours)
2. Complete GDPR/CAN-SPAM compliance training (1 hour)
3. Complete Revenue Command Center orientation (1 hour)
4. Shadow existing Account Director for 5 days
5. Process first 10 approvals under supervision
6. Independent operation begins at day 10

---

## PART 12 — EXPANSION ROADMAP

### 12.1 Phase 1 — Foundation (Months 1–6)

**Goal:** First 5 paying customers. Validate the core workflow.

| Milestone | Target | Month |
|---|---|---|
| AROS infrastructure deployed | Azure environment live | Month 1 |
| Discovery Swarm operational | 100 companies/day | Month 1 |
| Intelligence Swarm operational | 10 dossiers/day | Month 2 |
| First dossier approved | 1 dossier | Month 2 |
| First outreach sent | 1 campaign | Month 3 |
| First meeting booked | 1 meeting | Month 3–4 |
| First pilot signed | $25K–$75K | Month 4–5 |
| 5 pilots signed | $125K–$375K ARR | Month 6 |

### 12.2 Phase 2 — Scale (Months 7–18)

**Goal:** First 15 enterprise customers. $3M ARR.

| Milestone | Target | Month |
|---|---|---|
| Decision Detection Engine live | 50 decisions/week | Month 7 |
| Outreach Factory fully automated | 100 campaigns/week | Month 8 |
| First enterprise annual contract | $150K–$500K | Month 9 |
| 10 enterprise customers | $2M ARR | Month 12 |
| Customer Success Swarm live | Expansion pipeline | Month 13 |
| First renewal | 90%+ retention | Month 15 |
| 15 enterprise customers | $3M ARR | Month 18 |

### 12.3 Phase 3 — Dominance (Months 19–36)

**Goal:** 30+ enterprise customers. $20M ARR.

| Milestone | Target | Month |
|---|---|---|
| 100,000 companies indexed | Full target universe | Month 24 |
| 10,000 executive profiles | Full contact database | Month 24 |
| 1,000 active opportunities | Full pipeline | Month 24 |
| 20 enterprise customers | $8M ARR | Month 24 |
| Proposal Swarm fully automated | 20 proposals/week | Month 25 |
| Learning model v2 | Improved targeting | Month 28 |
| 30 enterprise customers | $15M ARR | Month 30 |
| **$20M ARR** | **Target achieved** | **Month 36** |

### 12.4 Geographic Expansion Sequence

The AROS expands geographically in a specific sequence designed to maximise early wins:

1. **United States** (Month 1) — largest market, most AI-native buyers, English-language content
2. **United Kingdom** (Month 3) — English-language, strong financial services sector
3. **Singapore** (Month 6) — APAC gateway, high AI adoption, English-language
4. **UAE** (Month 9) — existing relationships from Diriyah/GCC work, sovereign investors
5. **Australia** (Month 12) — English-language, growing AI adoption
6. **Canada** (Month 15) — English-language, CASL compliance required
7. **Hong Kong** (Month 18) — financial services hub
8. **Saudi Arabia** (Month 21) — Vision 2030 digital transformation pipeline
9. **Japan** (Month 24) — largest APAC market; requires Japanese-language capability

### 12.5 Sector Expansion Sequence

| Priority | Sector | Rationale | Target Month |
|---|---|---|---|
| 1 | Banking | Highest AI adoption, highest ACV | Month 1 |
| 2 | Asset Management | Decision Twin use case strongest | Month 1 |
| 3 | Insurance | High data complexity, strong governance need | Month 3 |
| 4 | Telecom | Large digital transformation budgets | Month 6 |
| 5 | Energy & Utilities | Infrastructure investment wave | Month 9 |
| 6 | Logistics | Supply chain AI adoption | Month 12 |
| 7 | Infrastructure | Government-adjacent, long sales cycles | Month 15 |
| 8 | Sovereign Investors | Highest ACV potential; longest sales cycle | Month 18 |
| 9 | Government | Regulatory complexity; separate compliance track | Month 24 |

### 12.6 Agent Count Expansion

| Phase | Agent Count | Swarms Active | Monthly Token Budget |
|---|---|---|---|
| Foundation (M1–6) | 34 agents | Discovery + Intelligence + Outreach | $5,000 |
| Scale (M7–18) | 120 agents | All 8 swarms | $12,000 |
| Dominance (M19–36) | 200+ agents | All 8 swarms + specialised variants | $18,000 |

---

## FINAL SUCCESS CRITERIA

The AROS is complete when AgenThink Mesh can perform all of the following without human initiation:

| Capability | System | Status |
|---|---|---|
| Discover opportunities autonomously | S1: Discovery Engine | Architecture complete |
| Build account intelligence autonomously | S2: Intelligence Factory | Architecture complete |
| Detect strategic decisions autonomously | S3: Decision Detection | Architecture complete |
| Generate outreach autonomously (pending approval) | S4: Outreach Factory | Architecture complete |
| Generate proposals autonomously (pending approval) | S4: Proposal Swarm | Architecture complete |
| Track pipeline autonomously | S5: Revenue Command Center | Architecture complete |
| Optimise token spend autonomously | Finance Swarm | Architecture complete |
| Support 30+ enterprise customers with 8 humans | All systems | Target: Month 36 |

---

## APPENDIX — IMPLEMENTATION PRIORITY ORDER

The following sequence is recommended for implementation. Each item is a discrete deliverable that can be built and tested independently.

| Priority | Deliverable | Estimated Effort | Dependencies |
|---|---|---|---|
| P0-1 | Database schema deployment | 2 days | Azure PostgreSQL |
| P0-2 | Azure infrastructure provisioning | 3 days | Azure subscription |
| P0-3 | Agent orchestration framework | 5 days | Database + Azure Container Apps |
| P0-4 | Discovery Swarm (8 agents) | 5 days | Orchestration framework |
| P0-5 | Revenue Command Center (basic) | 3 days | Database |
| P1-1 | Intelligence Swarm (6 agents) | 5 days | Discovery Swarm |
| P1-2 | Outreach Factory (5 agents) | 5 days | Intelligence Swarm |
| P1-3 | Human approval queue UI | 3 days | Outreach Factory |
| P1-4 | Finance Swarm (3 agents) | 2 days | Agent runs table |
| P1-5 | Governance Swarm (3 agents) | 3 days | Outreach Factory |
| P2-1 | Decision Detection Engine (5 agents) | 5 days | Intelligence Swarm |
| P2-2 | Proposal Swarm (4 agents) | 5 days | Intelligence Swarm |
| P2-3 | Customer Success Swarm (3 agents) | 3 days | Pipeline table |
| P2-4 | Learning Feedback Workflow | 4 days | All swarms |
| P2-5 | Revenue Command Center (full) | 5 days | All systems |

**Total estimated implementation effort: 63 engineering days (approximately 3 months with 1 Platform Engineer).**

---

*Project ATLAS — Autonomous Revenue Operating System Architecture v1.0*  
*AgenThink Mesh | June 2026 | Board Distribution Only*
