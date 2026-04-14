/**
 * DataRoomBatch.tsx
 * Multi-deal "Data Room Mode" for Deal Screener.
 *
 * Terminology:
 *   Screening Result = full pipeline output (triage + council + votes + rationale + verdict)
 *   IC Memo          = long-form generated investment report (on-demand, per deal)
 *   Audit Trail      = stored reasoning (votes, rationales, timestamps, status)
 *
 * Supports: paste (delimiter-separated) + JSON file upload.
 * Processes up to 100 deals concurrently (5-worker pool).
 * Shows live progress table with drill-down into full Screening Result.
 * Per-deal "Generate IC Memo" button calls POST /api/deal/:dealId/generate-memo.
 * Verdict donut chart shown in the done stage summary.
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
type MemoStatus = "idle" | "loading" | "done" | "error";

export interface BatchDealResult {
  index: number;
  dealName: string;
  dealText: string;
  status: BatchStatus;
  triage?: { decision: string; confidence: number; reason: string } | null;
  verdict?: VerdictType | null;
  hasIcReport: boolean;
  dealId?: string | null;           // DB deal ID for generate-memo endpoint
  councilResult?: object | null;    // full Screening Result for drill-down
  memoStatus?: MemoStatus;          // per-deal IC Memo generation state
  memoText?: string | null;         // generated IC Memo text
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
  const blocks = raw
    .split(/\n---+\n|\n===+\n|\n{3,}/)
    .map(b => b.trim())
    .filter(b => b.length > 30);

  return blocks.map((block, i) => {
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

// ── Verdict Donut Chart ───────────────────────────────────────────────────────
interface DonutProps {
  approved: number;
  conditional: number;
  rejected: number;
  vetoed: number;
  total: number;
}

function VerdictDonut({ approved, conditional, rejected, vetoed, total }: DonutProps) {
  if (total === 0) return null;

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 52;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * r;

  const segments: Array<{ value: number; color: string; label: string }> = [
    { value: approved, color: GREEN, label: "APPROVED" },
    { value: conditional, color: AMBER, label: "CONDITIONAL" },
    { value: rejected, color: RED, label: "REJECTED" },
    { value: vetoed, color: PURPLE, label: "VETOED" },
  ].filter(s => s.value > 0);

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const arc = { ...seg, pct, dash, gap, offset };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      {/* SVG donut */}
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={BG3} strokeWidth={strokeWidth} />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill={TEXT} fontFamily={MONO} fontSize={22} fontWeight={700}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill={MUTED} fontFamily={MONO} fontSize={8} letterSpacing="0.1em">DEALS</text>
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { label: "APPROVED", value: approved, color: GREEN },
          { label: "CONDITIONAL", value: conditional, color: AMBER },
          { label: "REJECTED", value: rejected, color: RED },
          { label: "VETOED", value: vetoed, color: PURPLE },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT2, letterSpacing: "0.06em", minWidth: 90 }}>{item.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: item.value > 0 ? item.color : MUTED, fontWeight: 700 }}>{item.value}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
              ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── IC Memo Modal ─────────────────────────────────────────────────────────────
function IcMemoModal({ memoText, dealName, onClose }: { memoText: string; dealName: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: BG2, border: `1px solid ${BORDER}`, borderRadius: 10,
        maxWidth: 760, width: "100%", maxHeight: "85vh",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: ACCENT, letterSpacing: "0.15em", marginBottom: 2 }}>IC MEMO</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: TEXT }}>{dealName}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(memoText);
              }}
              style={{ padding: "6px 14px", background: "rgba(74,158,255,0.1)", border: `1px solid ${ACCENT}`, borderRadius: 4, color: ACCENT, fontFamily: MONO, fontSize: 10, cursor: "pointer", letterSpacing: "0.06em" }}
            >
              COPY
            </button>
            <button
              onClick={onClose}
              style={{ padding: "6px 14px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT2, fontFamily: MONO, fontSize: 10, cursor: "pointer" }}
            >
              CLOSE
            </button>
          </div>
        </div>
        {/* Content */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          <pre style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>
            {memoText}
          </pre>
        </div>
      </div>
    </div>
  );
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
  const [memoModal, setMemoModal] = useState<{ dealName: string; memoText: string } | null>(null);
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
      memoStatus: "idle",
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
            dealId: data.dealId ?? null,
            councilResult: data,
            memoStatus: "idle",
          } : d));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setDeals(prev => prev.map(d => d.index === idx ? { ...d, status: "failed", error: msg } : d));
        }

        setProcessed(p => p + 1);
      }
    };

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
        dealId: data.dealId ?? null,
        councilResult: data,
        memoStatus: "idle",
      } : d));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeals(prev => prev.map(d => d.index === idx ? { ...d, status: "failed", error: msg } : d));
    }
  };

  // ── Generate IC Memo for a deal ──────────────────────────────────────────
  const generateMemo = async (idx: number) => {
    const deal = deals.find(d => d.index === idx);
    if (!deal || !deal.dealId) return;

    setDeals(prev => prev.map(d => d.index === idx ? { ...d, memoStatus: "loading" } : d));
    try {
      const resp = await fetch(`/api/deal/${deal.dealId}/generate-memo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ forceRegenerate: false }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) throw new Error(json.error ?? "Unknown error");
      setDeals(prev => prev.map(d => d.index === idx ? {
        ...d,
        memoStatus: "done",
        memoText: json.memoText,
        hasIcReport: true,
      } : d));
      // Auto-open the memo modal
      setMemoModal({ dealName: deal.dealName, memoText: json.memoText });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeals(prev => prev.map(d => d.index === idx ? { ...d, memoStatus: "error", error: msg } : d));
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
    rejected: deals.filter(d => d.verdict === "REJECTED").length,
    vetoed: deals.filter(d => d.verdict === "VETOED").length,
    failed: deals.filter(d => d.status === "failed").length,
    triageFiltered: deals.filter(d => d.triage?.decision !== "PROCEED" && d.triage !== undefined && d.triage !== null).length,
  };
  const totalVerdicted = stats.approved + stats.conditional + stats.rejected + stats.vetoed;

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
            <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em" }}>DATA ROOM · BATCH SCREENING</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, lineHeight: 1.6 }}>
            Submit up to {MAX_DEALS} deals for parallel screening. Each deal receives a full Screening Result (triage + 10-agent council + audit trail). IC Memos can be generated on-demand per deal after screening.
          </div>
        </div>

        {/* Option A: Paste */}
        <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px 28px", marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.12em", marginBottom: 12 }}>OPTION A — PASTE DEAL TEXT</div>
          <div style={{ fontSize: 12, color: TEXT2, marginBottom: 12 }}>
            Separate multiple deals with <code style={{ background: BG3, padding: "1px 5px", borderRadius: 3, color: AMBER }}>---</code> on its own line, or use triple blank lines.
          </div>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={`Deal Alpha — SaaS for logistics\nWe are building a route optimization platform...\n\n---\n\nDeal Beta — Telehealth\nOur platform connects patients with specialists...`}
            style={{
              width: "100%", minHeight: 180, background: BG3,
              border: `1px solid ${BORDER}`, borderRadius: 4,
              color: TEXT, fontFamily: MONO, fontSize: 12,
              padding: "12px 14px", resize: "vertical",
              outline: "none", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: MUTED }}>
              {pasteText.trim() ? `~${parsePastedDeals(pasteText).length} deals detected` : ""}
            </span>
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              style={{
                padding: "10px 28px", background: pasteText.trim() ? "rgba(74,158,255,0.15)" : "transparent",
                border: `1px solid ${pasteText.trim() ? ACCENT : BORDER}`, borderRadius: 4,
                color: pasteText.trim() ? ACCENT : MUTED, fontFamily: MONO, fontSize: 12,
                cursor: pasteText.trim() ? "pointer" : "not-allowed", letterSpacing: "0.08em",
              }}
            >
              SCREEN ALL DEALS →
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
    <div style={{ maxWidth: 1020, margin: "0 auto" }}>
      {/* IC Memo Modal */}
      {memoModal && (
        <IcMemoModal
          dealName={memoModal.dealName}
          memoText={memoModal.memoText}
          onClose={() => setMemoModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${BORDER}`, color: TEXT2, fontFamily: MONO, fontSize: 10, padding: "4px 10px", borderRadius: 4, cursor: "pointer", letterSpacing: "0.06em" }}>
          ← NEW BATCH
        </button>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em", marginBottom: 2 }}>DATA ROOM · BATCH SCREENING</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: TEXT }}>
            {stage === "processing"
              ? `Processing ${processed} / ${total} deals...`
              : `Completed — ${total} deals screened`}
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

      {/* Done stage: Donut chart + stats row */}
      {stage === "done" && (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, marginBottom: 24, background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 24px", alignItems: "center" }}>
          {/* Donut */}
          <VerdictDonut
            approved={stats.approved}
            conditional={stats.conditional}
            rejected={stats.rejected}
            vetoed={stats.vetoed}
            total={totalVerdicted}
          />
          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "TRIAGE FILTERED", value: stats.triageFiltered, color: PURPLE },
              { label: "FAILED", value: stats.failed, color: RED },
              { label: "IC MEMOS READY", value: deals.filter(d => d.hasIcReport).length, color: AMBER },
            ].map(s => (
              <div key={s.label} style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: TEXT2, letterSpacing: "0.08em", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
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
            {f === "all" ? `ALL (${deals.length})`
              : f === "approved" ? `APPROVED (${stats.approved + stats.conditional})`
              : f === "rejected" ? `REJECTED / VETOED (${stats.rejected + stats.vetoed})`
              : f === "review" ? `CONDITIONAL (${stats.conditional})`
              : `FAILED (${stats.failed})`}
          </button>
        ))}
      </div>

      {/* Summary table */}
      <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 0.7fr 0.7fr 1.2fr", gap: 0, padding: "10px 16px", background: BG3, borderBottom: `1px solid ${BORDER}` }}>
          {["DEAL NAME", "TRIAGE", "VERDICT", "IC MEMO", "STATUS", "ACTIONS"].map(h => (
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
              gridTemplateColumns: "2fr 1fr 1.5fr 0.7fr 0.7fr 1.2fr",
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
                  {deal.triage.decision === "PROCEED" ? "PROCEED"
                    : deal.triage.decision === "OBVIOUS_REJECT" ? "REJECTED"
                    : deal.triage.decision === "INSUFFICIENT_INPUT" ? "INSUFFICIENT"
                    : "OUT OF SCOPE"}
                </span>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>—</span>
              )}
            </div>

            {/* Verdict */}
            <div>
              {deal.verdict ? (
                <span style={{ fontFamily: MONO, fontSize: 9, color: verdictColor(deal.verdict), background: `${verdictColor(deal.verdict)}15`, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.06em" }}>
                  {deal.verdict === "APPROVED_WITH_CONDITIONS" ? "CONDITIONAL" : deal.verdict}
                </span>
              ) : deal.status === "processing" ? (
                <span style={{ fontFamily: MONO, fontSize: 9, color: ACCENT }}>ANALYSING...</span>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>—</span>
              )}
            </div>

            {/* IC Memo status */}
            <div style={{ fontFamily: MONO, fontSize: 10 }}>
              {deal.hasIcReport ? (
                <span style={{ color: GREEN }}>READY</span>
              ) : deal.memoStatus === "loading" ? (
                <span style={{ color: AMBER }}>GEN...</span>
              ) : deal.memoStatus === "error" ? (
                <span style={{ color: RED }}>ERR</span>
              ) : (
                <span style={{ color: MUTED }}>—</span>
              )}
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

            {/* Actions */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {/* View Screening Result */}
              {deal.status === "completed" && deal.councilResult && (
                <button
                  onClick={() => onDrillDown(deal.councilResult!)}
                  style={{
                    padding: "3px 8px", background: "rgba(74,158,255,0.1)",
                    border: `1px solid ${ACCENT}`, borderRadius: 3,
                    color: ACCENT, fontFamily: MONO, fontSize: 9,
                    cursor: "pointer", letterSpacing: "0.06em",
                  }}
                >
                  VIEW
                </button>
              )}

              {/* Generate IC Memo */}
              {deal.status === "completed" && deal.dealId && (
                deal.memoStatus === "done" && deal.memoText ? (
                  <button
                    onClick={() => setMemoModal({ dealName: deal.dealName, memoText: deal.memoText! })}
                    style={{
                      padding: "3px 8px", background: "rgba(0,255,135,0.1)",
                      border: `1px solid ${GREEN}`, borderRadius: 3,
                      color: GREEN, fontFamily: MONO, fontSize: 9,
                      cursor: "pointer", letterSpacing: "0.06em",
                    }}
                  >
                    MEMO ↗
                  </button>
                ) : (
                  <button
                    onClick={() => generateMemo(deal.index)}
                    disabled={deal.memoStatus === "loading"}
                    style={{
                      padding: "3px 8px",
                      background: deal.memoStatus === "loading" ? "rgba(212,175,55,0.06)" : "rgba(212,175,55,0.1)",
                      border: `1px solid ${deal.memoStatus === "loading" ? "rgba(212,175,55,0.3)" : AMBER}`,
                      borderRadius: 3,
                      color: deal.memoStatus === "loading" ? "rgba(212,175,55,0.5)" : AMBER,
                      fontFamily: MONO, fontSize: 9,
                      cursor: deal.memoStatus === "loading" ? "not-allowed" : "pointer",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {deal.memoStatus === "loading" ? "GEN..." : "+ MEMO"}
                  </button>
                )
              )}

              {/* Retry failed */}
              {deal.status === "failed" && (
                <button
                  onClick={() => retryDeal(deal.index)}
                  style={{
                    padding: "3px 8px", background: "rgba(255,71,87,0.1)",
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

      {/* Error detail area */}
      {deals.some(d => d.status === "failed" && d.error) && (
        <div style={{ marginTop: 16, background: "rgba(255,71,87,0.06)", border: `1px solid rgba(255,71,87,0.2)`, borderRadius: 6, padding: "12px 16px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: RED, marginBottom: 8, letterSpacing: "0.08em" }}>FAILED DEALS — AUDIT TRAIL:</div>
          {deals.filter(d => d.status === "failed" && d.error).map(d => (
            <div key={d.index} style={{ fontFamily: MONO, fontSize: 11, color: TEXT2, marginBottom: 4 }}>
              <span style={{ color: TEXT }}>{d.dealName}</span>: {d.error}
            </div>
          ))}
        </div>
      )}

      {/* Terminology note */}
      {stage === "done" && (
        <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(74,158,255,0.04)", border: `1px solid rgba(74,158,255,0.12)`, borderRadius: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED }}>
            SCREENING RESULT = triage + council votes + rationale + verdict (stored in DB) · IC MEMO = long-form investment report (on-demand, click + MEMO) · AUDIT TRAIL = full vote log per deal
          </span>
        </div>
      )}
    </div>
  );
}
