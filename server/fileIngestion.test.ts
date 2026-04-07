/**
 * fileIngestion.test.ts
 *
 * Unit tests for the Deal Data Room file ingestion engine.
 * Tests cover: PDF, Excel, CSV, TXT, DOCX, ZIP, oversized files,
 * unsupported types, truncation, and combined text assembly.
 *
 * Mocking strategy:
 *   - pdf-parse: mocked to return predictable text without needing real PDFs
 *   - xlsx: mocked to return predictable sheet data
 *   - mammoth: mocked to return predictable DOCX text
 *   - jszip: mocked to return predictable ZIP contents
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks so they run before imports ────────────────────────────────────
const mockPdfParse = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ text: "PDF content from document", numpages: 2 })
);
const mockMammoth = vi.hoisted(() => ({
  extractRawText: vi.fn().mockResolvedValue({ value: "DOCX content from document" }),
}));
const mockXLSX = vi.hoisted(() => ({
  read: vi.fn().mockReturnValue({
    SheetNames: ["Sheet1"],
    Sheets: {
      Sheet1: {},
    },
  }),
  utils: {
    sheet_to_csv: vi.fn().mockReturnValue("col1,col2\nval1,val2"),
  },
}));
const mockJSZipInstance = vi.hoisted(() => ({
  files: {} as Record<string, { name: string; dir: boolean; async: (type: string) => Promise<ArrayBuffer> }>,
}));
const mockJSZip = vi.hoisted(() => {
  const constructor = vi.fn();
  (constructor as any).loadAsync = vi.fn().mockResolvedValue(mockJSZipInstance);
  return { default: constructor };
});

vi.mock("pdf-parse", () => ({ default: mockPdfParse }));
vi.mock("mammoth", () => ({ default: mockMammoth }));
vi.mock("xlsx", () => ({ default: mockXLSX, ...mockXLSX }));
vi.mock("jszip", () => ({ default: mockJSZip.default }));
// Ensure loadAsync is always set on the mock constructor
Object.defineProperty(mockJSZip.default, "loadAsync", {
  value: vi.fn().mockResolvedValue(mockJSZipInstance),
  writable: true,
  configurable: true,
});

// Mock the createRequire so pdf-parse is loaded via our mock
vi.mock("module", async (importOriginal) => {
  const mod = await importOriginal<typeof import("module")>();
  return {
    ...mod,
    createRequire: () => (id: string) => {
      if (id === "pdf-parse") return mockPdfParse;
      return mod.createRequire(import.meta.url)(id);
    },
  };
});

import { ingestFiles } from "./fileIngestion";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(name: string, content: string, mimeType = "text/plain") {
  return {
    originalname: name,
    buffer: Buffer.from(content, "utf-8"),
    mimetype: mimeType,
    size: Buffer.byteLength(content, "utf-8"),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("fileIngestion — ingestFiles()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mocks
    mockPdfParse.mockResolvedValue({ text: "PDF content from document", numpages: 2 });
    mockMammoth.extractRawText.mockResolvedValue({ value: "DOCX content from document" });
    mockXLSX.read.mockReturnValue({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } });
    mockXLSX.utils.sheet_to_csv.mockReturnValue("col1,col2\nval1,val2");
    (mockJSZip.default as any).loadAsync = vi.fn().mockResolvedValue(mockJSZipInstance);
    mockJSZipInstance.files = {};
  });

  // ── Plain text ──────────────────────────────────────────────────────────────

  it("extracts text from a .txt file", async () => {
    const result = await ingestFiles([makeFile("memo.txt", "This is a deal memo.")]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].text).toBe("This is a deal memo.");
    expect(result.files[0].fileName).toBe("memo.txt");
    expect(result.files[0].fromZip).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it("extracts text from a .csv file", async () => {
    const result = await ingestFiles([makeFile("data.csv", "name,value\nApple,100", "text/csv")]);
    expect(result.files[0].text).toBe("name,value\nApple,100");
    expect(result.errors).toHaveLength(0);
  });

  it("extracts text from a .md file", async () => {
    const result = await ingestFiles([makeFile("readme.md", "# Deal Memo\n\nContent here.")]);
    expect(result.files[0].text).toBe("# Deal Memo\n\nContent here.");
  });

  // ── PDF ─────────────────────────────────────────────────────────────────────

  it("extracts text from a .pdf file using pdf-parse", async () => {
    const result = await ingestFiles([makeFile("deck.pdf", "%PDF-1.4 fake", "application/pdf")]);
    expect(result.files[0].text).toBe("PDF content from document");
    expect(result.errors).toHaveLength(0);
  });

  it("captures a non-fatal error if pdf-parse throws", async () => {
    mockPdfParse.mockRejectedValueOnce(new Error("Corrupted PDF"));
    const result = await ingestFiles([makeFile("bad.pdf", "garbage", "application/pdf")]);
    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].fileName).toBe("bad.pdf");
    expect(result.errors[0].error).toContain("Corrupted PDF");
  });

  // ── Excel ───────────────────────────────────────────────────────────────────

  it("extracts text from a .xlsx file using xlsx", async () => {
    const result = await ingestFiles([
      makeFile("financials.xlsx", "fake xlsx bytes", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ]);
    expect(result.files[0].text).toContain("Sheet1");
    expect(result.files[0].text).toContain("col1,col2");
    expect(result.errors).toHaveLength(0);
  });

  it("handles multiple sheets in an Excel file", async () => {
    mockXLSX.read.mockReturnValueOnce({
      SheetNames: ["Revenue", "Costs"],
      Sheets: { Revenue: {}, Costs: {} },
    });
    mockXLSX.utils.sheet_to_csv
      .mockReturnValueOnce("month,revenue\nJan,100000")
      .mockReturnValueOnce("month,cost\nJan,50000");
    const result = await ingestFiles([
      makeFile("model.xlsx", "fake", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ]);
    expect(result.files[0].text).toContain("Revenue");
    expect(result.files[0].text).toContain("Costs");
  });

  // ── DOCX ────────────────────────────────────────────────────────────────────

  it("extracts text from a .docx file using mammoth", async () => {
    const result = await ingestFiles([
      makeFile("term_sheet.docx", "fake docx bytes", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ]);
    expect(result.files[0].text).toBe("DOCX content from document");
    expect(result.errors).toHaveLength(0);
  });

  // ── ZIP ─────────────────────────────────────────────────────────────────────

  it("unpacks a ZIP and processes contained text files", async () => {
    const txtContent = "Deal summary from zip";
    const buf = Buffer.from(txtContent);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    mockJSZipInstance.files = {
      "summary.txt": {
        name: "summary.txt",
        dir: false,
        async: vi.fn().mockResolvedValue(ab),
      },
    };
    (mockJSZip.default as any).loadAsync = vi.fn().mockResolvedValue(mockJSZipInstance);
    const result = await ingestFiles([makeFile("dataroom.zip", "fake zip", "application/zip")]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].fromZip).toBe(true);
    expect(result.files[0].zipSource).toBe("dataroom.zip");
    expect(result.files[0].text).toBe(txtContent);
  });

  it("skips __MACOSX entries inside ZIP files", async () => {
    const realBuf = Buffer.from("real content");
    const realAb = realBuf.buffer.slice(realBuf.byteOffset, realBuf.byteOffset + realBuf.byteLength);
    const junkBuf = Buffer.from("junk");
    const junkAb = junkBuf.buffer.slice(junkBuf.byteOffset, junkBuf.byteOffset + junkBuf.byteLength);
    mockJSZipInstance.files = {
      "__MACOSX/._summary.txt": {
        name: "__MACOSX/._summary.txt",
        dir: false,
        async: vi.fn().mockResolvedValue(junkAb),
      },
      "summary.txt": {
        name: "summary.txt",
        dir: false,
        async: vi.fn().mockResolvedValue(realAb),
      },
    };
    (mockJSZip.default as any).loadAsync = vi.fn().mockResolvedValue(mockJSZipInstance);
    const result = await ingestFiles([makeFile("dataroom.zip", "fake zip", "application/zip")]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].text).toBe("real content");
  });

  it("skips directory entries inside ZIP files", async () => {
    const memoBuf = Buffer.from("memo content");
    const memoAb = memoBuf.buffer.slice(memoBuf.byteOffset, memoBuf.byteOffset + memoBuf.byteLength);
    mockJSZipInstance.files = {
      "docs/": { name: "docs/", dir: true, async: vi.fn() },
      "docs/memo.txt": {
        name: "docs/memo.txt",
        dir: false,
        async: vi.fn().mockResolvedValue(memoAb),
      },
    };
    (mockJSZip.default as any).loadAsync = vi.fn().mockResolvedValue(mockJSZipInstance);
    const result = await ingestFiles([makeFile("dataroom.zip", "fake zip", "application/zip")]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].text).toBe("memo content");
  });

  // ── Multiple files ──────────────────────────────────────────────────────────

  it("processes multiple files and combines their text", async () => {
    const result = await ingestFiles([
      makeFile("memo.txt", "Text from memo"),
      makeFile("deck.pdf", "fake pdf", "application/pdf"),
    ]);
    expect(result.files).toHaveLength(2);
    expect(result.combinedText).toContain("Text from memo");
    expect(result.combinedText).toContain("PDF content from document");
    expect(result.combinedText).toContain("SOURCE: memo.txt");
    expect(result.combinedText).toContain("SOURCE: deck.pdf");
  });

  // ── Oversized files ─────────────────────────────────────────────────────────

  it("rejects files exceeding 20 MB with a non-fatal error", async () => {
    const oversized = {
      originalname: "huge.pdf",
      buffer: Buffer.alloc(1),
      mimetype: "application/pdf",
      size: 21 * 1024 * 1024, // 21 MB
    };
    const result = await ingestFiles([oversized]);
    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("20 MB");
  });

  // ── Truncation ──────────────────────────────────────────────────────────────

  it("truncates combinedText at 80,000 characters and sets truncated=true", async () => {
    const longContent = "A".repeat(90_000);
    const result = await ingestFiles([makeFile("big.txt", longContent)]);
    expect(result.truncated).toBe(true);
    expect(result.combinedText.length).toBeLessThanOrEqual(80_200); // 80k + truncation notice
    expect(result.combinedText).toContain("truncated");
    expect(result.totalChars).toBeGreaterThan(80_000);
  });

  it("does not truncate when content is under 80,000 characters", async () => {
    const shortContent = "B".repeat(1_000);
    const result = await ingestFiles([makeFile("small.txt", shortContent)]);
    expect(result.truncated).toBe(false);
  });

  // ── Empty result ────────────────────────────────────────────────────────────

  it("returns empty combinedText when all files fail to parse", async () => {
    mockPdfParse.mockRejectedValueOnce(new Error("Parse error"));
    const result = await ingestFiles([makeFile("bad.pdf", "garbage", "application/pdf")]);
    expect(result.combinedText).toBe("");
    expect(result.files).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  // ── Source separators ───────────────────────────────────────────────────────

  it("includes SOURCE header separators in combinedText", async () => {
    const result = await ingestFiles([makeFile("notes.txt", "Some notes")]);
    expect(result.combinedText).toContain("=== SOURCE: notes.txt ===");
  });

  it("includes ZIP source reference in combinedText for files from ZIP", async () => {
    const pitchBuf = Buffer.from("pitch content");
    const pitchAb = pitchBuf.buffer.slice(pitchBuf.byteOffset, pitchBuf.byteOffset + pitchBuf.byteLength);
    mockJSZipInstance.files = {
      "pitch.txt": {
        name: "pitch.txt",
        dir: false,
        async: vi.fn().mockResolvedValue(pitchAb),
      },
    };
    (mockJSZip.default as any).loadAsync = vi.fn().mockResolvedValue(mockJSZipInstance);
    const result = await ingestFiles([makeFile("dataroom.zip", "fake zip", "application/zip")]);
    expect(result.combinedText).toContain("dataroom.zip → pitch.txt");
  });
});
