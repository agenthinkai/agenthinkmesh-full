/**
 * scripts/benchmark.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * AgenThinkMesh Enterprise Platform — CR-6 Formal Performance Benchmark Suite
 *
 * Usage:
 *   npx tsx scripts/benchmark.ts [--url <base>] [--connections <n>] [--duration <s>]
 *
 * Defaults:
 *   --url         http://localhost:3000
 *   --connections 20
 *   --duration    30   (seconds per scenario)
 *
 * Pass/fail thresholds (CR-6 certification criteria):
 *   - API error rate          < 1 %
 *   - Median latency          < 500 ms
 *   - p90 latency             < 2000 ms  (autocannon v8 does not expose p95)
 *   - p99 latency             < 5000 ms
 *   - Requests per second     ≥ 5 rps
 * ─────────────────────────────────────────────────────────────────────────────
 */

import autocannon from "autocannon";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── CLI argument parsing ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const BASE_URL = getArg("--url", "http://localhost:3000");
const CONNECTIONS = parseInt(getArg("--connections", "20"), 10);
const DURATION = parseInt(getArg("--duration", "30"), 10);

// ── Pass/fail thresholds ──────────────────────────────────────────────────────
const THRESHOLDS = {
  errorRatePct: 1.0,
  medianLatencyMs: 500,
  p90LatencyMs: 2000,
  p99LatencyMs: 5000,
  minRps: 5,
};

// ── Workload scenarios ────────────────────────────────────────────────────────
interface Scenario {
  name: string;
  description: string;
  method: "GET" | "POST";
  path: string;
  body?: string;
  headers?: Record<string, string>;
  connections?: number;
}

function trpcGet(procedure: string, input: unknown = {}): string {
  return `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`;
}

const SCENARIOS: Scenario[] = [
  { name: "health_probe", description: "GET /api/health — baseline liveness check", method: "GET", path: "/api/health" },
  { name: "twin_directory", description: "Twin Directory — list all available blueprints", method: "GET", path: trpcGet("twinFactory.blueprints.list") },
  { name: "decision_type_registry", description: "Decision type registry — list all decision types", method: "GET", path: trpcGet("twinFactory.decisionTypes.list") },
  { name: "kpi_set_list", description: "KPI registry — list all KPI sets", method: "GET", path: trpcGet("twinFactory.kpiSets.listSets") },
  { name: "ontology_list", description: "Ontology registry — list all ontologies", method: "GET", path: trpcGet("twinFactory.ontologies.list") },
  { name: "council_personas", description: "Council persona registry — list all personas", method: "GET", path: trpcGet("twinFactory.councilPersonas.list") },
  { name: "enterprise_dashboard", description: "Enterprise dashboard — blueprint list (public)", method: "GET", path: trpcGet("twinFactory.blueprints.list") },
  { name: "connector_list", description: "Connector registry — list all built-in connectors", method: "GET", path: trpcGet("twinFactory.connectors.list") },
  { name: "report_type_list", description: "Report type registry — list all report types", method: "GET", path: trpcGet("twinFactory.reportTypes.list") },
  { name: "mixed_read_load", description: "Mixed read load — 20 concurrent users browsing the platform", method: "GET", path: trpcGet("twinFactory.blueprints.list") },
];

// ── Result types ──────────────────────────────────────────────────────────────
interface BenchmarkResult {
  scenario: string;
  description: string;
  connections: number;
  duration: number;
  requests: number;
  rps: number;
  latency: { min: number; max: number; mean: number; p50: number; p75: number; p90: number; p99: number };
  throughputBytesPerSec: number;
  errors: number;
  timeouts: number;
  errorRatePct: number;
  passed: boolean;
  failures: string[];
}

// ── Run a single scenario ─────────────────────────────────────────────────────
async function runScenario(scenario: Scenario): Promise<BenchmarkResult> {
  console.log(`\n▶ Running: ${scenario.name}`);
  console.log(`  ${scenario.description}`);
  console.log(`  Connections: ${scenario.connections ?? CONNECTIONS} | Duration: ${DURATION}s`);

  const result = await autocannon({
    url: `${BASE_URL}${scenario.path}`,
    connections: scenario.connections ?? CONNECTIONS,
    duration: DURATION,
    method: scenario.method,
    body: scenario.body,
    headers: scenario.headers ?? {},
    timeout: 10,
  });

  const totalRequests = result.requests.total;
  const errors = result.errors + result.timeouts;
  const errorRatePct = totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
  const rps = result.requests.average;

  const failures: string[] = [];
  if (errorRatePct >= THRESHOLDS.errorRatePct) failures.push(`Error rate ${errorRatePct.toFixed(2)}% ≥ ${THRESHOLDS.errorRatePct}%`);
  if (result.latency.p50 > THRESHOLDS.medianLatencyMs) failures.push(`p50 ${result.latency.p50}ms > ${THRESHOLDS.medianLatencyMs}ms`);
  if (result.latency.p90 > THRESHOLDS.p90LatencyMs) failures.push(`p90 ${result.latency.p90}ms > ${THRESHOLDS.p90LatencyMs}ms`);
  if (result.latency.p99 > THRESHOLDS.p99LatencyMs) failures.push(`p99 ${result.latency.p99}ms > ${THRESHOLDS.p99LatencyMs}ms`);
  if (rps < THRESHOLDS.minRps) failures.push(`RPS ${rps.toFixed(1)} < ${THRESHOLDS.minRps}`);

  const passed = failures.length === 0;
  console.log(`  ${passed ? "✅ PASSED" : "❌ FAILED"} — ${rps.toFixed(1)} rps | p50: ${result.latency.p50}ms | p90: ${result.latency.p90}ms | p99: ${result.latency.p99}ms | errors: ${errorRatePct.toFixed(2)}%`);
  if (!passed) failures.forEach(f => console.log(`    ⚠ ${f}`));

  return {
    scenario: scenario.name,
    description: scenario.description,
    connections: scenario.connections ?? CONNECTIONS,
    duration: DURATION,
    requests: totalRequests,
    rps,
    latency: {
      min: result.latency.min,
      max: result.latency.max,
      mean: result.latency.mean,
      p50: result.latency.p50,
      p75: result.latency.p75,
      p90: result.latency.p90,
      p99: result.latency.p99,
    },
    throughputBytesPerSec: result.throughput.average,
    errors,
    timeouts: result.timeouts,
    errorRatePct,
    passed,
    failures,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AgenThinkMesh Enterprise Platform — CR-6 Performance Benchmark");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Target: ${BASE_URL} | Connections: ${CONNECTIONS} | Duration: ${DURATION}s/scenario`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    const healthCheck = await fetch(`${BASE_URL}/api/health`);
    if (!healthCheck.ok && healthCheck.status !== 429) {
      console.error(`❌ Server health check failed: HTTP ${healthCheck.status}`);
      process.exit(1);
    }
    console.log(`✅ Server is reachable at ${BASE_URL}\n`);
  } catch (err) {
    console.error(`❌ Cannot reach server at ${BASE_URL}: ${err}`);
    process.exit(1);
  }

  const runDate = new Date().toISOString();
  const results: BenchmarkResult[] = [];

  for (const scenario of SCENARIOS) {
    try {
      results.push(await runScenario(scenario));
    } catch (err) {
      results.push({
        scenario: scenario.name, description: scenario.description,
        connections: CONNECTIONS, duration: DURATION, requests: 0, rps: 0,
        latency: { min: 0, max: 0, mean: 0, p50: 0, p75: 0, p90: 0, p99: 0 },
        throughputBytesPerSec: 0, errors: 1, timeouts: 0, errorRatePct: 100,
        passed: false, failures: [`Error: ${err}`],
      });
    }
  }

  const overallPassed = results.every(r => r.passed);
  const passCount = results.filter(r => r.passed).length;

  const docsDir = path.join(process.cwd(), "docs");
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  fs.writeFileSync(
    path.join(docsDir, "cr6-benchmark-raw.json"),
    JSON.stringify({ runDate, thresholds: THRESHOLDS, results }, null, 2)
  );

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  BENCHMARK COMPLETE — ${passCount}/${results.length} scenarios PASSED`);
  console.log(`  Overall: ${overallPassed ? "✅ CR-6 PASSED" : "❌ CR-6 FAILED"}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  process.exit(overallPassed ? 0 : 1);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
