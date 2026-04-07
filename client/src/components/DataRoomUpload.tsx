/**
 * DataRoomUpload.tsx
 *
 * Deal Data Room Ingestion V1 — Upload & Review Component
 *
 * Flow:
 *   1. DROP ZONE: User drops/selects files (PDF, Excel, CSV, TXT, DOCX, ZIP)
 *   2. PARSING:   Files are sent to POST /api/deals/ingest
 *   3. REVIEW:    Extracted fields shown with clear state indicators:
 *                   - EXTRACTED (AI found it, with source snippet)
 *                   - UNKNOWN   (not found, needs manual entry)
 *                   - EDITED    (user has overridden the extracted value)
 *   4. HANDOFF:   "Run IC Analysis" button fires the existing Deal Screener flow
 *
 * Non-negotiable rules enforced here:
 *   - Null fields are NEVER pre-filled with guesses
 *   - Source snippets are shown for all extracted values
 *   - User edits are visually distinct from extracted values
 *   - Manual entry mode is never touched
 */

import React, { useCallback, useRef, useState } from "react";

// ── Design tokens (matches DealScreener.tsx) ─────────────────────────────────
const BG       = "#070b12";
const BG2      = "#0d1421";
const BG3      = "#111827";
const BORDER   = "#1e2d3d";
const ACCENT   = "#4a9eff";
const GREEN    = "#00ff87";
const AMBER    = "#ff9f43";
const RED      = "#ff4757";
const PURPLE   = "#a855f7";
const MUTED    = "#4a5568";
const TEXT     = "#e2e8f0";
const TEXT2    = "#94a3b8";
const MONO     = "'IBM Plex Mono', 'Fira Code', 'JetBrains Mono', monospace";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SourcedField {
  value: string | null;
  sourceSnippet: string | null;
  sourceFile: string | null;
}

interface ExtractedDealData {
  company_name:        SourcedField;
  sector:              SourcedField;
  geography:           SourcedField;
  stage:               SourcedField;
  revenue_arr:         SourcedField;
  growth_metrics:      SourcedField;
  funding_ask:         SourcedField;
  founder_team:        SourcedField;
  risks_regulatory:    SourcedField;
  extraction_confidence: "HIGH" | "MEDIUM" | "LOW";
  extraction_notes:    string | null;
}

interface IngestionMeta {
  fileCount: number;
  totalChars: number;
  truncated: boolean;
  files: Array<{ fileName: string; charCount: number; fromZip: boolean; zipSource: string | null }>;
  errors: Array<{ fileName: string; error: string }>;
}

/** The state of a single review field. */
type FieldState = "extracted" | "unknown" | "edited";

interface ReviewField {
  key: keyof ExtractedDealData;
  label: string;
  description: string;
  /** The value from LLM extraction (null if not found). */
  extractedValue: string | null;
  sourceSnippet: string | null;
  sourceFile: string | null;
  /** Current value in the review form (may be user-edited). */
  currentValue: string;
  state: FieldState;
  /** Whether this field is required for IC analysis. */
  required: boolean;
}

export interface DataRoomResult {
  dealName: string;
  dealText: string;
}

interface Props {
  /** Called when the user approves the review and clicks "Run IC Analysis". */
  onReady: (result: DataRoomResult) => void;
  /** Called if the user cancels and wants to go back to manual entry. */
  onCancel: () => void;
}

// ── Field definitions ─────────────────────────────────────────────────────────

const FIELD_DEFS: Array<{ key: keyof ExtractedDealData; label: string; description: string; required: boolean }> = [
  { key: "company_name",     label: "Company Name",         description: "Legal or trading name",                                required: true  },
  { key: "sector",           label: "Sector / Industry",    description: "e.g. FinTech, SaaS, Healthcare",                       required: true  },
  { key: "geography",        label: "Geography",            description: "Country or region of primary operations",              required: true  },
  { key: "stage",            label: "Funding Stage",        description: "e.g. Pre-Seed, Series A, Growth",                     required: false },
  { key: "revenue_arr",      label: "Revenue / ARR",        description: "Annual revenue or ARR as stated in documents",        required: false },
  { key: "growth_metrics",   label: "Growth Metrics",       description: "e.g. 3x YoY, MoM growth 15%",                        required: false },
  { key: "funding_ask",      label: "Funding Ask",          description: "Amount being raised in this round",                   required: false },
  { key: "founder_team",     label: "Founder / Team",       description: "Key team members and roles",                          required: false },
  { key: "risks_regulatory", label: "Risks / Regulatory",   description: "Stated risks, red flags, or regulatory notes",       required: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ".pdf,.xlsx,.xls,.csv,.txt,.docx,.doc,.zip,.md,.json,.yaml,.yml";
const MAX_FILES = 10;
const MAX_TOTAL_MB = 100;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildReviewFields(extraction: ExtractedDealData): ReviewField[] {
  return FIELD_DEFS.map((def) => {
    const raw = extraction[def.key];
    // extraction_confidence and extraction_notes are not SourcedField objects
    if (typeof raw !== "object" || raw === null || !("value" in raw)) {
      return {
        ...def,
        extractedValue: null,
        sourceSnippet: null,
        sourceFile: null,
        currentValue: "",
        state: "unknown" as FieldState,
      };
    }
    const sf = raw as SourcedField;
    return {
      ...def,
      extractedValue: sf.value,
      sourceSnippet: sf.sourceSnippet,
      sourceFile: sf.sourceFile,
      currentValue: sf.value ?? "",
      state: sf.value ? ("extracted" as FieldState) : ("unknown" as FieldState),
    };
  });
}

function buildDealText(fields: ReviewField[]): string {
  const parts: string[] = [];
  for (const f of fields) {
    const val = f.currentValue.trim();
    if (!val) continue;
    parts.push(`${f.label.toUpperCase()}: ${val}`);
  }
  if (parts.length === 0) throw new Error("At least one field must be filled before running IC analysis.");
  return parts.join("\n\n");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldStateBadge({ state }: { state: FieldState }) {
  if (state === "extracted") {
    return (
      <span style={{
        fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em",
        padding: "2px 6px", borderRadius: 3,
        background: "rgba(0,255,135,0.1)", border: `1px solid rgba(0,255,135,0.3)`,
        color: GREEN,
      }}>
        ✦ EXTRACTED
      </span>
    );
  }
  if (state === "edited") {
    return (
      <span style={{
        fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em",
        padding: "2px 6px", borderRadius: 3,
        background: "rgba(168,85,247,0.1)", border: `1px solid rgba(168,85,247,0.3)`,
        color: PURPLE,
      }}>
        ✏ EDITED
      </span>
    );
  }
  // unknown
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em",
      padding: "2px 6px", borderRadius: 3,
      background: "rgba(255,159,67,0.1)", border: `1px solid rgba(255,159,67,0.3)`,
      color: AMBER,
    }}>
      ? UNKNOWN
    </span>
  );
}

function SourceSnippetTooltip({ snippet, file }: { snippet: string; file: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontFamily: MONO, fontSize: 10, color: TEXT2, padding: "0 4px",
          verticalAlign: "middle",
        }}
        title="View source snippet"
      >
        ⓘ
      </button>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6,
          padding: "10px 12px", zIndex: 100, minWidth: 260, maxWidth: 360,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          {file && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, marginBottom: 6, letterSpacing: "0.06em" }}>
              SOURCE: {file}
            </div>
          )}
          <div style={{ fontSize: 11, color: TEXT2, lineHeight: 1.5, fontStyle: "italic" }}>
            "{snippet}"
          </div>
        </div>
      )}
    </span>
  );
}

function ReviewFieldRow({
  field,
  onChange,
}: {
  field: ReviewField;
  onChange: (key: keyof ExtractedDealData, value: string) => void;
}) {
  const isMultiline = field.key === "founder_team" || field.key === "risks_regulatory";
  const borderColor =
    field.state === "unknown" ? `rgba(255,159,67,0.4)` :
    field.state === "edited"  ? `rgba(168,85,247,0.4)` :
    `rgba(0,255,135,0.25)`;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <label style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em" }}>
          {field.label.toUpperCase()}
          {field.required && <span style={{ color: RED, marginLeft: 4 }}>*</span>}
        </label>
        <FieldStateBadge state={field.state} />
        {field.state !== "unknown" && field.sourceSnippet && (
          <SourceSnippetTooltip snippet={field.sourceSnippet} file={field.sourceFile} />
        )}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{field.description}</div>
      {isMultiline ? (
        <textarea
          value={field.currentValue}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={3}
          placeholder={field.state === "unknown" ? `Not found in documents — enter manually` : undefined}
          style={{
            width: "100%", padding: "10px 12px",
            background: BG3, border: `1px solid ${borderColor}`,
            borderRadius: 4, color: field.state === "unknown" ? TEXT2 : TEXT,
            fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.5,
            resize: "vertical", outline: "none", boxSizing: "border-box",
          }}
        />
      ) : (
        <input
          type="text"
          value={field.currentValue}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.state === "unknown" ? `Not found in documents — enter manually` : undefined}
          style={{
            width: "100%", padding: "10px 12px",
            background: BG3, border: `1px solid ${borderColor}`,
            borderRadius: 4, color: field.state === "unknown" ? TEXT2 : TEXT,
            fontFamily: "'Inter', sans-serif", fontSize: 13,
            outline: "none", boxSizing: "border-box",
          }}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DataRoomUpload({ onReady, onCancel }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Review step state
  const [extraction, setExtraction] = useState<ExtractedDealData | null>(null);
  const [ingestionMeta, setIngestionMeta] = useState<IngestionMeta | null>(null);
  const [reviewFields, setReviewFields] = useState<ReviewField[]>([]);
  const [dealName, setDealName] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File selection ──────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles((prev) => {
      const combined = [...prev, ...arr];
      if (combined.length > MAX_FILES) {
        setUploadError(`Maximum ${MAX_FILES} files allowed.`);
        return prev;
      }
      const totalBytes = combined.reduce((s, f) => s + f.size, 0);
      if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) {
        setUploadError(`Total upload size must be under ${MAX_TOTAL_MB} MB.`);
        return prev;
      }
      setUploadError(null);
      return combined;
    });
  }, []);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setUploadError(null);
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  // ── Upload & extract ────────────────────────────────────────────────────────

  const handleIngest = async () => {
    if (files.length === 0) { setUploadError("Please add at least one file."); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      for (const f of files) formData.append("files", f);
      const res = await fetch("/api/deals/ingest", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ingestion failed");
      setExtraction(data.extraction as ExtractedDealData);
      setIngestionMeta(data.ingestion as IngestionMeta);
      setReviewFields(buildReviewFields(data.extraction as ExtractedDealData));
      // Pre-fill deal name from company_name if available
      const cn = (data.extraction as ExtractedDealData).company_name?.value;
      if (cn) setDealName(cn);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ── Review field change ─────────────────────────────────────────────────────

  const handleFieldChange = (key: keyof ExtractedDealData, value: string) => {
    setReviewFields((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const state: FieldState =
          value === "" ? (f.extractedValue ? "extracted" : "unknown") :
          value === f.extractedValue ? "extracted" :
          "edited";
        return { ...f, currentValue: value, state };
      })
    );
    setReviewError(null);
  };

  // ── Submit to IC ────────────────────────────────────────────────────────────

  const handleRunIC = () => {
    if (!dealName.trim()) { setReviewError("Deal name is required."); return; }
    try {
      const dealText = buildDealText(reviewFields);
      onReady({ dealName: dealName.trim(), dealText });
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Cannot build deal text");
    }
  };

  // ── Render: Upload step ─────────────────────────────────────────────────────

  if (!extraction) {
    return (
      <div>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 6 }}>
            DEAL DATA ROOM — INGESTION V1
          </div>
          <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>
            Upload your deal documents. The AI will extract structured fields for your review before running the Council of 10.
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 6 }}>
            Supported: PDF · Excel · CSV · TXT · DOCX · ZIP (up to {MAX_FILES} files, {MAX_TOTAL_MB} MB total)
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? ACCENT : BORDER}`,
            borderRadius: 8,
            padding: "40px 24px",
            textAlign: "center",
            cursor: "pointer",
            background: dragOver ? "rgba(74,158,255,0.05)" : BG3,
            transition: "all 0.15s",
            marginBottom: 16,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
          />
          <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: dragOver ? ACCENT : TEXT2, letterSpacing: "0.06em" }}>
            {dragOver ? "DROP FILES HERE" : "DRAG & DROP FILES OR CLICK TO BROWSE"}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 6 }}>
            Pitch decks, financials, term sheets, data room ZIPs — all accepted
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.08em", marginBottom: 8 }}>
              {files.length} FILE{files.length > 1 ? "S" : ""} QUEUED — {formatBytes(files.reduce((s, f) => s + f.size, 0))} TOTAL
            </div>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, overflow: "hidden" }}>
              {files.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px",
                    borderBottom: idx < files.length - 1 ? `1px solid ${BORDER}` : "none",
                    background: BG2,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: ACCENT }}>
                      {f.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                    </span>
                    <span style={{ fontSize: 13, color: TEXT }}>{f.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        color: RED, fontFamily: MONO, fontSize: 12, padding: "0 4px",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <div style={{
            padding: "10px 14px", background: "rgba(255,71,87,0.1)",
            border: `1px solid rgba(255,71,87,0.3)`, borderRadius: 4,
            color: RED, fontFamily: MONO, fontSize: 12, marginBottom: 16,
          }}>
            {uploadError}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleIngest}
            disabled={uploading || files.length === 0}
            style={{
              flex: 1, padding: "12px",
              background: uploading || files.length === 0 ? MUTED : ACCENT,
              border: "none", borderRadius: 4,
              color: uploading || files.length === 0 ? TEXT2 : "#000",
              fontFamily: MONO, fontSize: 12, fontWeight: 700,
              cursor: uploading || files.length === 0 ? "not-allowed" : "pointer",
              letterSpacing: "0.08em",
            }}
          >
            {uploading ? "⏳ EXTRACTING DEAL DATA..." : `EXTRACT & REVIEW →`}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "12px 20px", background: "transparent",
              border: `1px solid ${BORDER}`, borderRadius: 4,
              color: TEXT2, fontFamily: MONO, fontSize: 12,
              cursor: "pointer", letterSpacing: "0.06em",
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Review step ─────────────────────────────────────────────────────

  const extractedCount  = reviewFields.filter((f) => f.state === "extracted").length;
  const unknownCount    = reviewFields.filter((f) => f.state === "unknown").length;
  const editedCount     = reviewFields.filter((f) => f.state === "edited").length;
  const confidenceColor = extraction.extraction_confidence === "HIGH" ? GREEN : extraction.extraction_confidence === "MEDIUM" ? AMBER : RED;

  return (
    <div>
      {/* Review header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 6 }}>
          DEAL DATA ROOM — REVIEW EXTRACTED FIELDS
        </div>

        {/* Ingestion summary bar */}
        <div style={{
          display: "flex", gap: 12, flexWrap: "wrap",
          padding: "12px 16px", background: BG3,
          border: `1px solid ${BORDER}`, borderRadius: 6, marginBottom: 16,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>
            <span style={{ color: MUTED }}>FILES: </span>
            <span style={{ color: TEXT }}>{ingestionMeta?.fileCount}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>
            <span style={{ color: MUTED }}>CHARS: </span>
            <span style={{ color: TEXT }}>{ingestionMeta?.totalChars.toLocaleString()}</span>
            {ingestionMeta?.truncated && <span style={{ color: AMBER }}> (truncated)</span>}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>
            <span style={{ color: MUTED }}>CONFIDENCE: </span>
            <span style={{ color: confidenceColor }}>{extraction.extraction_confidence}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: TEXT2 }}>
            <span style={{ color: GREEN }}>✦ {extractedCount} EXTRACTED</span>
            {" · "}
            <span style={{ color: AMBER }}>? {unknownCount} UNKNOWN</span>
            {editedCount > 0 && <>{" · "}<span style={{ color: PURPLE }}>✏ {editedCount} EDITED</span></>}
          </div>
        </div>

        {/* Extraction notes */}
        {extraction.extraction_notes && (
          <div style={{
            padding: "10px 14px", background: "rgba(74,158,255,0.06)",
            border: `1px solid rgba(74,158,255,0.2)`, borderRadius: 4,
            fontSize: 12, color: TEXT2, lineHeight: 1.5, marginBottom: 16,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, marginRight: 8 }}>AI NOTE:</span>
            {extraction.extraction_notes}
          </div>
        )}

        {/* Ingestion errors (non-fatal) */}
        {ingestionMeta && ingestionMeta.errors.length > 0 && (
          <div style={{
            padding: "10px 14px", background: "rgba(255,159,67,0.06)",
            border: `1px solid rgba(255,159,67,0.2)`, borderRadius: 4,
            marginBottom: 16,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER, marginBottom: 6 }}>
              {ingestionMeta.errors.length} FILE(S) COULD NOT BE PARSED:
            </div>
            {ingestionMeta.errors.map((e, i) => (
              <div key={i} style={{ fontSize: 11, color: TEXT2, marginBottom: 2 }}>
                <span style={{ color: TEXT }}>{e.fileName}</span> — {e.error}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>
          Review and correct the extracted fields below. Fields marked{" "}
          <span style={{ color: AMBER, fontFamily: MONO, fontSize: 11 }}>? UNKNOWN</span>{" "}
          were not found in your documents — enter them manually if available.
          Fields marked{" "}
          <span style={{ color: GREEN, fontFamily: MONO, fontSize: 11 }}>✦ EXTRACTED</span>{" "}
          include the exact source quote — hover ⓘ to verify.
        </div>
      </div>

      {/* Deal name */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.08em", marginBottom: 6 }}>
          DEAL NAME <span style={{ color: RED }}>*</span>
        </label>
        <input
          type="text"
          value={dealName}
          onChange={(e) => { setDealName(e.target.value); setReviewError(null); }}
          placeholder="e.g. Tamara Series B — BNPL GCC"
          maxLength={255}
          style={{
            width: "100%", padding: "10px 14px",
            background: BG3, border: `1px solid ${!dealName.trim() && reviewError ? RED : BORDER}`,
            borderRadius: 4, color: TEXT, fontFamily: MONO, fontSize: 13,
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${BORDER}`, marginBottom: 24 }} />

      {/* Review fields */}
      {reviewFields.map((field) => (
        <ReviewFieldRow key={field.key} field={field} onChange={handleFieldChange} />
      ))}

      {/* Review error */}
      {reviewError && (
        <div style={{
          padding: "10px 14px", background: "rgba(255,71,87,0.1)",
          border: `1px solid rgba(255,71,87,0.3)`, borderRadius: 4,
          color: RED, fontFamily: MONO, fontSize: 12, marginBottom: 16,
        }}>
          {reviewError}
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: "flex", gap: 16, padding: "12px 16px",
        background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6,
        marginBottom: 20, flexWrap: "wrap",
      }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.06em" }}>FIELD STATES:</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: GREEN }}>✦ EXTRACTED — AI found this in your documents</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: AMBER }}>? UNKNOWN — Not found, enter manually if available</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: PURPLE }}>✏ EDITED — You have overridden the extracted value</div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={handleRunIC}
          style={{
            flex: 1, padding: "14px",
            background: ACCENT, border: "none", borderRadius: 4,
            color: "#000", fontFamily: MONO, fontSize: 13, fontWeight: 700,
            cursor: "pointer", letterSpacing: "0.08em",
          }}
        >
          RUN IC ANALYSIS →
        </button>
        <button
          type="button"
          onClick={() => { setExtraction(null); setIngestionMeta(null); setReviewFields([]); setFiles([]); }}
          style={{
            padding: "14px 20px", background: "transparent",
            border: `1px solid ${BORDER}`, borderRadius: 4,
            color: TEXT2, fontFamily: MONO, fontSize: 12,
            cursor: "pointer", letterSpacing: "0.06em",
          }}
        >
          ← RE-UPLOAD
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "14px 20px", background: "transparent",
            border: `1px solid ${BORDER}`, borderRadius: 4,
            color: MUTED, fontFamily: MONO, fontSize: 12,
            cursor: "pointer", letterSpacing: "0.06em",
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
