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
