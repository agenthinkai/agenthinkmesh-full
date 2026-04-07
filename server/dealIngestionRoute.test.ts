/**
 * dealIngestionRoute.test.ts
 *
 * Integration-style tests for POST /api/deals/ingest
 * Tests cover: request validation, file handling, extraction pipeline,
 * error responses, and response schema.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import path from "path";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const mockIngestFiles = vi.hoisted(() => vi.fn());
const mockExtractDealData = vi.hoisted(() => vi.fn());

vi.mock("./fileIngestion", () => ({
  ingestFiles: mockIngestFiles,
}));

vi.mock("./dealExtraction", () => ({
  extractDealData: mockExtractDealData,
}));

// ── Import route after mocks ──────────────────────────────────────────────────

import dealIngestionRouter from "./dealIngestionRoute";

// ── Test app setup ────────────────────────────────────────────────────────────

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/deals", dealIngestionRouter);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_INGESTION_RESULT = {
  files: [
    { fileName: "pitch.pdf", charCount: 5000, fromZip: false, zipSource: null, text: "PDF text" },
  ],
  combinedText: "=== SOURCE: pitch.pdf ===\nPDF text",
  totalChars: 5000,
  truncated: false,
  errors: [],
};

const MOCK_EXTRACTION_RESULT = {
  company_name:        { value: "Tamara",        sourceSnippet: "Company: Tamara",  sourceFile: "pitch.pdf" },
  sector:              { value: "FinTech",        sourceSnippet: "FinTech sector",   sourceFile: "pitch.pdf" },
  geography:           { value: "Saudi Arabia",   sourceSnippet: "HQ: Riyadh",       sourceFile: "pitch.pdf" },
  stage:               { value: "Series B",       sourceSnippet: "Series B",         sourceFile: "pitch.pdf" },
  revenue_arr:         { value: "$120M ARR",      sourceSnippet: "ARR $120M",        sourceFile: "pitch.pdf" },
  growth_metrics:      { value: "3x YoY",         sourceSnippet: "3x YoY growth",    sourceFile: "pitch.pdf" },
  funding_ask:         { value: "$100M",          sourceSnippet: "raising $100M",    sourceFile: "pitch.pdf" },
  founder_team:        { value: "Turki (CEO)",    sourceSnippet: "Founded by Turki", sourceFile: "pitch.pdf" },
  risks_regulatory:    { value: "SAMA pending",   sourceSnippet: "SAMA approval",    sourceFile: "pitch.pdf" },
  extraction_confidence: "HIGH",
  extraction_notes:    null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/deals/ingest", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    mockIngestFiles.mockResolvedValue(MOCK_INGESTION_RESULT);
    mockExtractDealData.mockResolvedValue(MOCK_EXTRACTION_RESULT);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("returns 200 with extraction and ingestion data on valid upload", async () => {
    const res = await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("fake pdf content"), { filename: "pitch.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("extraction");
    expect(res.body).toHaveProperty("ingestion");
    expect(res.body.extraction.company_name.value).toBe("Tamara");
    expect(res.body.extraction.extraction_confidence).toBe("HIGH");
  });

  it("passes all uploaded files to ingestFiles()", async () => {
    await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("pdf content"), { filename: "deck.pdf", contentType: "application/pdf" })
      .attach("files", Buffer.from("csv content"), { filename: "data.csv", contentType: "text/csv" });

    expect(mockIngestFiles).toHaveBeenCalledOnce();
    const passedFiles = mockIngestFiles.mock.calls[0][0];
    expect(passedFiles).toHaveLength(2);
    expect(passedFiles[0].originalname).toBe("deck.pdf");
    expect(passedFiles[1].originalname).toBe("data.csv");
  });

  it("passes the combinedText from ingestion to extractDealData()", async () => {
    await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("content"), { filename: "memo.txt", contentType: "text/plain" });

    expect(mockExtractDealData).toHaveBeenCalledWith(MOCK_INGESTION_RESULT.combinedText);
  });

  it("includes ingestion metadata in the response", async () => {
    const res = await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("content"), { filename: "memo.txt", contentType: "text/plain" });

    expect(res.body.ingestion.fileCount).toBe(1);
    expect(res.body.ingestion.totalChars).toBe(5000);
    expect(res.body.ingestion.truncated).toBe(false);
    expect(res.body.ingestion.files).toHaveLength(1);
    expect(res.body.ingestion.errors).toHaveLength(0);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("returns 400 if no files are uploaded", async () => {
    const res = await request(app).post("/api/deals/ingest");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No files");
  });

  it("returns 422 if combinedText is empty after ingestion (all files failed)", async () => {
    mockIngestFiles.mockResolvedValueOnce({
      ...MOCK_INGESTION_RESULT,
      combinedText: "",
      files: [],
      errors: [{ fileName: "bad.pdf", error: "Corrupted" }],
    });
    const res = await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("garbage"), { filename: "bad.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("No text could be extracted");
  });

  it("returns 500 or 400 if more than 10 files are uploaded (multer limit)", async () => {
    const req = request(app).post("/api/deals/ingest");
    for (let i = 0; i < 11; i++) {
      req.attach("files", Buffer.from(`file ${i}`), { filename: `file${i}.txt`, contentType: "text/plain" });
    }
    const res = await req;
    // Multer throws a MulterError for too many files; Express may return 500
    // unless an error handler is wired. Either 400 or 500 is acceptable here.
    expect([400, 500]).toContain(res.status);
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it("returns 500 if extractDealData throws", async () => {
    mockExtractDealData.mockRejectedValueOnce(new Error("LLM timeout"));
    const res = await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("content"), { filename: "memo.txt", contentType: "text/plain" });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("LLM timeout");
  });

  it("returns 500 if ingestFiles throws unexpectedly", async () => {
    mockIngestFiles.mockRejectedValueOnce(new Error("Disk error"));
    const res = await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("content"), { filename: "memo.txt", contentType: "text/plain" });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Disk error");
  });

  // ── Response schema ─────────────────────────────────────────────────────────

  it("response extraction contains all required SourcedField keys", async () => {
    const res = await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("content"), { filename: "memo.txt", contentType: "text/plain" });

    const extraction = res.body.extraction;
    const requiredKeys = [
      "company_name", "sector", "geography", "stage",
      "revenue_arr", "growth_metrics", "funding_ask",
      "founder_team", "risks_regulatory",
      "extraction_confidence", "extraction_notes",
    ];
    for (const key of requiredKeys) {
      expect(extraction).toHaveProperty(key);
    }
  });

  it("each SourcedField in extraction has value, sourceSnippet, sourceFile", async () => {
    const res = await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("content"), { filename: "memo.txt", contentType: "text/plain" });

    const sourcedFieldKeys = [
      "company_name", "sector", "geography", "stage",
      "revenue_arr", "growth_metrics", "funding_ask",
      "founder_team", "risks_regulatory",
    ];
    for (const key of sourcedFieldKeys) {
      const field = res.body.extraction[key];
      expect(field).toHaveProperty("value");
      expect(field).toHaveProperty("sourceSnippet");
      expect(field).toHaveProperty("sourceFile");
    }
  });

  // ── Non-fatal ingestion errors pass through ─────────────────────────────────

  it("returns 200 even if some files had non-fatal parse errors", async () => {
    mockIngestFiles.mockResolvedValueOnce({
      files: [{ fileName: "good.txt", charCount: 100, fromZip: false, zipSource: null, text: "Good content" }],
      combinedText: "=== SOURCE: good.txt ===\nGood content",
      totalChars: 100,
      truncated: false,
      errors: [{ fileName: "bad.pdf", error: "Corrupted PDF" }],
    });
    const res = await request(app)
      .post("/api/deals/ingest")
      .attach("files", Buffer.from("good content"), { filename: "good.txt", contentType: "text/plain" })
      .attach("files", Buffer.from("garbage"), { filename: "bad.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(res.body.ingestion.errors).toHaveLength(1);
    expect(res.body.ingestion.errors[0].fileName).toBe("bad.pdf");
  });
});
