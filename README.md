# AgenThink Mesh

**A multi-agent orchestration platform for institutional workflows.**

AgenThink Mesh discovers, scores, and routes tasks to specialist AI agents — both built-in and externally registered. Designed for GCC wealth management, finance, legal, healthcare, and enterprise operations.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-agenthinkmesh.manus.space-4F46E5?style=flat-square)](https://agenthinkmesh.manus.space)
[![Registry](https://img.shields.io/badge/Agent%20Registry-Public-22C55E?style=flat-square)](https://agenthinkmesh.manus.space/registry)
[![Build on Mesh](https://img.shields.io/badge/Build%20on%20Mesh-Developer%20Docs-0EA5E9?style=flat-square)](https://agenthinkmesh.manus.space/build)

---

## What it does

| Feature | Description |
|---|---|
| **14 Domain Contexts** | Finance, Legal, Healthcare, Enterprise, GCC Wealth — each with pre-configured specialist agents |
| **Dynamic Agent Spawning** | Type a task and watch the mesh spawn up to 50 agents based on semantic keyword detection |
| **Parallel Execution** | All agents run concurrently with a 400ms stagger — 9 agents in under 60 seconds |
| **Server-side LLM** | No API key required from users — all inference runs server-side via the platform LLM |
| **Document Vault** | Upload PDFs, TXT, MD, CSV — extracted text is injected into every agent's prompt |
| **Agent Registry** | Public marketplace for external agents — discover, score, and route tasks to registered endpoints |
| **External Agent Bridge** | Tasks are routed to the highest-scoring registered external agent automatically |
| **Verified Badges** | Agents that pass the connection test earn a ✓ Verified badge in the directory |
| **Capability-aware Discovery** | Discovery scoring matches task context labels to agent capabilities (50% weight) |
| **Task History** | Every task is saved, searchable, and re-runnable |
| **PDF Export** | Export any task output as a structured PDF report |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AgenThink Mesh                          │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Landing    │    │  Dashboard   │    │   Registry   │  │
│  │   /         │    │  /mesh       │    │  /registry   │  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘  │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │   tRPC Router   │                      │
│                    │  mesh.*         │                      │
│                    │  vault.*        │                      │
│                    │  agent.*        │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│              ┌──────────────┼──────────────┐               │
│              │              │              │               │
│     ┌────────▼──────┐ ┌─────▼──────┐ ┌────▼──────────┐   │
│     │  invokeLLM    │ │  S3 Vault  │ │  Agent Bridge  │   │
│     │  (server-side)│ │  (storage) │ │  (HTTP POST)   │   │
│     └───────────────┘ └────────────┘ └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │    External Registered Agents  │
                    │  POST /execute                 │
                    │  { task, context } →           │
                    │  { result, latency_ms }        │
                    └───────────────────────────────┘
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Wouter |
| Backend | Express 4, tRPC 11 |
| Database | MySQL (TiDB) via Drizzle ORM |
| Auth | Manus OAuth |
| Storage | S3 (document vault) |
| LLM | Platform-managed (invokeLLM) |
| Testing | Vitest (platform), Jest (reference agent) |

---

## Domain contexts

| Domain | Contexts | Agents |
|---|---|---|
| 💹 Finance | VC/PE Fund, Sovereign Wealth, Fund Manager | Deal Screener, Due Diligence, Portfolio Monitor, LP Comms, Valuation, Exit Modeler… |
| ⚖️ Legal | Law Firm, In-House Counsel | Contract Review, Clause Extractor, Risk Flagger, Jurisdiction Intel, Draft Gen… |
| 🏥 Healthcare | Hospital Ops, Clinical Research | Bed Manager, Staffing Optimizer, Patient Flow, Cost Analyzer, Safety Monitor… |
| 🏢 Enterprise | HR & People Ops, Procurement, Operations | Talent Screener, Vendor Screener, Process Monitor, KPI Tracker… |
| 🏦 GCC Wealth | Private Wealth, Investment Banking, Family Office, Fund Distribution | Client Profiler, Suitability Checker, Portfolio Builder, Deal Originator… |

---

## Agent Registry API

Any HTTP server can register as a Mesh agent. The contract is minimal:

```
POST /your-endpoint
Body:  { "task": "string", "context": "string" }
Returns: { "result": "string", "latency_ms": number }
```

Discovery scoring formula:
```
score = (capabilityMatch × 0.5) + (successRate × 0.3) + (latencyScore × 0.2)
```

See the [developer docs](https://agenthinkmesh.manus.space/build) or the [reference agent](https://github.com/YOUR_USERNAME/agenthinkmesh-reference-agent) for a deployable starter.

---

## Database schema

| Table | Purpose |
|---|---|
| `users` | Auth, profile, role |
| `task_history` | Every executed task with outputs and agent count |
| `agents` | Registered external agents with capabilities and endpoint URL |
| `agent_metrics` | Per-agent success rate, average latency, error rate |
| `vault_documents` | Uploaded documents with S3 reference and extracted text |

---

## Running locally

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/agenthinkmesh-full
cd agenthinkmesh-full

# Install
pnpm install

# Push schema
pnpm db:push

# Start dev server
pnpm dev
```

---

## Tests

```bash
pnpm test
```

---

## Related

- [agenthinkmesh-reference-agent](https://github.com/YOUR_USERNAME/agenthinkmesh-reference-agent) — Deployable reference agent implementation

---

## License

MIT
