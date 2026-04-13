/**
 * DataRoomBatch.tsx
 * Multi-deal "Data Room Mode" for Deal Screener.
 * Supports: paste (delimiter-separated) + JSON file upload.
 * Processes up to 100 deals concurrently (5-worker pool).
 * Shows live progress table with drill-down into existing ICReport.
 */
import React, { useState, useRef, useCallback } from "react";

// ── Design tokens (mirrors DealScreener.tsx) ──────────────────────────────────
const BG = "#070b12";
const BG2 = "#0d1421";
const BG3 = "#111827";
const BORDER = "#1e2d3d";
const ACCENT = "#4a9eff";
const GREEN = "#00ff87";
const AMBER = "#ff9f43";
const RED = "#ff4757";
const PURPLE = "#a855f7";
const MUTED = "#4a5568";
const TEXT = "#e2e8f0";
const TEXT2 = "#94a3b8";
const MONO = "'IBM Plex Mono', 'Fira Code', 'JetBrains Mono', monospace";

// ── Types ─────────────────────────────────────────────────────────────────────
type VerdictType = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED";
type BatchStatus = "pending" | "processing" | "completed" | "failed";
type FilterType = "all" | "approved" | "rejected" | "review" | "failed";

export interface BatchDealResult {
  index: number;
  dealName: string;
  dealText: string;
  status: BatchStatus;
  triage?: { decision: string; confidence: number; reason: string } | null;
  verdict?: VerdictType | null;
  hasIcReport: boolean;
  councilResult?: object | null; // full CouncilResult for drill-down
  error?: string;
}

interface Props {
  councilMode: "gcc" | "global_vc" | "india_pe";
  onDrillDown: (result: object) => void;
  onCancel: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CONCURRENCY = 5;
const MAX_DEALS = 100;

function parsePastedDeals(raw: string): Array<{ dealText: string; dealName: string }> {
  // Split on common delimiters: "---", "===", triple newline, or numbered "1." prefix
  const blocks = raw
    .split(/\n---+\n|\n===+\n|\n{3,}/)
    .map(b => b.trim())
    .filter(b => b.length > 30); // ignore tiny fragments

  return blocks.map((block, i) => {
    // Try to extract a deal name from the first line if it looks like a title
    const lines = block.split("\n");
    const firstLine = lines[0].trim();
    const looksLikeTitle = firstLine.length < 80 && !firstLine.includes(". ") && lines.length > 2;
    const dealName = looksLikeTitle ? firstLine : `Deal ${i + 1}`;
    const dealText = looksLikeTitle ? lines.slice(1).join("\n").trim() : block;
    return { dealName, dealText };
  });
}

function verdictColor(v?: VerdictType | null): string {
  if (!v) return MUTED;
  if (v === "APPROVED") return GREEN;
  if (v === "APPROVED_WITH_CONDITIONS") return AMBER;
  if (v === "REJECTED") return RED;
  if (v === "VETOED") return PURPLE;
  return MUTED;
}

function triageColor(d?: string): string {
  if (!d) return MUTED;
  if (d === "PROCEED") return GREEN;
  if (d === "OBVIOUS_REJECT") return RED;
  if (d === "INSUFFICIENT_INPUT") return AMBER;
  if (d === "OUT_OF_SCOPE") return PURPLE;
  return MUTED;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DataRoomBatch({ councilMode, onDrillDown, onCancel }: Props) {
  const [stage, setStage] = useState<"input" | "processing" | "done">("input");
  const [pasteText, setPasteText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [deals, setDeals] = useState<BatchDealResult[]>([]);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");
  const abortRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Parse input and start batch ──────────────────────────────────────────
  const startBatch = useCallback(async (rawDeals: Array<{ dealText: string; dealName: string }>) => {
    if (rawDeals.length === 0) { setInputError("No deals found. Check your input format."); return; }
    if (rawDeals.length > MAX_DEALS) { setInputError(`Maximum ${MAX_DEALS} deals per batch. Found ${rawDeals.length}.`); return; }

    abortRef.current = false;
    const initial: BatchDealResult[] = rawDeals.map((d, i) => ({
      index: i,
      dealName: d.dealName || `Deal ${i + 1}`,
      dealText: d.dealText,
      status: "pending",
      hasIcReport: false,
    }));
    setDeals(initial);
    setTotal(rawDeals.length);
    setProcessed(0);
    setStage("processing");

    // ── Concurrency pool ─────────────────────────────────────────────────
    let cursor = 0;
    const runWorker = async () => {
      while (cursor < rawDeals.length) {
        if (abortRef.current) break;
        const idx = cursor++;
        const deal = rawDeals[idx];

        // Mark as processing
        setDeals(prev => prev.map(d => d.index === idx ? { ...d, status: "processing" } : d));

        try {
          const resp = await fetch("/api/deal/screen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              dealText: deal.dealText,
              dealName: deal.dealName,
              councilMode,
              includeReport: true,
            }),
          });
          const json = await resp.json();
          if (!resp.ok || !json.success) throw new Error(json.error ?? "Unknown error");

          const data = json.data;
          setDeals(prev => prev.map(d => d.index === idx ? {
            ...d,
            status: "completed",
            triage: data.triage ?? null,
            verdict: data.council?.verdict ?? null,
            hasIcReport: !!data.ic_report,
            councilResult: data,
          } : d));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setDeals(prev => prev.map(d => d.index === idx ? { ...d, status: "failed", error: msg } : d));
        }

        setProcessed(p => p + 1);
      }
    };

    // Spawn CONCURRENCY workers
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rawDeals.length) }, runWorker));
    setStage("done");
  }, [councilMode]);

  // ── Handle paste submit ──────────────────────────────────────────────────
  const handlePasteSubmit = () => {
    setInputError(null);
    const parsed = parsePastedDeals(pasteText);
    if (parsed.length === 0) { setInputError("Could not parse any deals. Separate deals with '---' on its own line, or use triple blank lines."); return; }
    startBatch(parsed);
  };

  // ── Handle JSON file upload ──────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(raw)) { setInputError("JSON must be an array: [{\"dealText\": \"...\"}]"); return; }
        const parsed = raw.map((item: { dealText?: string; dealName?: string }, i: number) => ({
          dealText: String(item.dealText ?? ""),
          dealName: String(item.dealName ?? `Deal ${i + 1}`),
        })).filter(d => d.dealText.trim().length > 10);
        if (parsed.length === 0) { setInputError("No valid deals found in JSON file."); return; }
        startBatch(parsed);
      } catch {
        setInputError("Invalid JSON file. Expected array of {dealText, dealName} objects.");
      }
    };
    reader.readAsText(file);
  };

  // ── Retry a failed deal ──────────────────────────────────────────────────
  const retryDeal = async (idx: number) => {
    const deal = deals.find(d => d.index === idx);
    if (!deal) return;
    setDeals(prev => prev.map(d => d.index === idx ? { ...d, status: "processing", error: undefined } : d));
    try {
      const resp = await fetch("/api/deal/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dealText: deal.dealText, dealName: deal.dealName, councilMode, includeReport: true }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) throw new Error(json.error ?? "Unknown error");
      const data = json.data;
      setDeals(prev => prev.map(d => d.index === idx ? {
        ...d, status: "completed",
        triage: data.triage ?? null,
        verdict: data.council?.verdict ?? null,
        hasIcReport: !!data.ic_report,
        councilResult: data,
      } : d));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeals(prev => prev.map(d => d.index === idx ? { ...d, status: "failed", error: msg } : d));
    }
  };

  // ── Filtered deals ───────────────────────────────────────────────────────
  const filteredDeals = deals.filter(d => {
    if (filter === "all") return true;
    if (filter === "failed") return d.status === "failed";
    if (filter === "approved") return d.verdict === "APPROVED" || d.verdict === "APPROVED_WITH_CONDITIONS";
    if (filter === "rejected") return d.verdict === "REJECTED" || d.verdict === "VETOED";
    if (filter === "review") return d.verdict === "APPROVED_WITH_CONDITIONS";
    return true;
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    approved: deals.filter(d => d.verdict === "APPROVED").length,
    conditional: deals.filter(d => d.verdict === "APPROVED_WITH_CONDITIONS").length,
    rejected: deals.filter(d => d.verdict === "REJECTED" || d.verdict === "VETOED").length,
    failed: deals.filter(d => d.status === "failed").length,
    triageFiltered: deals.filter(d => d.triage?.decision !== "PROCEED" && d.triage !== undefined && d.triage !== null).length,
  };

  // ── INPUT STAGE ──────────────────────────────────────────────────────────
  if (stage === "input") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${BORDER}`, color: TEXT2, fontFamily: MONO, fontSize: 10, padding: "4px 10px", borderRadius: 4, cursor: "pointer", letterSpacing: "0.06em" }}>
              ← BACK
            </button>
            <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em" }}>DATA ROOM MODE · MULTI-DEAL BATCH</div>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, color: TEXT, fontWeight: 700 }}>Upload Multiple Deals</h2>
          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, marginTop: 6 }}>
            Up to {MAX_DEALS} deals · {CONCURRENCY} parallel workers · Full council analysis per deal
          </div>
        </div>

        {/* Option A: Paste */}
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 12 }}>OPTION A — PASTE MULTIPLE DEALS</div>
          <div style={{ fontSize: 12, color: TEXT2, marginBottom: 12 }}>
            Separate deals with <code style={{ background: BG3, padding: "1px 5px", borderRadius: 3, color: AMBER }}>---</code> on its own line, or use 3+ blank lines between deals.
          </div>
          <textarea
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); setInputError(null); }}
            placeholder={"Deal Alpha — Fintech GCC\nWe are building a BNPL platform for SMEs in Kuwait...\n\n---\n\nDeal Beta — HealthTech\nTelehealth platform for GCC with 12K active users..."}
            rows={10}
            style={{
              width: "100%", padding: "12px 14px",
              background: BG3, border: `1px solid ${BORDER}`,
              borderRadius: 4, color: TEXT, fontFamily: MONO, fontSize: 12,
              outline: "none", resize: "vertical", boxSizing: "border-box",
              lineHeight: 1.6,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
              {pasteText.trim() ? `~${parsePastedDeals(pasteText).length} deal(s) detected` : "Paste deal memos above"}
            </div>
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              style={{
                padding: "10px 24px", background: pasteText.trim() ? ACCENT : BG3,
                border: "none", borderRadius: 4,
                color: pasteText.trim() ? "#000" : MUTED,
                fontFamily: MONO, fontSize: 12, fontWeight: 700,
                cursor: pasteText.trim() ? "pointer" : "not-allowed",
                letterSpacing: "0.08em",
              }}
            >
              PROCESS BATCH →
            </button>
          </div>
        </div>

        {/* Option B: JSON Upload */}
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 12 }}>OPTION B — UPLOAD JSON FILE</div>
          <div style={{ fontSize: 12, color: TEXT2, marginBottom: 12 }}>
            Upload a <code style={{ background: BG3, padding: "1px 5px", borderRadius: 3, color: AMBER }}>.json</code> file with an array of deal objects:
          </div>
          <pre style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "12px 14px", fontFamily: MONO, fontSize: 11, color: TEXT2, marginBottom: 14, overflow: "auto" }}>
{`[
  { "dealName": "Deal Alpha", "dealText": "We are building..." },
  { "dealName": "Deal Beta", "dealText": "Telehealth platform..." }
]`}
          </pre>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "10px 24px", background: "transparent",
              border: `1px solid ${ACCENT}`, borderRadius: 4,
              color: ACCENT, fontFamily: MONO, fontSize: 12,
              cursor: "pointer", letterSpacing: "0.08em",
            }}
          >
            CHOOSE JSON FILE
          </button>
        </div>

        {/* Option C: ZIP stub */}
        <div style={{ background: BG2, border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "16px 28px", marginBottom: 16, opacity: 0.5 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, letterSpacing: "0.12em" }}>OPTION C — ZIP / MULTIPLE FILES (COMING SOON)</div>
        </div>

        {inputError && (
          <div style={{ padding: "10px 14px", background: "rgba(255,71,87,0.1)", border: `1px solid rgba(255,71,87,0.3)`, borderRadius: 4, color: RED, fontFamily: MONO, fontSize: 12 }}>
            {inputError}
          </div>
        )}
      </div>
    );
  }

  // ── PROCESSING / DONE STAGE ──────────────────────────────────────────────
  const progressPct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${BORDER}`, color: TEXT2, fontFamily: MONO, fontSize: 10, padding: "4px 10px", borderRadius: 4, cursor: "pointer", letterSpacing: "0.06em" }}>
          ← NEW BATCH
        </button>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em", marginBottom: 2 }}>DATA ROOM MODE · BATCH ANALYSIS</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT }}>
            {stage === "processing"
              ? `Processing ${processed} / ${total} deals...`
              : `Completed — ${total} deals analysed`}
          </div>
        </div>
        {stage === "processing" && (
          <button
            onClick={() => { abortRef.current = true; setStage("done"); }}
            style={{ marginLeft: "auto", padding: "6px 14px", background: "transparent", border: `1px solid ${RED}`, borderRadius: 4, color: RED, fontFamily: MONO, fontSize: 10, cursor: "pointer" }}
          >
            STOP
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ background: BG3, borderRadius: 4, height: 6, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: stage === "done" ? GREEN : ACCENT, transition: "width 0.3s ease", borderRadius: 4 }} />
      </div>

      {/* Stats row */}
      {stage === "done" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "APPROVED", value: stats.approved, color: GREEN },
            { label: "CONDITIONAL", value: stats.conditional, color: AMBER },
            { label: "REJECTED", value: stats.rejected, color: RED },
            { label: "TRIAGE FILTERED", value: stats.triageFiltered, color: PURPLE },
            { label: "FAILED", value: stats.failed, color: MUTED },
          ].map(s => (
            <div key={s.label} style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, letterSpacing: "0.08em", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "approved", "rejected", "review", "failed"] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 12px",
              background: filter === f ? "rgba(74,158,255,0.15)" : "transparent",
              border: `1px solid ${filter === f ? ACCENT : BORDER}`,
              borderRadius: 4, color: filter === f ? ACCENT : TEXT2,
              fontFamily: MONO, fontSize: 10, cursor: "pointer", letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {f === "all" ? `ALL (${deals.length})` : f === "approved" ? `APPROVED (${stats.approved + stats.conditional})` : f === "rejected" ? `REJECTED (${stats.rejected})` : f === "review" ? `CONDITIONAL (${stats.conditional})` : `FAILED (${stats.failed})`}
          </button>
        ))}
      </div>

      {/* Summary table */}
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 0.8fr 0.8fr 0.8fr", gap: 0, padding: "10px 16px", background: BG3, borderBottom: `1px solid ${BORDER}` }}>
          {["DEAL NAME", "TRIAGE", "VERDICT", "IC REPORT", "STATUS", "ACTION"].map(h => (
            <div key={h} style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.1em" }}>{h}</div>
          ))}
        </div>

        {/* Table rows */}
        {filteredDeals.length === 0 && (
          <div style={{ padding: "32px 16px", textAlign: "center", fontFamily: MONO, fontSize: 11, color: MUTED }}>
            No deals match the current filter.
          </div>
        )}
        {filteredDeals.map((deal, rowIdx) => (
          <div
            key={deal.index}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1.5fr 0.8fr 0.8fr 0.8fr",
              gap: 0,
              padding: "12px 16px",
              borderBottom: rowIdx < filteredDeals.length - 1 ? `1px solid ${BORDER}` : "none",
              alignItems: "center",
              background: deal.status === "processing" ? "rgba(74,158,255,0.03)" : "transparent",
            }}
          >
            {/* Deal Name */}
            <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
              {deal.dealName}
            </div>

            {/* Triage */}
            <div>
              {deal.triage ? (
                <span style={{ fontFamily: MONO, fontSize: 9, color: triageColor(deal.triage.decision), background: `${triageColor(deal.triage.decision)}15`, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.06em" }}>
                  {deal.triage.decision === "PROCEED" ? "PROCEED" : deal.triage.decision === "OBVIOUS_REJECT" ? "REJECTED" : deal.triage.decision === "INSUFFICIENT_INPUT" ? "INSUFFICIENT" : "OUT OF SCOPE"}
                </span>
              ) : deal.status === "processing" ? (
                <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>—</span>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>—</span>
              )}
            </div>

            {/* Verdict */}
            <div>
              {deal.verdict ? (
                <span style={{ fontFamily: MONO, fontSize: 9, color: verdictColor(deal.verdict), background: `${verdictColor(deal.verdict)}15`, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.06em" }}>
                  {deal.verdict.replace("_", " ")}
                </span>
              ) : deal.status === "processing" ? (
                <span style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, animation: "pulse 1.5s infinite" }}>ANALYSING...</span>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>—</span>
              )}
            </div>

            {/* IC Report */}
            <div style={{ fontFamily: MONO, fontSize: 10, color: deal.hasIcReport ? GREEN : MUTED }}>
              {deal.hasIcReport ? "YES" : "NO"}
            </div>

            {/* Status */}
            <div>
              <span style={{
                fontFamily: MONO, fontSize: 9,
                color: deal.status === "completed" ? GREEN : deal.status === "failed" ? RED : deal.status === "processing" ? ACCENT : MUTED,
                letterSpacing: "0.06em",
              }}>
                {deal.status.toUpperCase()}
              </span>
            </div>

            {/* Action */}
            <div style={{ display: "flex", gap: 6 }}>
              {deal.status === "completed" && deal.councilResult && (
                <button
                  onClick={() => onDrillDown(deal.councilResult!)}
                  style={{
                    padding: "4px 10px", background: "rgba(74,158,255,0.1)",
                    border: `1px solid ${ACCENT}`, borderRadius: 3,
                    color: ACCENT, fontFamily: MONO, fontSize: 9,
                    cursor: "pointer", letterSpacing: "0.06em",
                  }}
                >
                  VIEW →
                </button>
              )}
              {deal.status === "failed" && (
                <button
                  onClick={() => retryDeal(deal.index)}
                  style={{
                    padding: "4px 10px", background: "rgba(255,71,87,0.1)",
                    border: `1px solid ${RED}`, borderRadius: 3,
                    color: RED, fontFamily: MONO, fontSize: 9,
                    cursor: "pointer", letterSpacing: "0.06em",
                  }}
                >
                  RETRY
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error detail tooltip area */}
      {deals.some(d => d.status === "failed" && d.error) && (
        <div style={{ marginTop: 16, background: "rgba(255,71,87,0.06)", border: `1px solid rgba(255,71,87,0.2)`, borderRadius: 6, padding: "12px 16px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginBottom: 8, letterSpacing: "0.08em" }}>FAILED DEALS:</div>
          {deals.filter(d => d.status === "failed" && d.error).map(d => (
            <div key={d.index} style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, marginBottom: 4 }}>
              <span style={{ color: TEXT }}>{d.dealName}</span>: {d.error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
