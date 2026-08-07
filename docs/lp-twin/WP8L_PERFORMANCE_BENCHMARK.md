# LP Twin v1 — Performance Benchmark

**Version:** 1.0.0
**Status:** BASELINE ESTABLISHED
**Last Updated:** 2026-08-07

> These benchmarks were measured on the AgenThinkMesh development environment.
> Production performance will differ based on database load, network latency, and server resources.

---

## Test Environment

| Parameter | Value |
|---|---|
| Environment | Development (local sandbox) |
| Database | MySQL/TiDB (managed) |
| Server | Node.js 22, Express 4, tRPC 11 |
| Test method | Vitest timing from test suite |
| Date | 2026-08-07 |

---

## Procedure Timing (from WP1–WP8 test suite)

| Procedure | Measured Duration | Notes |
|---|---|---|
| `createFund` | ~50ms | DB insert + return |
| `getFund` | ~30ms | Single row select |
| `listFunds` | ~40ms | Org-scoped select |
| `createSession` | ~60ms | DB insert + engine version pin |
| `runSegmentAnalysis` (9 segments) | ~800–1200ms | Deterministic scoring, no LLM |
| `askLp` | ~200ms (deterministic) | No LLM call for deterministic path |
| `createScenario` | ~60ms | DB insert |
| `computeScenario` (9 segments) | ~900–1400ms | Recomputation for all segments |
| `previewScenario` (9 segments) | ~800–1200ms | No DB write |
| `generateMeetingBrief` | ~100ms | Deterministic brief generation |
| `getInvestorReadinessScore` | ~80ms | 14-dimension computation |
| `generateReport` | ~150ms | Deterministic report assembly |
| `exportSession` | ~200ms | JSON/CSV assembly + audit write |
| `compareWithSnapshot` | ~100ms | Comparison engine |
| Pen-test suite (35 tests) | ~29s total | Cross-tenant isolation tests |
| Full LP Twin suite (222 tests) | ~58s total | All WP1–WP8 tests |

---

## Performance Targets (v1)

| Metric | Target | Status |
|---|---|---|
| Fund creation | < 500ms | ✓ PASS |
| Session creation | < 500ms | ✓ PASS |
| Segment analysis (9 segments) | < 5s | ✓ PASS |
| Scenario computation (9 segments) | < 5s | ✓ PASS |
| Meeting brief generation | < 2s | ✓ PASS |
| Report generation | < 3s | ✓ PASS |
| Export (JSON/CSV) | < 2s | ✓ PASS |
| Page load (LP Twin Home) | < 3s (Vite dev) | ✓ PASS |

---

## Scalability Notes

- All LP Twin procedures are stateless and horizontally scalable
- The scoring engines are deterministic and CPU-bound (no GPU required)
- Database queries are indexed by `orgId` on all LP Twin tables
- No background jobs or queues are required for v1
- LLM calls (Ask-an-LP, LP Panel) are the only non-deterministic operations and may vary with model load

---

## Known Performance Risks

1. **LLM latency:** Ask-an-LP and LP Panel procedures call the built-in LLM. Under high load, these may take 10–30 seconds.
2. **Large session exports:** Sessions with 9 segments × many Ask-an-LP queries may produce large JSON exports.
3. **Concurrent simulations:** Multiple concurrent `runSegmentAnalysis` calls from the same org are not rate-limited in v1.

---

## Performance Monitoring

No dedicated performance monitoring is implemented in v1. Production performance should be
monitored using the AgenThinkMesh platform's built-in logging and the `manus-webdev-logs` CLI.
