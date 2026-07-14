import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/jobs/founderFleetScheduler.ts"), "utf8");

describe("weekly fleet scheduler guards", () => {
  it("counts completed runs by completion time, not creation time", () => {
    expect(source).toContain("gte(founderAgentRuns.completedAt, weekWindowStart)");
    expect(source).not.toContain("gte(founderAgentRuns.createdAt, weekWindowStart)");
  });

  it("uses completion time for the short duplicate window", () => {
    expect(source).toContain("gte(founderAgentRuns.completedAt, windowStart)");
    expect(source).not.toContain("gte(founderAgentRuns.createdAt, windowStart)");
  });

  it("blocks a second launch while the same fleet mode has an active run", () => {
    expect(source).toContain("ACTIVE RUN GUARD");
    expect(source).toContain("inArray(founderAgentRuns.status, ACTIVE_RUN_STATUSES)");
  });

  it("keeps the in-process cron disabled in favor of the canonical platform schedule", () => {
    expect(source).toContain("In-process cron DISABLED");
    expect(source).not.toMatch(/cron\.schedule\s*\(/);
  });
});
