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

## Session 4 — Arabic Data Annotation Pipeline

### Phase 1: Arabic Annotation Agents Service
- [ ] Build Gulf Dialect Sentiment Labeler agent
- [ ] Build Arabic NER (Named Entity Recognition) agent
- [ ] Build Islamic Finance Intent Classifier agent
- [ ] Build Arabic Legal Clause Extractor agent
- [ ] Build Arabic Code-Switch Detector agent
- [ ] Deploy all five Arabic agents on port 4001
- [ ] Validate all five endpoints with connection test payload

### Phase 2: Platform Schema + Procedures
- [ ] Add annotations table to drizzle schema
- [ ] Add annotation_exports table to drizzle schema
- [ ] Run pnpm db:push
- [ ] Add annotation.submit procedure (routes text to Arabic agent, stores structured result)
- [ ] Add annotation.list procedure (returns annotation history with filters)
- [ ] Add annotation.review procedure (approve/reject low-confidence annotations)
- [ ] Add annotation.export procedure (generate JSONL/CSV, upload to S3, return URL)

### Phase 3: Annotation Studio UI
- [ ] Create AnnotationStudio.tsx page at /annotate
- [ ] Arabic RTL text input panel
- [ ] Agent selector (choose annotation agent)
- [ ] Structured label display: label, confidence bar, dialect, rationale
- [ ] Review queue tab for low-confidence annotations
- [ ] Add /annotate route to App.tsx
- [ ] Add Annotate link to dashboard sidebar/navbar

### Phase 4: Dataset Export
- [ ] Export button with format selector (JSONL / CSV)
- [ ] annotation.export procedure returns S3 download URL
- [ ] Export history with record counts and download links

### Phase 5: Registry + Tests + Checkpoint
- [ ] Register all five Arabic agents in the database with verified status
- [ ] Write tests for annotation.submit, annotation.review, annotation.export
- [ ] TypeScript check — zero errors
- [ ] Save checkpoint

## Session 4b — Arabic Labeling as Flagship Feature

- [ ] Add Arabic Data Labeling hero section to Landing page (government-targeted)
- [ ] Add Arabic NLP stats bar to landing (dialects, entity types, annotation speed)
- [ ] Add "Arabic AI Infrastructure" positioning block with GCC govt use cases
- [ ] Build AnnotationStudio.tsx page at /annotate (RTL input, agent selector, structured output, review queue, export)
- [ ] Add /annotate route to App.tsx
- [ ] Add "Arabic Labeling" nav item to Landing navbar
- [ ] Add "Annotation Studio" sidebar entry in DashboardLayout
- [ ] Expose Arabic agents on port 4001 and register all 5 in database
- [ ] Write tests for annotation.submit, annotation.review, annotation.export
- [ ] TypeScript check and checkpoint

## Session 5 — Fix All 8 Gaps

- [ ] Gap 1: Deploy all 10 agents permanently, update DB endpoint URLs, verify each
- [ ] Gap 2: Batch annotation mode in AnnotationStudio (50 texts, table, JSONL download)
- [ ] Gap 3: Registry domain/capability filter bar (client-side, no backend changes)
- [ ] Gap 4: Arabic RTL rendering — dir=rtl + Noto Naskh Arabic font in AnnotationStudio
- [ ] Gap 5: Fine-tuning export format (openai JSONL) in annotation.export + UI option
- [ ] Gap 6: Developer onboarding email on agent.register
- [ ] Gap 7: Webhook support — optional webhookUrl on agents, async POST on routeTask complete
- [ ] Gap 8: Multi-tenant orgId — add to users + agents tables, filter queries by org

## Smart Agent Routing
- [x] Server-side routeAgents LLM procedure: analyse prompt and return list of relevant agent labels + confidence scores
- [x] Domain mismatch detection: if prompt doesn't match selected context, return suggested domain/context
- [x] MeshDashboard: call routeAgents before execution, show mismatch warning banner with suggested context
- [x] AgentCard: show dimmed "Not relevant for this task" state when agent is not in routed list
- [x] Show routing reasoning in the output panel header (e.g. "3 of 8 agents matched your task")
- [x] Run full test suite — 44 tests passing
- [x] Write new tests for routeAgents procedure (4 new tests)
- [x] Final TypeScript check
- [x] Save checkpoint
- [ ] Deliver updated technical brief PDF

## Session 6 — Bug Fixes

- [x] Fix External agent HTTP 429 error: show friendly rate-limit message instead of raw "Error: HTTP 429"
- [x] Make external agent execution non-blocking (don't count toward task completion gate)
- [x] Improve server-side routeTask to return structured error with retryAfter hint for 429

## Session 7 — Auto Context Switch on Mismatch

- [x] Auto-switch to the correct context when LLM detects domain mismatch
- [x] Load the correct agents for the switched context before execution
- [x] Show "Switched to X → Y based on your prompt" info banner
- [x] Persist the auto-switched context in localStorage

## Session 8 — Agent Discovery Animation

- [x] Add 3-phase assembly state: idle → scanning → assembling → executing
- [x] Phase 1 (Scanning): radar-sweep pulse overlay, shimmer placeholder rows, "Analysing prompt…" text
- [x] Phase 2 (Assembly): relevant agents appear one-by-one with ripple effect, agent chip tags appear in center overlay, "X/Y assembled" counter
- [x] Phase 3 (Execution): assembled agents start running, output panel slides in
- [x] Right-panel agent list: cards animate in sequentially with agent-card-in keyframe during assembly
- [x] CSS keyframe animations: pulse, radar-sweep, node-appear, node-ripple, agent-card-in, counter-tick, shimmer, slide-up-fade-in

## Session 9 — Bug Fix: Empty taskText on Agent Execution

- [x] Fix: agents receive empty taskText (Zod too_small error) after assembly animation
- [x] Root cause: role-change useEffect called setTask("") during auto-switch; fixed with suppressTaskResetRef + frozenTask state

## Session 10 — No Default Selection + Mismatch UX

- [x] Remove default context (VC/PE Fund) — dashboard starts with no context selected
- [x] Show "Type a prompt — the system will select the right agents" empty state when no context selected
- [x] Execute button works without pre-selected context — system auto-detects on first run
- [x] When user manually selects a context then types a mismatched prompt: show amber mismatch dialog with suggested context
- [x] "Run Anyway" executes with the user's chosen context even if it doesn't match
- [x] "Switch & Run" auto-switches to the correct context and executes
- [x] "Cancel" dismisses the dialog without running

## Session 11 — Final Summary Section

- [x] Add server-side mesh.summariseOutputs procedure: takes task + all agent outputs, calls LLM, returns structured summary (keyFindings, conflicts, nextActions, overallConfidence, oneLiner)
- [x] OutputPanel: after all agents complete, auto-trigger summariseOutputs and show Final Summary card at the bottom
- [x] Final Summary card: headline one-liner, key findings list, conflicts/gaps, recommended next actions, overall confidence badge
- [x] Show "Generating summary…" skeleton while LLM call is in progress
- [x] Allow user to copy the summary to clipboard

## Session 12 — PDF Export Fix

- [x] Fix Export button: use window.open + window.print() to produce a real PDF instead of downloading .html
- [x] Include Final Summary section in the exported PDF (captured via data-summary-content attribute)
- [x] Include all agent outputs in the export with proper HTML escaping

## Session 13 — Contact Us Section

- [x] Add contact_submissions table to database schema (migrated)
- [x] Add server-side contact.submit tRPC procedure: validates fields, saves to DB, sends Manus owner notification
- [x] Add Contact Us section to Landing.tsx (correct file — was incorrectly added to Home.tsx first)
- [x] Add Contact link to Landing.tsx navbar for direct scroll navigation
- [x] Show success state with checkmark after form submission
- [x] Notification content includes: sender name, email, company, message, UTC timestamp
- [x] Contact info displayed: kishore@agenthink.ai, website, GCC region

## Session 14 — Contact Us Update

- [x] Change displayed email from kishore@agenthink.ai to info@agenthink.ai in Landing.tsx
- [x] Remove Region row from contact info section
- [x] Send emails via FormSubmit.co to kishore@agenthink.ai (primary) and info@agenthink.ai (cc) on form submission
- [x] Manus owner notification sent as backup alongside FormSubmit emails

## Session 15 — Email Fix (Resend API)

- [x] Switch contact form to use activated farouq@agenthink.ai FormSubmit account
- [x] kishore@agenthink.ai added as CC recipient
- [x] _captcha disabled, _template table for clean email formatting

## Session 16 — Contact Form: Switch to Web3Forms (Browser-Side)

- [x] Remove tRPC contact.submit call from ContactSection — FormSubmit.co was blocked by Cloudflare
- [x] Implement browser-side fetch to https://api.web3forms.com/submit in Landing.tsx
- [x] Store Web3Forms access key as VITE_WEB3FORMS_ACCESS_KEY env var (exposed to frontend)
- [x] Form sends: access_key, subject, name, email, company, message, from_name
- [x] Sending state replaces isPending for button disabled/label logic
- [x] Vitest added: validates env var is set + confirms endpoint reachable (server-side 403 is expected by design)
- [x] All 46 tests passing, 0 TypeScript errors

## Session 17 — Mobile Layout Fixes

- [x] Audit Landing.tsx for fixed widths, overflow, and non-responsive inline styles
- [x] Fix hero section: headline, subheadline, CTA buttons stack properly on mobile
- [x] Fix navbar: hamburger menu or stacked layout on small screens
- [x] Fix stats bar: wrap/stack on mobile
- [x] Fix domain cards grid: 2-column on mobile (≤640px), 3-column on tablet (≤900px)
- [x] Fix How It Works section: single column on mobile
- [x] Fix Contact section: full-width form inputs on mobile, stacked layout
- [x] Fix footer: stacked layout on mobile
- [x] Fix horizontal overflow: overflowX hidden on root, reduced padding to 24px
- [x] Added responsive CSS classes for 640px and 900px breakpoints covering all grids

## Session 18 — Dashboard Mobile Responsiveness

- [x] Audit DashboardLayout sidebar for mobile overflow
- [x] Add collapsible sidebar with hamburger toggle on mobile (overlay with backdrop)
- [x] Fix MeshDashboard 3-column layout: single column on mobile (isMobile check)
- [x] Fix task input area: full-width on mobile, reduced padding 14px
- [x] Fix agent panel: bottom sheet on mobile with FAB toggle (⚡ button)
- [x] Fix OutputPanel: responsive padding and header wrapping on mobile
- [x] Fix AgentCard and ExternalAgentCard: already full-width (flex layout, no fixed widths)
- [x] Fix context switcher: sidebar becomes overlay on mobile, domain tabs intact
- [x] Fix topbar: hamburger on mobile, compact padding, truncated context badge
- [x] Verified: 0 TS errors, 46/46 tests pass, responsive breakpoints at 768px

## Session 19 — Navbar Mobile Fix
- [x] Fix logo overlap with MESH badge on mobile navbar
- [x] Fix nav links overflowing on mobile (hamburger menu) — removed inline display:flex so CSS media query works
- [x] Ensure proper z-index so navbar stays above all content (zIndex: 100)
- [x] Fix hero task input bar overflow on mobile (already handled by landing-nav-inner class)

## Session 20 — Mobile Upload Button
- [x] Add visible upload/attach button inside Task Command Center on mobile
- [x] Tapping it opens the Document Vault bottom sheet (same as the ⚡ FAB)

## Session 22 — Agent Card Hover Effects
- [x] Enrich AGENT_CARDS data with capabilities, task count, accuracy, and description
- [x] Add hover state to each card: expand height, reveal details panel with smooth CSS transition
- [x] Add "View agent →" link on hover pointing to /registry

## Session 23 — 3-Screen MVP Refactor
- [x] Add mesh_tasks table to drizzle schema and run db:push
- [x] Add mesh.analyze tRPC procedure: LLM intent classification + structured JSON result (taskType, summary, findings, risks, recommendation, confidenceScore, agentRoute)
- [x] Build AskScreen.tsx at /ask: center-aligned input, 6 example prompts, Analyze button, auth gate
- [x] Build ResultScreen.tsx at /result/:id: summary card, key findings, risks, segment insights, recommendation, mesh route transparency, polling while running
- [x] Build HistoryScreen.tsx at /history: task cards with status badge, confidence badge, exec time, date, link to result
- [x] Update App.tsx: /ask, /result/:id, /history routes added; /mesh remains as Advanced; landing hero CTA links to /ask
- [x] Write vitest tests for mesh.analyze, mesh.getTask, mesh.listTasks auth guards — 53/53 tests pass, 0 TS errors

## Session 24 — 3 Next Steps
- [x] Add "New Analysis" CTA button at bottom of ResultScreen with pre-fill support
- [x] Add /ask and /history links to dashboard sidebar (DashboardLayout) with Advanced section
- [x] Verify Ask→Result full flow end-to-end — 53/53 tests pass, 0 TS errors

## Session 25 — Color Palette Update (Mockup2 Neural Dark)
- [x] Update canvas node/ray colors to mockup2 5-color palette (#7BA3D4, #4ADE80, #F59E0B, #A78BFA, #60C8F5)
- [x] Update 4 agent card NEON_COLORS and progress bars to mockup2 exact colors (green, blue, amber, purple)
- [x] Update NeonDivider gradient to use all 5 mockup colors
- [x] Update stats row numbers to use new palette (green, sky, blue, purple)
- [x] Update live badge dot/text to green #4ADE80
- [x] Update "Google" headline gradient to #60C8F5 → #7BA3D4 → #4ADE80 → #A78BFA
- [x] Update search bar border and Activate mesh button to mockup blue palette

## Session 26 — Two-Column Hero Layout
- [x] Redesign NeonHero from narrow center-column to full-width two-column split (left: text/CTA/stats, right: canvas + floating agent cards)
- [x] Left panel: vertical accent line, live badge, headline, subtext, search bar, stats row
- [x] Right panel: canvas fills full height, 4 floating agent cards stacked on right edge with barFill animation
- [x] Left-to-right fade overlay blends canvas into left panel seamlessly
- [x] Responsive: stacks vertically on ≤900px (tablet), canvas 420px tall; ≤640px canvas 320px
- [x] 53/53 tests pass, 0 TypeScript errors

## Session 27 — Mobile Layout Fix
- [x] Fix hero section mobile layout: proper single-column stacking, readable headline, visible search bar and CTA
- [x] Fix navbar on mobile: hamburger menu visible, no overflow
- [x] Fix canvas height on mobile so it doesn't take excessive space (360px tablet, 280px phone)
- [x] Fix floating agent cards on mobile: 2x2 grid at bottom of canvas; hidden on phones to reduce clutter
- [x] Fix stats row on mobile: flex-wrap with gap
- [x] Verify no horizontal overflow on any screen size (overflow-x: hidden on root + hero)
- [x] Search bar stacks vertically on phones (input + full-width CTA button)
- [x] 53/53 tests pass, 0 TypeScript errors

## Session 28 — Mobile Agent Cards Fix
- [x] Show 4 agent cards on phones as horizontal scrollable strip overlaid on canvas (rays behind, cards in front)
- [x] Increase canvas height on phones to 380px to give enough room for cards + animation

## Session 29 — Mobile Cards Vertical Layout
- [x] Change mobile agent cards from horizontal scroll to vertical 2x2 grid overlaid on canvas
- [x] Increase canvas height to 460px to fit 2x2 grid comfortably

## Session 30 — Mobile Canvas Top Gradient
- [x] Add dark top-fade gradient overlay on canvas panel on mobile to blend rays into stats row (80px, #060D1A → transparent, z-index 3, active at ≤900px)

## Session 31 — Mobile Canvas Bottom Gradient
- [x] Add bottom-fade gradient overlay on canvas panel on mobile (100px, transparent → #060D1A, z-index 3, active at ≤900px)

## Session 32 — Sign-in Fix
- [x] Diagnose OAuth sign-in: auth was working but callback redirected to / (public landing) instead of /ask
- [x] Fix: encode returnPath=/ask in login state; OAuth callback now redirects to returnPath after login
- [x] Fix: Landing page now auto-redirects authenticated users to /ask via useEffect
- [x] 52/53 tests pass (1 pre-existing network failure: web3forms.test.ts ECONNRESET in sandbox)

## Session 33 — File Attachment on /ask Page
- [x] Add paperclip/attach button to task input box in AskScreen
- [x] Upload file to S3 on selection, show inline filename chip with remove button
- [x] Pass fileUrl + fileName to task submission (tRPC mutation)
- [x] Update server router: new uploadAttachment procedure + analyze accepts optional fileUrl/fileName
- [x] 2 new vitest tests for uploadAttachment (55/55 tests pass)
- [ ] Show attached file in ResultScreen alongside task description (future improvement)

## Session 34 — File Content Extraction in Analyze
- [x] Download attached file from S3 URL on server when fileUrl is provided (downloadBuffer with redirect following)
- [x] Parse file content by type: XLSX/XLS (all sheets as CSV), CSV, TXT (raw), PDF (pdf-parse), DOCX/DOC (mammoth)
- [x] Inject extracted file content into fullQuery used by all 5 LLM agent calls
- [x] Created server/fileExtract.ts helper with 80k char limit to avoid context overflow
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 35 — Structured Financial Result Screen
- [x] Add Agent 6 (Financial Report Writer) producing structured JSON: executiveSummary, senseCheck, balanceSheet, cashFlowStatement, dcfValuation, keyMetrics, nextSteps
- [x] Add structuredReport + fileUrl + fileName columns to meshTasks schema; migration pushed (0010)
- [x] ResultScreen now renders: Executive Summary, Sense Check (with verdict badge), Key Metrics grid, Balance Sheet table, Cash Flow Statement table, DCF Valuation with assumptions, Next Steps
- [x] Attached filename shown as green chip in result header
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 36 — ResultScreen Crash Fix
- [x] Fix TypeError crash on result page: added safeParse() wrapper in getTask (handles malformed JSON from LLM), normalised all structuredReport nested arrays to [] fallback, added ?? [] guards on all .map() calls in ResultScreen. 55/55 tests pass.

## Session 37 — Segment Insights Fix
- [x] Hide generic Segment Insights section when structuredReport is present (financial tasks) — now only shown for non-financial tasks
- [x] Add revenueSegments field to Agent 6 prompt and JSON schema (extracts actual revenue lines from spreadsheet)
- [x] Show Revenue Segment Breakdown section in result screen for financial tasks (replaces generic market segments)
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 38 — Sense Check Observations Fix
- [x] Fix Sense Check observations: strengthened Agent 6 prompt to require ≥3 observations; added required:["verdict","observations"] to JSON schema; minItems:1 enforced. 55/55 tests pass.

## Session 39 — Download as PDF
- [ ] Add server-side PDF generation endpoint using pdfkit
- [ ] Add Download as PDF button to ResultScreen navbar
- [ ] PDF includes: header with task type/date, Executive Summary, Sense Check observations, Key Metrics, Balance Sheet table, Cash Flow table, DCF Valuation, Next Steps
- [ ] Write vitest test for the PDF generation procedure

## Session 39 — Download as PDF
- [x] Add ⬇ Download PDF button to result screen navbar (green, with spinner during generation)
- [x] Created server/pdfReport.ts using pdfkit — renders Executive Summary, Sense Check, Key Metrics, Balance Sheet, Cash Flow, DCF Valuation, Next Steps
- [x] Added mesh.downloadPdf tRPC protected procedure (generates PDF, returns base64 + filename)
- [x] Client decodes base64 → Blob → URL.createObjectURL → triggers browser download
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 40 — AskScreen Crash Fix
- [x] Fix "Cannot read properties of undefined (reading '0')" on /ask page after file attachment — safely stringify error.message before rendering in error banner

## Session 41 — Deep Fix: AskScreen Crash
- [x] Find the real root cause of "Cannot read properties of undefined (reading '0')" crash on /ask page
- [x] Root cause: LLM returns segmentInsights/keyFindings/risks as null instead of array; server crashes at null[0] access
- [x] Fix: Added null-safety guards for all LLM response arrays in analyze procedure (intentData.meshRoute, findings.keyFindings, risksData.risks, segments.segmentInsights, reportData.recommendation)
- [x] Fix: AskScreen error banner now safely stringifies error.message regardless of type
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 42 — Portfolio Intelligence 5-Screen UX

- [x] Screen 1: Portfolio Intelligence Home (/portfolio) — 2x2 workflow card grid
- [x] Screen 2: Document Upload (/portfolio-review/upload) — drag-and-drop, metadata fields
- [x] Screen 3: Analysis Processing (/portfolio-review/analyzing) — 5-step progress indicator
- [x] Screen 4: Portfolio Review Report (/portfolio-review/report/:id) — structured institutional report
- [x] Screen 5: Vault (/vault) — history of past analyses with re-run capability
- [x] Backend: portfolioReview tRPC router (create, analyze, get, list, uploadDocument)
- [x] DB schema: portfolioReviews table (pushed to DB)
- [x] Navigation: add Portfolio Intelligence link to Landing nav + AskScreen nav
- [x] Route registration in App.tsx

## Session 43 — Async 28-Slide PPTX Export

- [x] Install pptxgenjs dependency
- [x] DB schema: add pptxUrl, pptxStatus, pptxJobStartedAt columns to portfolioReviews (migrated)
- [x] server/pptxGenerator.ts: 28-slide institutional deck builder (navy/gold palette)
- [x] tRPC: portfolio.exportPptx mutation (start async job, store in S3)
- [x] tRPC: portfolio.getExportStatus query (poll pptxStatus + pptxUrl)
- [x] PortfolioReport.tsx: Export to PowerPoint button + progress indicator + download link
- [x] PortfolioVault.tsx: PPTX download icon on completed reviews
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 44 — 100-Hour Turnaround Workflow

- [x] DB schema: turnaroundSessions table (id, userId, companyName, industry, crisisType, status, agentOutputs JSON, alertsJson, reportJson, pdfUrl, pdfStatus, createdAt)
- [x] DB push migration
- [x] /portfolio home: replace one "coming soon" card with 100-Hour Turnaround live workflow card
- [x] /turnaround — Workflow home screen (explainer + activate button)
- [x] /turnaround/upload — Document upload with 6-agent assignment UI
- [x] Backend: turnaround.create mutation (create session, start 6 agents async)
- [x] Backend: 6 agent LLM procedures (Financial Sentinel, Customer Pulse, Workflow Optimizer, Narrative Architect, Compliance Guardian, Resilience Logger)
- [x] Backend: turnaround.getStatus query (poll agent progress + alerts)
- [x] Backend: turnaround.getReport query (full structured output)
- [x] Backend: turnaround.exportPdf mutation (async PDF export job)
- [x] /turnaround/command/:id — Live command centre (countdown, 6 agent cards, leadership alerts)
- [x] /turnaround/report/:id — Full structured report with PDF export
- [x] App.tsx: register all 4 new routes
- [x] Nav: add Turnaround link to relevant nav bars
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 45 — Turnaround Nav + Demo Mode

- [x] Add "Turnaround" link to AskScreen top nav bar
- [x] Add "Turnaround" link to Landing page top nav (desktop + mobile menu)
- [x] TurnaroundUpload: "Load Demo Company" button with pre-filled synthetic GCC scenario (Al-Rashid Retail Group, Kuwait)
- [x] Demo scenario: company name, industry, crisis type, and synthetic financial document auto-uploaded to Financial Sentinel
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 46 — Mesh Identity Layer (3-Stage Personalisation)

- [x] DB schema: userProfiles table (20 columns) — pushed to DB
- [x] tRPC: identity.classifyPersona mutation (Stage 1 — LLM call, create/update userProfile)
- [x] tRPC: identity.inferFromFirstQuery mutation (Stage 2 — silent, runs on first query)
- [x] tRPC: identity.refineSession mutation (Stage 3 — silent, runs every 5 sessions)
- [x] tRPC: identity.getProfile query (read userProfile for current user)
- [x] tRPC: identity.dismissNudge mutation (clear nudge_message after shown)
- [x] tRPC: identity.recordSession mutation (increment session count, append agents used)
- [x] PersonaSelector.tsx: 13 visual tile cards at /persona-setup
- [x] Route: /persona-setup — redirect here if user has no userProfile after login
- [x] AskScreen: Stage 2 silent hook on first query submission (session_count === 0)
- [x] AskScreen: Stage 3 silent hook every 5 sessions (session_count % 5 === 0)
- [x] AskScreen: dismissable nudge banner (shown once, cleared after dismiss)
- [x] AskScreen: personalised hero text driven by active_persona
- [x] App.tsx: /persona-setup route registered
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 47 — Closed Curated Registry

- [x] agents table: add version varchar(32) default "1.0.0"
- [x] agents table: add lastVerifiedAt timestamp (nullable)
- [x] agents table: add failCount int default 0
- [x] agents table: add "degraded" to status enum
- [x] DB push migration (drizzle/0015_shiny_wolfpack.sql)
- [x] Seed 15 domain agents (5 GCC Finance, 3 Islamic Finance, 3 Arabic NLP, 4 Legal/Compliance)
- [x] server/jobs/healthCheck.ts: ping all active/degraded agents every 30 min, update failCount/status/lastVerifiedAt
- [x] Wire health-check cron into server startup via node-cron (runs on startup + every 30 min)
- [x] agent.discover: filter out agents where lastVerifiedAt older than 24h (exclude stale)
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 48 — UAE Demo Scenario

- [x] TurnaroundUpload: add second demo button "Load UAE Demo" (Khaleeji Properties, Dubai real estate, project financing gap)
- [x] UAE demo: 600-word synthetic project financing crisis brief (Khaleeji Properties, Dubai Marina tower, AED 380M, RERA refund risk) pre-loaded into Financial Sentinel slot
- [x] UI: two demo buttons side by side (🇰🇼 Kuwait Retail + 🇦🇪 UAE Real Estate), each with independent loaded/clear state
- [x] 55/55 tests pass, 0 TypeScript errors

## Session 49 — Bug Fix: PersonaSelector

- [ ] Fix: "Confirm & Enter Mesh" button stays greyed out even after tile selection
- [ ] Fix: button should navigate to /ask after classifyPersona mutation succeeds
- [ ] 55/55 tests pass, 0 TypeScript errors

## Session — Landing Page Flow (Mar 15 2026)

- [x] Add domain field to agents schema and push migration
- [x] Seed domain-tagged built-in agents into DB for all 5 domains
- [x] Add backend: agent.listByDomain procedure (public, returns agents for a domain)
- [x] Add backend: agent.createCustom procedure (authenticated, LLM-powered agent creation)
- [x] Build DomainAgents page (/domain/:name) with agent grid + custom agent prompt
- [x] Update Landing page: add "Try the Mesh →" CTA button → /persona-setup
- [x] Update Landing page: make domain cards clickable → /domain/:name with "Try" button
- [x] Register /domain/:name route in App.tsx

## Persona-Setup Agent Selection Flow (Mar 15 2026)
- [x] Rebuild PersonaSelector: tile click shows domain agents panel
- [x] Agent list panel: fetches agents via agent.listByDomain for the tile's domain
- [x] User selects an agent from the list
- [x] Confirm button fires classifyPersona + navigates to /ask with agent pre-selected
- [x] Pass selected agent context to /ask via URL param (?agent=id&agentName=...)

## Session: Landing Page Cleanup & Navbar Domains Dropdown

- [x] Remove Features section from landing page
- [x] Remove How it works section from landing page
- [x] Remove Use cases section from landing page
- [x] Remove Arabic Data Labeling section from landing page
- [x] Clean navbar: remove Registry, Arabic Labeling, Build, Features, How it works links
- [x] Add Domains dropdown to navbar with all 16 domain tiles (2-column grid, icons, Try the Mesh CTA)
- [x] Add mobile menu Domains list with all 16 domains
- [x] Landing page now flows: Hero → Domain Showcase → Bottom CTA → Contact → Footer

## Session: CTA Consistency & Skip Now Removal

- [x] Standardize all CTA buttons on landing page to use the same primary color (blue-to-green gradient)
- [x] Remove "Skip now" link from /ask page top-right corner

## Session: Fix Domains vs Personas Confusion

- [x] Replace persona/role names in Domains navbar dropdown with true domain names (Finance, Legal, Healthcare, Enterprise, GCC Wealth, etc.)
- [x] Redesign PersonaSelector Step 1 to show true domains instead of job titles
- [x] Ensure domain tile IDs match the agent seeding domain names in the DB

## Session: Remove Domains Dropdown

- [x] Replace Domains dropdown in navbar with a simple anchor link that scrolls to the domain showcase section

## Session: Animated How It Works Section

- [x] Build animated HowItWorks component with 4 steps: select role, pick agents, run & get output, create new agent
- [x] Integrate HowItWorks section into Landing page between hero and domain showcase

## Session: HowItWorks CTA Button

- [x] Add "Try it yourself" CTA button at the bottom of the How It Works section linking to /persona-setup

## Session: Role-first flow & cleanup

- [x] Remove "Your mesh is ready. Are you?" section from landing page
- [x] Fix PersonaSelector to show roles (Doctor, Lawyer, Manager, etc.) as Step 1 instead of domains

## Session: 2-step role → agents flow

- [x] Simplify PersonaSelector to 2 steps: Step 1 = role selection, Step 2 = agents list for that role's domain (no domain confirmation step)

## Session: Agent count badges on role tiles

- [x] Add agent count badges to each role tile on PersonaSelector Step 1

## Session: Consistent sticky navbar across all pages

- [x] Create shared SiteNav component with sticky positioning
- [x] Replace Ask page navbar with shared SiteNav
- [x] Replace PersonaSelector navbar with shared SiteNav
- [x] Ensure Landing page navbar is sticky on scroll

## Session: Fix PDF Export

- [x] Fix Download PDF button on ResultScreen — PDF not opening / corrupted

## Session: Dynamic roles from DB

- [x] Display all roles/domains from DB on PersonaSelector with live agent counts sorted A-Z

## Session: Roles from DB (Step 1)

- [x] Add roles table to DB schema with fields: id, name, icon, color, domain, persona, description, sortOrder
- [x] Seed all roles (Doctor, Lawyer, Manager, Banker, etc.) into DB
- [x] Add listRoles tRPC procedure returning all roles sorted A-Z with agent counts
- [x] Update PersonaSelector Step 1 to show roles from DB dynamically

## Session: Role card agent count footer

- [x] Move agent count badge to bottom-left footer of each role card on PersonaSelector

## Force Majeure Contract Agent (Lean Build)

- [x] Seed Force Majeure agent in DB under Legal domain
- [x] Install pdf-parse and mammoth for PDF/DOCX text extraction
- [x] Build server/forceMajeureRoute.ts with file upload + 4-layer LLM pipeline
- [x] Build ForceMajeureAgent.tsx two-panel frontend component with RTL support
- [x] Add PDF export of agent output (jsPDF)
- [x] Wire route /agents/force-majeure in App.tsx
- [x] Register in agent catalogue (DB seeded, isBuiltIn=true, domain=Legal)

## Session: Force Majeure Card on Legal Domain Page

- [x] Add Force Majeure agent launch card to /domain/Legal page with description and "Launch Agent" button linking to /agents/force-majeure

## Session: Force Majeure in Lawyer Onboarding

- [x] Show Force Majeure Contract Agent in PersonaSelector Step 2 when Lawyer role is selected

## Game Theory Investment Decision Agent

- [x] Build server/gameTheoryRoute.ts — single-pass LLM with JSON schema (6 fields)
- [x] Register route in server/_core/index.ts
- [x] Seed agent in DB under Finance domain (isBuiltIn=true)
- [x] Build client/src/pages/GameTheoryAgent.tsx — verdict + 6 panels, mobile-first
- [x] Add /agents/game-theory route in App.tsx
- [x] Pin card to Finance and GCC Wealth domain pages
- [x] Inject card into PersonaSelector Step 2 for Fund Manager and GCC Wealth roles

## Landing Page Nav

- [x] Add Agent Registry link to landing page top navigation menu

## User Logout

- [x] Add user avatar/name dropdown with logout to SiteNav for all authenticated pages

## Nav / Auth UX

- [x] Redirect after login to /persona-setup instead of /ask
- [x] Show only avatar icon in nav (no name text) after login

## Landing Page Dynamic Counts

- [x] Add tRPC publicStats procedure returning live agent count and domain count from DB
- [x] Replace static numbers on landing page with live DB values

## Registry Pagination

- [x] Add agent.count tRPC procedure returning total active agent count
- [x] Add pagination controls to AgentRegistry directory tab (prev/next, page X of Y, total count)

## Landing Page Total Agent Count

- [x] Align agent.count procedure to count all agents (no status filter) so registry shows same total as landing page

## ETF Launch Studio Integration (Lean)

- [x] Upload AgenThinkMesh_ETF_Studio.html to CDN
- [x] Modify HTML to proxy Claude calls through server instead of direct browser calls
- [x] Create ETFStudio.tsx page with full-screen iframe and back button
- [x] Add ETF Launch Studio card to Finance domain page (DomainAgents.tsx)
- [x] Add /agents/etf-studio route to App.tsx
- [x] Build Express endpoint POST /api/etf/claude-proxy (fixes API key exposure)
- [x] Build Express endpoint POST /api/etf/shariah-screen (synthetic data from Python logic)
- [x] Build Express endpoint GET /api/etf/backtest-summary (returns hardcoded backtest numbers)
- [x] Build Express endpoint GET /api/etf/nav (returns synthetic NAV data)
- [x] Register all ETF routes in server/_core/index.ts

## ETF Launch Studio — Standard Tier

- [x] Wire GET /api/etf/macro-overlay endpoint (regime signal: RISK_ON/RISK_OFF, oil momentum)
- [x] Wire GET /api/etf/liquidity-scores endpoint (per-stock Amihud scores for BK Premier universe)
- [x] Wire GET /api/etf/momentum-factors endpoint (12-1 month momentum scores)
- [x] Wire GET /api/etf/index-weights endpoint (CMA 20% cap applied weights)
- [x] Seed ETF Launch Studio as named agent in agents DB table (isBuiltIn=true, domain=Finance)
- [x] Add ETF Studio card to PersonaSelector Step 2 for Fund Manager and Investor roles
- [x] Add Share button to ETFStudio.tsx (generates WhatsApp/email-ready summary)
- [x] Build Partner CRM: DB schema (partner_institutions + partnership_requests tables), tRPC procedures, Request Partnership modal
- [x] PartnerCRM.tsx page at /etf/partners with institution table, stats row, and Request Partnership modal
- [x] Partners button added to ETFStudio top bar

## Landing Page Finance Spotlight

- [x] Add Finance spotlight card to landing page domain showcase linking to /agents/etf-studio

## Bug Fixes

- [x] Fix missing React key prop warning in Step3Output component

## Full Claude Response Fix

- [x] Audit ETF Studio claude-proxy for max_tokens truncation (no issue — uses 32768 default)
- [x] Audit Game Theory Agent LLM call for max_tokens truncation — raised to 4000, expanded field depth instructions
- [x] Audit Force Majeure Agent LLM pipeline for max_tokens truncation — raised to 4000, expanded Layer 2 reasoning depth
- [x] Audit Mesh /ask page LLM calls for truncation — raised from 2000 to 8000, expanded system prompt for institutional depth
- [x] Fix all truncation issues so full responses are returned and displayed

## Rate Limiter + Usage Dashboard

- [x] Add llm_usage and high_demand_log tables to drizzle schema and push migration
- [x] Build llmRateLimit middleware: 10 req/IP/day, 2000 token cap per request
- [x] Build daily 50k token circuit breaker with high-demand logging
- [x] Apply rate limiter to Mesh /ask, Game Theory, Force Majeure, ETF claude-proxy
- [x] Build admin-only UsageDashboard.tsx with daily token consumption charts and high-demand log
- [x] Add /admin/usage route to App.tsx
- [x] Add Usage Dashboard link to admin dropdown in SiteNav

## Intent Classifier + Execution Layer (Option A)

- [x] Design 6 intent types: analysis, draft_document, generate_code, decision, compliance_check, qa_test
- [x] Add fast Intent Classifier pre-pass to runAgentTask (single LLM call, ~200 tokens, JSON schema output)
- [x] Build output template for draft_document (email, letter, proposal, NDA) — produces actual draft
- [x] Build output template for generate_code — produces runnable code + explanation
- [x] Build output template for decision (buy/sell/hold, approve/reject) — verdict + rationale
- [x] Build output template for compliance_check — status + gaps + actions + deadlines
- [x] Build output template for qa_test — test cases + results + bugs + fix priority
- [x] Keep existing analysis template as default fallback
- [x] Update MeshDashboard UI to render execution outputs with appropriate formatting (code blocks, letter layout, verdict badges)
- [x] Write vitest tests for intent classification logic (30 new tests)
- [x] Save checkpoint

## Quick-Task Copy + Save to Vault

- [x] Update quickTasks in meshData.ts to execution-framing prompts across all 14 contexts
- [x] Add Save to Vault button on completed agent output cards (all intent types)
- [x] Add saveAgentOutput tRPC mutation to create a vault document from agent output text
- [x] Show success state (✓ Saved to Vault) when output is saved to Vault

## Bug Fix: mesh.analyze pipeline ignores Intent Classifier

- [x] Add Intent Classifier to mesh.analyze procedure (same 6 intents as runAgentTask)
- [x] Branch analysis prompt in mesh.analyze based on detected intent
- [x] Update pdfReport.ts to render draft/code/decision outputs correctly (not as analysis report)
- [x] Ensure PDF title reflects intent type (e.g. "Email Draft" not "Structured Analysis Report")
