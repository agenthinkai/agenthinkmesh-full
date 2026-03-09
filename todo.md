# AgenThinkMesh Full-Stack TODO

## Auth & User
- [x] Database schema: users table with apiKey, preferredContext fields + taskHistory table
- [x] Login/Register page with Manus OAuth (Google, GitHub, email)
- [x] Auth-gated routing: unauthenticated → landing/login, authenticated → mesh dashboard
- [x] User profile in topbar (name, sign out button)

## Mesh Core
- [x] Migrate CONTEXTS (14 contexts, 112 agents) into client/src/lib/meshData.ts
- [x] inferAgents() spawning logic (12 keyword rules, up to 50 agents)
- [x] MeshCanvas radial layout component (canvas-based, 1-50 nodes)
- [x] Context switcher (tabbed popover, 5 domain tabs, 14 contexts)
- [x] Agent capacity bar (amber above 30)

## Task Execution
- [x] Task input with suggested tasks per context
- [x] Execute via Mesh button with routing animation
- [x] Output panel with per-agent streaming cards (400ms stagger)
- [x] Anthropic API streaming (claude-3-5-sonnet-20241022)
- [x] Placeholder mode when no API key set
- [x] Boot sequence animation

## Persistence (per user account)
- [x] Task history table in DB, saved per user via tRPC
- [x] Task history panel (search, reverse-chronological)
- [ ] Document vault (file upload to S3, indexed per user)
- [x] API key stored in sessionStorage (user-controlled)
- [x] Settings panel (API key, security warning)

## Export
- [x] Export PDF (HTML blob download of agent outputs with print stylesheet)

## Quality
- [x] Vitest tests for auth and mesh procedures (7/7 passing)
- [ ] Checkpoint and deliver live URL

## Dashboard Redesign
- [x] tRPC procedures: getMetrics (tasks today, avg time, success rate), getRecentActivity
- [x] Three-column enterprise layout: left (canvas+agents), center (task input + recent tasks), right (3 widgets)
- [x] Center: Task Command Center with large input + Recent Tasks list
- [x] Right widget 1: Live Mesh Activity (last 5 task executions with status)
- [x] Right widget 2: Agent Status (all agents with standby/active state)
- [x] Right widget 3: System Metrics (tasks today, avg time, success rate)

## Landing Page Redesign
- [x] Dark hero section with animated mesh graphic, headline, sub-headline, CTA
- [x] Stats bar (14 contexts, 112 agents, 5 domains, 50 max per task)
- [x] How it works section (3-step flow)
- [x] Feature highlights section (6 cards)
- [x] Domain showcase section (5 domains with agent list)
- [x] Social proof / use case section
- [x] Bottom CTA section
- [x] Professional navbar with Sign In button

## Font & Theme Update
- [x] Replace Syne + DM Mono with Inter + JetBrains Mono (cleaner, professional SaaS standard)
- [x] Convert landing page from dark (#080D1A) to clean light theme (#F8FAFC / #FFFFFF)
- [x] Update all text, border, and background colors for light mode readability

## Logo
- [x] Design professional SVG logo mark (hexagonal mesh node concept)
- [x] Create shared Logo component (mark + wordmark variants)
- [x] Replace text brand in Landing.tsx navbar
- [x] Replace text brand in MeshDashboard.tsx topbar

## Bug Fixes
- [x] Fix sticky navbar not staying visible on scroll (Landing.tsx)

## Agent Platform Extension
- [x] Schema: agents table (registration fields + owner + reputation defaults)
- [x] Schema: agentMetrics table (success_rate, avg_latency, tasks_completed, error_rate)
- [x] Schema: extend taskHistory with agents_used, execution_time fields
- [x] tRPC: agent.register, agent.list, agent.getById, agent.myAgents procedures
- [x] tRPC: agent.discover — scored ranking (capability 50% + success_rate 30% + latency 20%)
- [x] tRPC: agent.updateReputation — called after task completion
- [x] Task routing: record agents_used + execution_time on saveTask
- [x] Frontend: Agent Registry page (/registry — Public Directory + Register + My Agents tabs)
- [x] Frontend: Discovery scoring wired to discover procedure
- [x] Vitest: agent registration, discovery scoring, reputation update tests (15/15 passing)

## Incremental Extension — Session 2

### 1. Server-side LLM (invokeLLM)
- [x] Add mesh.runAgentTask tRPC procedure (protectedProcedure) using invokeLLM
- [x] Procedure accepts: agentLabel, systemPromptBase, taskText, contextLabel, vaultText
- [x] Returns: { result: string }
- [x] Update AgentCard in MeshDashboard to call trpc.mesh.runAgentTask instead of direct Anthropic fetch
- [x] Remove apiKey prop from AgentCard and OutputPanel
- [x] Keep placeholder mode for unauthenticated (not needed — dashboard is auth-gated)
- [x] Remove Settings panel API key section (or keep as legacy/optional override)

### 2. Endpoint Connection Testing
- [x] Add agent.testEndpoint tRPC procedure (publicProcedure) — POST to endpointUrl with sample payload
- [x] Returns: { ok: boolean, latencyMs: number, preview: string, error?: string }
- [x] Add "Test Connection" button in AgentRegistry Register tab
- [x] Show inline result: green success with latency + response preview, or red error
- [x] Warn (but don't block) registration if test fails

### 3. Registry Navbar Link
- [x] Add "Registry" link to Landing.tsx navbar (between "How it works" and "Sign in")
- [x] Link to /registry route

### 4. External Agent Execution Bridge
- [x] Add agent.routeTask tRPC procedure (protectedProcedure)
- [x] Accepts: agentId, task, context
- [x] POSTs to agent.endpointUrl with { task, context }
- [x] Returns: { result, latencyMs, success }
- [x] Calls updateReputation after execution
- [x] In MeshDashboard: after task submit, call agent.discover to find top external agent
- [x] If discovered agent found: add ExternalAgentCard to output panel alongside internal agents
- [x] ExternalAgentCard calls routeTask, displays result in same card format
- [x] Log external agent execution in saveTask (agentsUsed)

## Session 3 — Full Platform Completion

### Capability-Aware Discovery
- [x] Pass active context agent labels as capabilities to agent.discover in OutputPanel
- [x] Add connectionTested boolean field to agents table schema
- [x] Add Verified badge (green chip) to Registry public directory for tested agents
- [x] Update agent.register to accept connectionTested flag
- [x] Update AgentRegistry to set connectionTested=true after successful test

### Document Vault
- [x] Add documents table to drizzle schema (userId, filename, s3Key, s3Url, extractedText, createdAt)
- [x] Add vault.upload tRPC procedure — accepts base64 file, stores to S3, saves metadata to DB
- [x] Add vault.list tRPC procedure — returns user's uploaded documents
- [x] Add vault.delete tRPC procedure
- [x] Add DocumentVault UI panel in MeshDashboard (file picker, upload progress, document list)
- [x] Wire selected document's extractedText into vaultText passed to OutputPanel
- [x] Support PDF and plain text extraction server-side

### Agent Developer Docs Page (/build)
- [x] Create /build route in App.tsx
- [x] Create Build.tsx page with API contract, payload format, response format
- [x] Show scoring formula (capability 50% + success_rate 30% + latency 20%)
- [x] Show example agent code (Node.js + Python)
- [x] Add link to /build from Registry page and Landing navbar

### Reference Agent Package
- [x] Create /home/ubuntu/reference-agent/ standalone Express + TypeScript project
- [x] POST /execute endpoint accepting { task, context }
- [x] Calls invokeLLM-equivalent (Gemini API) and returns { result }
- [x] Includes README with deploy instructions for Railway/Render
- [x] Includes package.json, tsconfig, Dockerfile

### GitHub Export
- [x] Create public GitHub repo: agenthinkmesh
- [x] Push full project code
- [x] Write professional README with features, architecture, demo link, deploy instructions
- [x] Add architecture diagram (Mermaid)
