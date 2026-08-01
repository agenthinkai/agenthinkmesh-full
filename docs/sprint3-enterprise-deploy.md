# Sprint 3 — Enterprise Deploy Layer: Customer Documentation

**Release:** Sprint 3 · AgenThink Mesh  
**Audience:** Enterprise administrators, IT operations, and integration engineers  
**Status:** General Availability

---

## Overview

Sprint 3 delivers the **Enterprise Deploy Layer** — the complete set of capabilities required to run AgenThink Mesh in a production enterprise environment. This release covers five capability areas:

| Area | What Was Delivered |
|---|---|
| **WP-1** | Enterprise readiness audit — `/admin/twin-generator` route, membership management service |
| **WP-2** | Customer runtime execution — live `runTwin` backed by the Council Engine |
| **WP-3** | User/role access validation — suspend, reactivate, and list org members |
| **WP-4** | Data connectors — CSV ingestion + Outcome Ledger `storeDecision` |
| **WP-5–7** | Additional connectors — Excel (TSV), REST API, and SQL (SELECT-only) |
| **WP-8** | Enterprise admin page — `OrgUserManager` for org-level membership management |
| **WP-9** | On-premises deployment tooling — `/api/health`, `.env.template`, startup script |

---

## 1. Running a Decision Twin

### 1.1 From the Enterprise Dashboard

Navigate to **Enterprise Dashboard** (`/admin/enterprise`). Each deployed twin card now has two live buttons:

- **▶ Run** — executes a full Council deliberation and records the session in the Outcome Ledger.
- **⟳ Simulate** — runs in simulation mode (no ledger record, used for testing scenarios).

Both buttons open a **Run Dialog** where you:

1. Enter the **decision text** (minimum 10 characters) describing the decision to evaluate.
2. Select the **Council Mode** appropriate for your region or asset class:

| Mode | Description |
|---|---|
| `gcc` | GCC sovereign / family-office governance |
| `global_vc` | Global venture capital |
| `india_pe` | India private equity |
| `gcc_equities` | GCC public equities |
| `infrastructure` | Infrastructure & real assets |

3. Click **Launch** to start the run.

### 1.2 Run Result Panel

After a run completes, the result panel appears inline on the dashboard showing:

- **Verdict** (APPROVED / APPROVED_WITH_CONDITIONS / REJECTED / VETOED / INSUFFICIENT_DATA)
- **Final Score** and **Confidence Score** (0–100%)
- **Conditions to Proceed** (if applicable)
- **Blocking Issues** (if applicable)
- **Session ID** for audit trail lookup

### 1.3 tRPC Procedure Reference

```ts
// Enterprise run — records session in Outcome Ledger
trpc.enterprise.runTwin.mutate({
  twinInstanceId: number,   // ID of the deployed twin
  orgId: number,            // Organisation ID
  sessionType: "run" | "simulate",
  decisionText: string,     // Min 10 chars
  councilMode: "gcc" | "global_vc" | "india_pe" | "gcc_equities" | "infrastructure",
})
// Returns: { sessionId, twinInstanceId, sessionType, verdict, finalScore,
//            confidenceScore, conditionsToProceed, blockingIssues, durationMs }
```

---

## 2. Org-Level User Management

### 2.1 OrgUserManager Page

Navigate to **Enterprise → Org Users** (`/admin/org-users`). This page lists all members of your organisation with:

- Name and email
- Role badge
- Status (Active / Suspended / Invited)
- Join date

### 2.2 Suspending a Member

Click **Suspend** on any active member. A confirmation dialog appears. On confirmation, the member's status is set to `suspended` and they immediately lose access to all org resources.

### 2.3 Reactivating a Member

Click **Reactivate** on any suspended member to restore their access.

### 2.4 tRPC Procedure Reference

```ts
// List all org members with user info
trpc.enterprise.listOrgMembers.query({ orgId: number })
// Returns: Array<{ membershipId, userId, roleId, deptId, jobTitle,
//                   status, joinedAt, lastActiveAt, userName, userEmail }>

// Suspend a member
trpc.enterprise.suspendMembership.mutate({ membershipId: number, orgId: number })

// Reactivate a member
trpc.enterprise.reactivateMembership.mutate({ membershipId: number, orgId: number })

// Update membership (role, status, department)
trpc.enterprise.updateMembership.mutate({
  membershipId: number,
  orgId: number,
  status: "active" | "suspended" | "invited",
  roleId?: number,
  deptId?: number,
  jobTitle?: string,
})
```

---

## 3. Data Connectors

All connector procedures live under `trpc.twinFactory.connectors.*`.

### 3.1 CSV Connector

Ingest a CSV string directly into a twin's knowledge context.

```ts
trpc.twinFactory.connectors.syncCsv.mutate({
  connectorId: string,      // Connector registry ID
  csvText: string,          // Raw CSV content
  delimiter?: string,       // Default: ","
  hasHeader?: boolean,      // Default: true
  maxRows?: number,         // Default: 1000
})
// Returns: { success, rowsIngested, headers, sample, errors }
```

**CSV format requirements:**
- UTF-8 encoding
- First row treated as headers when `hasHeader: true`
- Quoted fields supported (`"value with, comma"`)
- Maximum 1,000 rows per call (configurable via `maxRows`)

### 3.2 Excel Connector (TSV)

Ingest tab-separated data exported from Excel or Google Sheets.

```ts
trpc.twinFactory.connectors.syncExcel.mutate({
  connectorId: string,
  tsvText: string,          // Tab-separated values
  hasHeader?: boolean,      // Default: true
  maxRows?: number,         // Default: 1000
})
// Returns: { success, rowsIngested, headers, sample, errors }
```

**Export from Excel:** Select the data range → Save As → Text (Tab delimited) (.txt) → paste content.

### 3.3 REST API Connector

Fetch data from any JSON REST endpoint.

```ts
trpc.twinFactory.connectors.syncRest.mutate({
  connectorId: string,
  url: string,              // Must be https://
  method?: "GET" | "POST", // Default: "GET"
  headers?: Record<string, string>,
  body?: string,            // For POST requests
  rootKey?: string,         // Extract nested array (e.g., "data")
  maxRows?: number,         // Default: 500
})
// Returns: { success, rowsIngested, sample, errors }
```

**Security note:** The server makes the outbound request. Credentials in `headers` are never exposed to the client.

### 3.4 SQL Connector

Run a read-only SELECT query against the platform database.

```ts
trpc.twinFactory.connectors.syncSql.mutate({
  connectorId: string,
  query: string,            // Must start with SELECT
  maxRows?: number,         // Default: 500
})
// Returns: { success, rowsIngested, sample, errors }
```

**Security:** Only `SELECT` statements are permitted. `INSERT`, `UPDATE`, `DELETE`, `DROP`, and all DDL statements are rejected with `BAD_REQUEST`.

---

## 4. Outcome Ledger — storeDecision

Manually record a decision outcome that was evaluated outside the platform.

```ts
trpc.outcomeLedger.storeDecision.mutate({
  topic: string,            // Decision topic (min 3 chars)
  context: string,          // Decision context (min 10 chars)
  verdict: "APPROVE" | "REJECT" | "HOLD" | "ESCALATE",
  finalScore: number,       // 0–1
  confidenceScore?: number, // 0–1
  summary?: string,
  twinInstanceId?: number,
  orgId?: number,
  runMode?: "standard" | "simulate" | "fast",
})
// Returns: { id, topic, verdict, finalScore, createdAt }
```

---

## 5. On-Premises Deployment

### 5.1 Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| pnpm | 8+ |
| MySQL / TiDB | 8.0+ |
| RAM | 512 MiB minimum (1 GiB recommended) |

### 5.2 Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/agenthinkai/agenthinkmesh-full.git
cd agenthinkmesh-full

# 2. Copy and configure environment
cp .env.template .env
# Edit .env — fill in all CHANGE_ME values

# 3. Run the startup script
chmod +x scripts/start-onprem.sh
./scripts/start-onprem.sh
```

The startup script automatically:
1. Validates all required environment variables
2. Installs Node.js dependencies (`pnpm install`)
3. Builds the frontend (`pnpm build`)
4. Runs database migrations (`pnpm db:push`)
5. Starts the production server

### 5.3 Health Check

The `/api/health` endpoint is available immediately after startup:

```bash
curl https://your-domain.com/api/health
```

**Response (healthy):**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "db": "connected",
  "timestamp": "2026-08-01T12:00:00.000Z"
}
```

**Response (degraded — database unavailable):**
```json
{
  "status": "degraded",
  "db": "unavailable",
  ...
}
```

HTTP status code is `200` when healthy, `503` when degraded.

### 5.4 Load Balancer / Kubernetes Configuration

Use `/api/health` for liveness and readiness probes:

```yaml
# Kubernetes example
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

### 5.5 Required Environment Variables

See `.env.template` for the full list. The minimum required variables are:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | 64-character random hex for session signing |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API key (LLM, storage, notifications) |
| `ANTHROPIC_API_KEY` | Claude API key for Council Engine |
| `VITE_APP_ID` | Manus OAuth application ID |

---

## 6. Audit Trail

All `runTwin` sessions are automatically recorded in the enterprise audit log. View the last 10 entries on the Enterprise Dashboard under **Recent Activity**, or query programmatically:

```ts
trpc.enterprise.listAuditLog.query({ orgId: number, limit?: number })
```

---

## 7. Known Limitations

- The `orgId` in the Enterprise Dashboard is currently defaulted to `1`. Multi-org switching will be delivered in Sprint 4.
- The SQL connector only supports the platform's own database. External database connections are planned for Sprint 4.
- REST connector does not currently support OAuth2 token refresh flows. Bearer tokens must be provided directly in `headers`.

---

## 8. Support

For enterprise support, contact your AgenThink Mesh account manager or file an issue at [help.manus.im](https://help.manus.im).
