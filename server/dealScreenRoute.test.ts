/**
 * dealScreenRoute.test.ts
 *
 * Unit tests for the REST deal screen route and runScreeningPipeline service.
 * Uses vi.mock to avoid real LLM calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the pipeline service ─────────────────────────────────────────────────
vi.mock("./runScreeningPipeline", () => ({
  runScreeningPipeline: vi.fn(),
}));

// ── Mock the SDK auth ─────────────────────────────────────────────────────────
vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn().mockResolvedValue({ id: 42, email: "test@example.com" }),
  },
}));

import { runScreeningPipeline } from "./runScreeningPipeline";
import express from "express";
import request from "supertest";
import dealScreenRouter from "./dealScreenRoute";

const mockRun = vi.mocked(runScreeningPipeline);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/deal", dealScreenRouter);
  return app;
}

const MOCK_RESULT = {
  dealId: "test-uuid-1234",
  dealName: "Test Deal",
  duplicate: false,
  triage: { decision: "PROCEED" as const, confidence: 0.95, reason: "Viable investment opportunity" },
  council: { verdict: "APPROVED", yesCount: 8, noCount: 2, confidenceScore: 0.8 },
  ic_report: { summary: "Strong deal" },
  universitySignal: null,
};

describe("POST /api/deal/screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Enable internal API mode for tests
    process.env.ENABLE_INTERNAL_SCREEN_API = "true";
    mockRun.mockResolvedValue(MOCK_RESULT);
  });

  it("returns 400 when dealText is missing", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/deal/screen").send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/dealText/);
  });

  it("returns 400 when dealText is empty string", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/deal/screen").send({ dealText: "   " });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for invalid councilMode", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/deal/screen")
      .send({ dealText: "Valid deal text here", councilMode: "invalid_mode" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/councilMode/);
  });

  it("returns 200 with structured result for valid input", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/deal/screen")
      .send({ dealText: "We are building a fintech startup in Kuwait targeting SME lending." });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      dealId: expect.any(String),
      duplicate: expect.any(Boolean),
    });
  });

  it("passes includeReport=false to the pipeline", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/deal/screen")
      .send({ dealText: "Test deal", includeReport: false });
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({ includeReport: false })
    );
  });

  it("defaults includeReport to true when not provided", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/deal/screen")
      .send({ dealText: "Test deal" });
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({ includeReport: true })
    );
  });

  it("returns 500 when pipeline throws", async () => {
    mockRun.mockRejectedValueOnce(new Error("LLM timeout"));
    const app = buildApp();
    const res = await request(app)
      .post("/api/deal/screen")
      .send({ dealText: "Test deal" });
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/deal/screen/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_INTERNAL_SCREEN_API = "true";
    mockRun.mockResolvedValue(MOCK_RESULT);
  });

  it("returns 400 when deals is missing", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/deal/screen/batch").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/deals/);
  });

  it("returns 400 when deals is empty array", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/deal/screen/batch").send({ deals: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when batch exceeds 20 deals", async () => {
    const app = buildApp();
    const deals = Array.from({ length: 21 }, (_, i) => ({ dealText: `Deal ${i}` }));
    const res = await request(app).post("/api/deal/screen/batch").send({ deals });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/20/);
  });

  it("processes all deals and returns results array", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/deal/screen/batch")
      .send({
        deals: [
          { dealText: "Deal one — fintech in UAE" },
          { dealText: "Deal two — healthtech in Saudi Arabia" },
        ],
        includeReport: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0]).toMatchObject({ index: 0, success: true });
    expect(res.body.results[1]).toMatchObject({ index: 1, success: true });
  });

  it("marks individual deal as failed without aborting the batch", async () => {
    mockRun
      .mockResolvedValueOnce(MOCK_RESULT)
      .mockRejectedValueOnce(new Error("Agent timeout"))
      .mockResolvedValueOnce(MOCK_RESULT);
    const app = buildApp();
    const res = await request(app)
      .post("/api/deal/screen/batch")
      .send({
        deals: [
          { dealText: "Deal one" },
          { dealText: "Deal two" },
          { dealText: "Deal three" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.results[0].success).toBe(true);
    expect(res.body.results[1].success).toBe(false);
    expect(res.body.results[1].error).toMatch(/Agent timeout/);
    expect(res.body.results[2].success).toBe(true);
  });

  it("skips deals with missing dealText and marks them as failed", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/deal/screen/batch")
      .send({
        deals: [
          { dealText: "Valid deal" },
          { dealText: "" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.results[1].success).toBe(false);
    expect(res.body.results[1].error).toMatch(/dealText/);
  });
});

describe("Auth enforcement", () => {
  it("returns 401 when ENABLE_INTERNAL_SCREEN_API is not set and no session cookie", async () => {
    delete process.env.ENABLE_INTERNAL_SCREEN_API;
    // Mock SDK to return null (no valid session)
    const { sdk } = await import("./_core/sdk");
    vi.mocked(sdk.authenticateRequest).mockResolvedValueOnce(null as any);
    const app = buildApp();
    const res = await request(app)
      .post("/api/deal/screen")
      .send({ dealText: "Test deal" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    // Restore for other tests
    process.env.ENABLE_INTERNAL_SCREEN_API = "true";
  });
});
