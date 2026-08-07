# LP Twin v1 — Documentation Index

**Version:** 1.0.0
**Status:** COMPLETE
**Last Updated:** 2026-08-07

---

## Documentation Suite

All LP Twin v1 documentation is located in `docs/lp-twin/`.

| Document | File | Audience | Status |
|---|---|---|---|
| Customer Intake Package | `WP8G_CUSTOMER_INTAKE_PACKAGE.md` | Founding customers | ✓ Ready |
| Founding Engagement Package | `WP8H_FOUNDING_ENGAGEMENT_PACKAGE.md` | Founding customers | ✓ Ready |
| Customer Role Matrix | `WP8I_CUSTOMER_ROLE_MATRIX.md` | Admins, customers | ✓ Ready |
| Model Cards (6 engines) | `WP8J_MODEL_CARDS.md` | Technical, customers | ✓ Ready |
| Commercial Claims Review | `WP8K_COMMERCIAL_CLAIMS_REVIEW.md` | Internal | ✓ Ready |
| Performance Benchmark | `WP8L_PERFORMANCE_BENCHMARK.md` | Engineering | ✓ Ready |
| Backup and Recovery Rehearsal | `WP8M_BACKUP_RECOVERY_REHEARSAL.md` | Engineering, ops | ✓ Ready |
| Documentation Index | `WP8N_DOCUMENTATION_INDEX.md` | All | ✓ Ready |
| Success Metrics Framework | `WP8O_SUCCESS_METRICS.md` | Internal, customers | ✓ Ready |
| E2E Founding Customer Rehearsal | `WP8E_FOUNDING_CUSTOMER_REHEARSAL.md` | Engineering, ops | ✓ Ready |
| Release Candidate Report | `WP8P_RELEASE_CANDIDATE.md` | All | ✓ Ready |

---

## Technical Documentation

| Document | Location | Description |
|---|---|---|
| Database schema | `drizzle/schema.ts` | All 13 LP Twin tables |
| Backend router (core) | `server/routers/lpTwin.ts` | 12 core procedures |
| Backend router (scenarios) | `server/routers/lpTwinScenario.ts` | 14 scenario procedures |
| Backend router (meeting) | `server/routers/lpTwinMeeting.ts` | 20 meeting procedures |
| Backend router (validation) | `server/routers/lpTwinValidation.ts` | 20 validation procedures |
| LP Agent Bank | `shared/captwin/agentBank.ts` | 9 segments, 26 attributes |
| Fit Engine v2 | `shared/captwin/fitEngine.ts` | 18-dimension scoring |
| Objection Engine v2 | `shared/captwin/objectionEngine.ts` | 30-category registry |
| Scenario Engine v1 | `shared/captwin/scenarioEngine.ts` | Fund-term laboratory |
| Meeting Engine v1 | `shared/captwin/meetingEngine.ts` | Brief, rehearsal, panel |
| Readiness Engine v1 | `shared/captwin/readinessEngine.ts` | 14-dimension readiness |
| Validation Engine v1 | `shared/captwin/validationEngine.ts` | Comparison and quality |

---

## Test Documentation

| Test file | Tests | Coverage |
|---|---|---|
| `lpTwin.wp1.test.ts` | 19 | Schema, tenant isolation |
| `lpTwin.wp2.test.ts` | 15 | Core router procedures |
| `lpTwin.wp3.test.ts` | 15 | Frontend contracts |
| `lpTwin.wp4.test.ts` | 41 | Fit engine, objection engine, Ask-an-LP |
| `lpTwinScenario.wp5.test.ts` | 32 | Scenario engine |
| `lpTwinMeeting.wp6.test.ts` | 30 | Meeting, readiness, reports |
| `lpTwinValidation.wp7.test.ts` | 35 | Validation foundation |
| `lpTwin.wp8.pentest.test.ts` | 35 | Cross-tenant penetration |
| **Total** | **222** | **Full LP Twin v1** |

---

## Frontend Routes

| Route | Component | Description |
|---|---|---|
| `/captwin/lp-twin` | `LPTwin.tsx` | LP Twin Home |
| `/captwin/lp-twin/fund/new` | `LPTwinFundWizard.tsx` | New fund wizard |
| `/captwin/lp-twin/fund/:id` | `LPTwinFundDetail.tsx` | Fund detail (read-only) |
| `/captwin/lp-twin/fund/:id/edit` | `LPTwinFundWizard.tsx` | Edit fund |
| `/captwin/lp-twin/new` | `LPTwinSessionCreate.tsx` | New simulation session |
| `/captwin/lp-twin/:id` | `LPTwinSession.tsx` | Session results |
| `/captwin/lp-twin/laboratory` | `LPTwinLaboratory.tsx` | Fund-Term Laboratory |
| `/captwin/lp-twin/meeting/:sessionId` | `LPTwinMeetingRoom.tsx` | LP Meeting Room |
| `/captwin/lp-twin/agents` | `LPTwinAgentBank.tsx` | LP Agent Bank view |
| `/captwin/lp-twin/pipeline` | `LPTwinPipeline.tsx` | Fundraising Pipeline |
| `/captwin/lp-twin/actual/:sessionId` | `LPTwinActualMeeting.tsx` | Actual meeting capture |
| `/captwin/lp-twin/reports` | `LPTwinReports.tsx` | Reports |
| `/captwin/lp-twin/validation` | `LPTwinValidation.tsx` | Validation dashboard |
