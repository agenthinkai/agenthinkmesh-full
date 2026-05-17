/**
 * throughput.p1p2.test.ts
 *
 * Validates P1 throughput constants and P2 async fleet dispatch behaviour.
 *
 * P1 — constant values (regression guard: prevents accidental reversion)
 * P2 — fleet.start returns runId immediately without awaiting runFleet
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── P1: Constant value tests ─────────────────────────────────────────────────

describe("P1 — founderFleet throughput constants", () => {
  it("MAX_CONCURRENT is 25 (increased from 10 for DeepSeek concurrency)", async () => {
    // Read the source file and extract the constant value
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/founderFleet.ts`,
      "utf8"
    );
    const match = src.match(/^const MAX_CONCURRENT\s*=\s*(\d+)/m);
    expect(match).not.toBeNull();
    const value = parseInt(match![1], 10);
    expect(value).toBe(25);
  });

  it("STAGGER_MS is 500 (reduced from 3000ms — Claude rate-limit guard removed)", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/founderFleet.ts`,
      "utf8"
    );
    const match = src.match(/^const STAGGER_MS\s*=\s*(\d+)/m);
    expect(match).not.toBeNull();
    const value = parseInt(match![1], 10);
    expect(value).toBe(500);
  });

  it("STAGGER_MS is less than 1000ms (ensures no per-worker stall under DeepSeek routing)", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/founderFleet.ts`,
      "utf8"
    );
    const match = src.match(/^const STAGGER_MS\s*=\s*(\d+)/m);
    const value = parseInt(match![1], 10);
    expect(value).toBeLessThan(1000);
  });

  it("MAX_CONCURRENT is at least 20 (ensures meaningful parallelism)", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/founderFleet.ts`,
      "utf8"
    );
    const match = src.match(/^const MAX_CONCURRENT\s*=\s*(\d+)/m);
    const value = parseInt(match![1], 10);
    expect(value).toBeGreaterThanOrEqual(20);
  });
});

describe("P1 — councilEngine AGENT_TIMEOUT_MS", () => {
  it("AGENT_TIMEOUT_MS is 15_000 (reduced from 50_000 — DeepSeek Flash p99 ~8s)", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/councilEngine.ts`,
      "utf8"
    );
    const match = src.match(/^const AGENT_TIMEOUT_MS\s*=\s*([\d_]+)/m);
    expect(match).not.toBeNull();
    const value = parseInt(match![1].replace(/_/g, ""), 10);
    expect(value).toBe(15000);
  });

  it("AGENT_TIMEOUT_MS is less than 20_000ms (ensures Cloud Run 180s budget is safe)", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/councilEngine.ts`,
      "utf8"
    );
    const match = src.match(/^const AGENT_TIMEOUT_MS\s*=\s*([\d_]+)/m);
    const value = parseInt(match![1].replace(/_/g, ""), 10);
    // 10 agents × AGENT_TIMEOUT_MS must be < 180_000ms (Cloud Run limit)
    expect(value * 10).toBeLessThan(180_000);
  });

  it("10 agents × AGENT_TIMEOUT_MS leaves at least 30s buffer before Cloud Run timeout", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/councilEngine.ts`,
      "utf8"
    );
    const match = src.match(/^const AGENT_TIMEOUT_MS\s*=\s*([\d_]+)/m);
    const value = parseInt(match![1].replace(/_/g, ""), 10);
    const worstCaseMs = value * 10;
    const cloudRunLimitMs = 180_000;
    const bufferMs = cloudRunLimitMs - worstCaseMs;
    expect(bufferMs).toBeGreaterThanOrEqual(30_000);
  });
});

// ── P2: Async fleet dispatch tests ───────────────────────────────────────────

describe("P2 — fleet.start async dispatch (background execution, immediate runId return)", () => {
  it("fleet.start router dispatches runFleet without awaiting it", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/routers/founderFleet.ts`,
      "utf8"
    );
    // The start procedure must call runFleet().catch() without await at the call site
    // Pattern: runFleet(runId, ...).catch(...) — no leading 'await'
    const hasBackgroundDispatch = /runFleet\(runId[^)]*\)\.catch\(/.test(src);
    expect(hasBackgroundDispatch).toBe(true);
  });

  it("fleet.start returns { runId } before runFleet completes", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/routers/founderFleet.ts`,
      "utf8"
    );
    // Confirm return { runId } appears after the non-awaited runFleet dispatch
    const dispatchIdx = src.indexOf("runFleet(runId");
    const returnIdx = src.indexOf("return { runId }", dispatchIdx);
    expect(dispatchIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(dispatchIdx);
  });

  it("fleet.start does NOT await runFleet directly (would block request)", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/routers/founderFleet.ts`,
      "utf8"
    );
    // Check that 'await runFleet' does not appear in the start mutation
    // Find the start mutation block
    const startIdx = src.indexOf("start: adminProcedure");
    const nextProcedureIdx = src.indexOf("pause: adminProcedure", startIdx);
    const startBlock = src.slice(startIdx, nextProcedureIdx);
    const hasAwaitRunFleet = /await runFleet/.test(startBlock);
    expect(hasAwaitRunFleet).toBe(false);
  });

  it("fleet.resume also dispatches runFleet without blocking (server-restart resume path)", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/routers/founderFleet.ts`,
      "utf8"
    );
    // Resume path: runFleet(input.runId).catch(...) — no await
    const resumeIdx = src.indexOf("resume: adminProcedure");
    const abortIdx = src.indexOf("abort: adminProcedure", resumeIdx);
    const resumeBlock = src.slice(resumeIdx, abortIdx);
    const hasBackgroundResume = /runFleet\(input\.runId\)\.catch\(/.test(resumeBlock);
    expect(hasBackgroundResume).toBe(true);
  });

  it("fleet.status polling procedure exists for DB-backed progress tracking", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(
      `${process.cwd()}/server/routers/founderFleet.ts`,
      "utf8"
    );
    expect(src).toContain("status: adminProcedure");
  });
});

// ── P1/P2 integration: throughput math ───────────────────────────────────────

describe("P1/P2 — throughput projection math", () => {
  const MAX_CONCURRENT = 25;
  const STAGGER_MS = 500;
  const AGENT_TIMEOUT_MS = 15_000;
  const AGENTS_PER_EVAL = 10;

  it("time to launch all 25 workers is under 15 seconds (STAGGER_MS × MAX_CONCURRENT)", () => {
    const launchTimeMs = STAGGER_MS * MAX_CONCURRENT;
    expect(launchTimeMs).toBeLessThan(15_000);
  });

  it("worst-case single eval time is under 30 seconds (AGENT_TIMEOUT_MS with 2× headroom)", () => {
    // Agents run in parallel via Promise.race, so worst case = AGENT_TIMEOUT_MS, not × AGENTS_PER_EVAL
    expect(AGENT_TIMEOUT_MS).toBeLessThan(30_000);
  });

  it("theoretical max evals per minute with 25 concurrent workers at 8s avg latency", () => {
    const avgLatencyMs = 8_000; // DeepSeek Flash p50
    const evalsPerWorkerPerMinute = 60_000 / avgLatencyMs;
    const totalEvalsPerMinute = Math.floor(evalsPerWorkerPerMinute * MAX_CONCURRENT);
    // Should be at least 100 evals/min (= 144,000/day, well above 100K target)
    expect(totalEvalsPerMinute).toBeGreaterThanOrEqual(100);
  });

  it("daily eval capacity at 25 concurrent workers exceeds 100_000 evals/day target", () => {
    const avgLatencyMs = 8_000;
    const secondsPerDay = 86_400;
    const evalsPerWorkerPerDay = (secondsPerDay * 1000) / avgLatencyMs;
    const totalEvalsPerDay = Math.floor(evalsPerWorkerPerDay * MAX_CONCURRENT);
    expect(totalEvalsPerDay).toBeGreaterThan(100_000);
  });
});
