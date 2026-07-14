# Project TODO

- [x] Audit the existing fleet scheduler, fixed-pool generation behavior, corpus structure, scoring pipeline, reporting, and production costs
- [x] Change the canonical Manus scheduler from daily at 03:00 Asia/Kuwait to weekly on Monday at 03:00 Asia/Kuwait without changing secrets or credentials
- [x] Restore and synchronize the net-new candidate generation and all-history domain–sub-sector–region novelty gate after the sandbox reset
- [x] Restore full scoring for net-new candidates and light status-only re-checks for the current ENGAGE shortlist, excluding WATCH and PASS
- [x] Restore weekly delta persistence and summary email output with candidate, novelty, new ENGAGE, status-flip, and cost metrics
- [x] Preserve execution_score logic without modification
- [ ] Verify the current ENGAGE shortlist and projected weekly-versus-daily cost delta
- [ ] Run focused Vitest coverage, TypeScript checks, and the production build
- [ ] Save a deployable project checkpoint
- [ ] Deliver one implementation document with exact old-versus-new configuration values, architecture findings, novelty-gate logic, cost delta, limitations, and the ENGAGE baseline
