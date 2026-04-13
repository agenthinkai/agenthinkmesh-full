/**
 * DataRoomV2.tsx
 *
 * Full Data Room Mode for Deal Screener.
 *
 * Flow:
 *  1. UPLOAD  — drag-drop / click to upload individual files or a single ZIP.
 *               Filename contains "gcc" / "global" / "india" to set council mode.
 *  2. REVIEW  — show extracted deal list with council mode badges. User clicks "Extract & Review".
 *  3. PROCESS — animated 10-agent council processing screen (live per-deal progress).
 *  4. RESULTS — professional summary grid with verdict badges + "Download All IC Memos (ZIP)".
 *               Click any deal card → drill-down into full ICReport.
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

// ── Design tokens ─────────────────────────────────────────────────────────────
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

// ── Agent definitions (all 3 council modes) ───────────────────────────────────
const AGENTS_BY_MODE: Record<string, Array<{ id: string; name: string; role: string; icon: string }>> = {
  gcc: [
    { id: "GCC_REG",      name: "GCC Regulatory",    role: "Regulatory & Legal (Veto)",     icon: "⚖️" },
    { id: "GCC_SHARIAH",  name: "Shariah Sentinel",  role: "Islamic Finance (Veto)",         icon: "☪️" },
    { id: "ANALYST",      name: "The Analyst",        role: "Investment Analysis",            icon: "📊" },
    { id: "SKEPTIC",      name: "The Skeptic",        role: "Risk Identification",            icon: "🔍" },
    { id: "CFO",          name: "CFO",                role: "Unit Economics",                 icon: "💰" },
    { id: "MACRO",        name: "Macro Oracle",       role: "GCC Macroeconomics",             icon: "🌍" },
    { id: "GEOPOLITICAL", name: "Geopolitical Watch", role: "Geopolitical Risk",              icon: "🛡️" },
    { id: "GCC_CONSUMER", name: "Consumer Analyst",   role: "Consumer & Market Fit",          icon: "🛒" },
    { id: "EXIT",         name: "Exit Strategist",    role: "M&A Viability",                  icon: "🚪" },
    { id: "DEVILS",       name: "Devil's Advocate",   role: "Second-Order Risks",             icon: "😈" },
  ],
  global_vc: [
    { id: "VC_THESIS",    name: "Thesis Validator",   role: "Investment Thesis",              icon: "📋" },
    { id: "VC_FOUNDER",   name: "Founder Evaluator",  role: "Team & Founder",                 icon: "👤" },
    { id: "VC_PRODUCT",   name: "Product Analyst",    role: "Product & Technology",           icon: "💻" },
    { id: "VC_CFO",       name: "VC CFO",             role: "Unit Economics & Growth",        icon: "💰" },
    { id: "VC_MARKET",    name: "Market Intelligence", role: "Competitive Landscape",         icon: "📈" },
    { id: "VC_SKEPTIC",   name: "The Skeptic",        role: "Risk Identification",            icon: "🔍" },
    { id: "VC_EXIT",      name: "Exit Strategist",    role: "M&A Viability",                  icon: "🚪" },
    { id: "VC_LEGAL",     name: "Legal Counsel",      role: "Legal & Regulatory",             icon: "⚖️" },
    { id: "VC_CONTRARIAN",name: "Contrarian",         role: "Contrarian Bull Case",           icon: "🐂" },
    { id: "VC_PORTFOLIO", name: "Portfolio Strategist","role": "Portfolio Fit",               icon: "🗂️" },
  ],
  india_pe: [
    { id: "IN_LEGAL",     name: "India Legal",        role: "SEBI / FEMA / Companies Act",   icon: "⚖️" },
    { id: "IN_CFO",       name: "India CFO",          role: "PE Unit Economics",              icon: "💰" },
    { id: "IN_MARKET",    name: "India Market",       role: "India Consumer & Market",        icon: "🇮🇳" },
    { id: "IN_MACRO",     name: "India Macro",        role: "India Macroeconomics",           icon: "📊" },
    { id: "IN_SKEPTIC",   name: "The Skeptic",        role: "Risk Identification",            icon: "🔍" },
    { id: "IN_ESG",       name: "ESG Analyst",        role: "ESG & DPDP Act",                 icon: "🌱" },
    { id: "IN_EXIT",      name: "Exit Strategist",    role: "IPO / Exit Viability",           icon: "🚪" },
    { id: "IN_CONTRARIAN",name: "Contrarian",         role: "Contrarian Bull Case",           icon: "🐂" },
    { id: "IN_DEVILS",    name: "Devil's Advocate",   role: "Second-Order Risks",             icon: "😈" },
    { id: "IN_ANALYST",   name: "Investment Analyst", role: "Investment Analysis",            icon: "📋" },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Stage = "upload" | "review" | "processing" | "results";
type VerdictType = "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED" | "VETOED";
type DealStatus = "pending" | "processing" | "completed" | "failed";

interface UploadedDeal {
  dealName: string;
  dealText: string;
  councilMode: "gcc" | "global_vc" | "india_pe";
  sourceFile: string;
  fromZip: boolean;
  zipSource?: string;
}

interface DealResult {
  index: number;
  dealName: string;
  councilMode: "gcc" | "global_vc" | "india_pe";
  status: DealStatus;
  verdict?: VerdictType | null;
  triage?: { decision: string; confidence: number; reason: string } | null;
  hasIcReport: boolean;
  councilResult?: object | null;
  yesCount?: number;
  noCount?: number;
  error?: string;
  processingAgents?: string[]; // agents currently being shown as "processing"
}

interface Props {
  onDrillDown: (result: object) => void;
  onCancel: () => void;
  /** Called when exactly 1 deal is uploaded — hands off to single-deal flow */
  onSingleDeal?: (dealName: string, dealText: string, councilMode: "gcc" | "global_vc" | "india_pe") => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function verdictColor(v?: VerdictType | null): string {
  if (!v) return MUTED;
  if (v === "APPROVED") return GREEN;
  if (v === "APPROVED_WITH_CONDITIONS") return AMBER;
  if (v === "REJECTED") return RED;
  if (v === "VETOED") return PURPLE;
  return MUTED;
}

function verdictLabel(v?: VerdictType | null): string {
  if (!v) return "—";
  if (v === "APPROVED") return "✅ APPROVED";
  if (v === "APPROVED_WITH_CONDITIONS") return "⚠️ CONDITIONAL";
  if (v === "REJECTED") return "❌ REJECTED";
  if (v === "VETOED") return "🚫 VETOED";
  return v;
}

function councilLabel(mode: string): string {
  if (mode === "gcc") return "GCC";
  if (mode === "global_vc") return "Global VC";
  if (mode === "india_pe") return "India PE";
  return mode.toUpperCase();
}

function councilColor(mode: string): string {
  if (mode === "gcc") return "#f59e0b";
  if (mode === "global_vc") return ACCENT;
  if (mode === "india_pe") return "#22c55e";
  return MUTED;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DataRoomV2({ onDrillDown, onCancel, onSingleDeal }: Props) {
  const [stage, setStage] = useState<Stage>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDeals, setUploadedDeals] = useState<UploadedDeal[]>([]);
  const [uploadSummary, setUploadSummary] = useState<{ totalFiles: number; totalDeals: number; councilBreakdown: Record<string, number> } | null>(null);
  const [deals, setDeals] = useState<DealResult[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [filterVerdict, setFilterVerdict] = useState<"all" | VerdictType>("all");
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ── Upload handlers ──────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      fileArray.forEach(f => formData.append("files", f));

      const res = await fetch("/api/dataroom/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        toast.error(err.error || "Upload failed");
        return;
      }

      const data = await res.json();
      if (!data.success || !data.deals?.length) {
        toast.error("No readable deal content found in uploaded files.");
        return;
      }

      // If only 1 deal and caller wants single-deal flow, hand off immediately
      if (data.deals.length === 1 && onSingleDeal) {
        const d = data.deals[0];
        toast.success(`1 deal extracted — launching single-deal council`);
        onSingleDeal(d.dealName, d.dealText, d.councilMode);
        return;
      }

      setUploadedDeals(data.deals);
      setUploadSummary(data.summary);
      setStage("review");
      toast.success(`${data.deals.length} deal${data.deals.length > 1 ? "s" : ""} extracted successfully`);
    } catch (err) {
      toast.error("Upload failed. Please try again.");
      console.error("[DataRoomV2] upload error:", err);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  // ── Server-side batch processing with live polling ───────────────────────────
  const startProcessing = useCallback(async () => {
    abortRef.current = false;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    // Initialise deal list in "pending" state for immediate UI feedback
    const initialDeals: DealResult[] = uploadedDeals.map((d, i) => ({
      index: i,
      dealName: d.dealName,
      councilMode: d.councilMode,
      status: "pending",
      hasIcReport: false,
    }));
    setDeals(initialDeals);
    setStage("processing");

    // Step 1: Enqueue all deals server-side
    let newBatchId: string;
    try {
      const enqueueRes = await fetch("/api/batch/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          deals: uploadedDeals.map(d => ({
            dealName: d.dealName,
            dealText: d.dealText,
            councilMode: d.councilMode,
          })),
        }),
      });
      if (!enqueueRes.ok) {
        const err = await enqueueRes.json().catch(() => ({ error: "Failed to start batch" }));
        toast.error(err.error || "Failed to start batch processing.");
        setStage("review");
        return;
      }
      const enqueueData = await enqueueRes.json();
      newBatchId = enqueueData.batchId;
      setBatchId(newBatchId);
      toast.success(`Batch job started — ${enqueueData.totalDeals} deals queued on server`);
    } catch {
      toast.error("Failed to connect to batch server.");
      setStage("review");
      return;
    }

    // Step 2: Poll /api/batch/:batchId/status every 2s
    const poll = async () => {
      if (abortRef.current) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        return;
      }
      try {
        const statusRes = await fetch(`/api/batch/${newBatchId}/status`, {
          credentials: "include",
        });
        if (!statusRes.ok) return;
        const statusData = await statusRes.json();
        if (!statusData.success) return;

        // Map server items → DealResult state
        const updatedDeals: DealResult[] = statusData.items.map((item: {
          index: number;
          dealName: string;
          councilMode: string;
          status: string;
          verdict?: string | null;
          yesCount?: number | null;
          noCount?: number | null;
          hasIcReport: boolean;
          councilResult?: Record<string, unknown> | null;
          error?: string | null;
        }) => {
          const isProcessing = item.status === "processing";
          const processingAgents = isProcessing
            ? (AGENTS_BY_MODE[item.councilMode] || AGENTS_BY_MODE.gcc).map(a => a.name)
            : undefined;
          return {
            index: item.index,
            dealName: item.dealName,
            councilMode: item.councilMode as DealResult["councilMode"],
            status: (item.status === "queued" ? "pending" : item.status) as DealStatus,
            verdict: (item.verdict ?? null) as VerdictType | null | undefined,
            yesCount: item.yesCount ?? undefined,
            noCount: item.noCount ?? undefined,
            hasIcReport: item.hasIcReport,
            councilResult: item.councilResult ?? null,
            processingAgents,
            error: item.error ?? undefined,
            triage: null,
          };
        });

        setDeals(updatedDeals);

        // Track which deal is currently processing
        const processingIdx = updatedDeals.findIndex(d => d.status === "processing");
        if (processingIdx >= 0) setProcessingIndex(processingIdx);

        // Check if batch is fully done
        const isDone = statusData.status === "completed" || statusData.status === "partial";
        if (isDone) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setStage("results");
          const failedCount = statusData.failedCount ?? 0;
          if (failedCount > 0) {
            toast.warning(`Batch complete — ${failedCount} deal${failedCount > 1 ? "s" : ""} failed. Use the Retry button to re-run them.`);
          } else {
            toast.success(`All ${statusData.totalDeals} deals processed successfully!`);
          }
        }
      } catch (err) {
        console.warn("[DataRoomV2] Poll error:", err);
      }
    };

    // Poll immediately then every 2s
    await poll();
    pollIntervalRef.current = setInterval(poll, 2000);
  }, [uploadedDeals]);

  // ── Bulk ZIP download ────────────────────────────────────────────────────────
  const handleBulkDownload = useCallback(async () => {
    const completed = deals.filter(d => d.status === "completed" && d.hasIcReport && d.councilResult);
    if (completed.length === 0) {
      toast.error("No completed IC Memos to download.");
      return;
    }

    setIsDownloadingZip(true);
    try {
      // Build ICMemoInput from councilResult — uses council fields (votes, counts, etc.)
      const memos = completed.map(d => {
        const cr = d.councilResult as Record<string, unknown>;
        return {
          dealName: d.dealName,
          verdict: (cr.verdict as string) || d.verdict || "REJECTED",
          yesCount: typeof cr.yesCount === "number" ? cr.yesCount : (d.yesCount ?? 0),
          noCount:  typeof cr.noCount  === "number" ? cr.noCount  : (d.noCount  ?? 0),
          confidenceScore: typeof cr.confidenceScore === "number" ? cr.confidenceScore : 0.5,
          conditionsToProceed: Array.isArray(cr.conditionsToProceed) ? cr.conditionsToProceed : [],
          blockingIssues: Array.isArray(cr.blockingIssues) ? cr.blockingIssues : [],
          votes: Array.isArray(cr.votes) ? cr.votes : [],
          councilMode: d.councilMode,
        };
      });

      const res = await fetch("/api/dataroom/bulk-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memos }),
      });

      if (!res.ok) {
        toast.error("Bulk PDF generation failed.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `AgenThinkMesh-IC-Memos-${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${completed.length} IC Memos as ZIP`);
    } catch (err) {
      toast.error("Download failed. Please try again.");
    } finally {
      setIsDownloadingZip(false);
    }
  }, [deals]);

  // ── Retry a single failed deal via server-side batch retry endpoint ─────────────
  const retryDeal = useCallback(async (idx: number) => {
    if (!batchId) return;
    // Optimistically reset to processing state
    setDeals(prev => prev.map((d, i) =>
      i === idx ? {
        ...d, status: "processing", error: undefined,
        processingAgents: (AGENTS_BY_MODE[prev[i].councilMode] || AGENTS_BY_MODE.gcc).map(a => a.name)
      } : d
    ));
    try {
      const res = await fetch(`/api/batch/${batchId}/retry-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemIndex: idx }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Retry failed" }));
        toast.error(err.error || "Retry failed");
        setDeals(prev => prev.map((d, i) =>
          i === idx ? { ...d, status: "failed", error: "Retry failed", processingAgents: undefined } : d
        ));
        return;
      }
      toast.success(`Retrying deal ${idx + 1}…`);
      // Resume polling if not already active
      if (!pollIntervalRef.current) {
        const currentBatchId = batchId;
        const poll = async () => {
          try {
            const statusRes = await fetch(`/api/batch/${currentBatchId}/status`, { credentials: "include" });
            if (!statusRes.ok) return;
            const statusData = await statusRes.json();
            if (!statusData.success) return;
            const updatedDeals: DealResult[] = statusData.items.map((item: {
              index: number; dealName: string; councilMode: string; status: string;
              verdict?: string | null; yesCount?: number | null; noCount?: number | null;
              hasIcReport: boolean; councilResult?: Record<string, unknown> | null; error?: string | null;
            }) => ({
              index: item.index,
              dealName: item.dealName,
              councilMode: item.councilMode as DealResult["councilMode"],
              status: (item.status === "queued" ? "pending" : item.status) as DealStatus,
              verdict: (item.verdict ?? null) as VerdictType | null | undefined,
              yesCount: item.yesCount ?? undefined,
              noCount: item.noCount ?? undefined,
              hasIcReport: item.hasIcReport,
              councilResult: item.councilResult ?? null,
              processingAgents: item.status === "processing"
                ? (AGENTS_BY_MODE[item.councilMode] || AGENTS_BY_MODE.gcc).map(a => a.name)
                : undefined,
              error: item.error ?? undefined,
              triage: null,
            }));
            setDeals(updatedDeals);
            if (statusData.status === "completed" || statusData.status === "partial") {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          } catch { /* ignore poll errors */ }
        };
        await poll();
        pollIntervalRef.current = setInterval(poll, 2000);
      }
    } catch {
      toast.error("Failed to connect to retry endpoint.");
      setDeals(prev => prev.map((d, i) =>
        i === idx ? { ...d, status: "failed", error: "Network error", processingAgents: undefined } : d
      ));
    }
  }, [batchId]);

  // ── Filtered results ─────────────────────────────────────────────────────────
  const filteredDeals = deals.filter(d => {
    if (filterVerdict === "all") return true;
    return d.verdict === filterVerdict;
  });

  const stats = {
    total: deals.length,
    completed: deals.filter(d => d.status === "completed").length,
    approved: deals.filter(d => d.verdict === "APPROVED").length,
    conditional: deals.filter(d => d.verdict === "APPROVED_WITH_CONDITIONS").length,
    rejected: deals.filter(d => d.verdict === "REJECTED" || d.verdict === "VETOED").length,
    failed: deals.filter(d => d.status === "failed").length,
  };

  // ── STAGE: UPLOAD ────────────────────────────────────────────────────────────
  if (stage === "upload") {
    return (
      <div style={{ fontFamily: MONO, color: TEXT, minHeight: "60vh", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT, letterSpacing: 1 }}>
              📁 DATA ROOM
            </div>
            <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>
              Upload deal files or a ZIP archive. Name files with <span style={{ color: AMBER }}>gcc</span>, <span style={{ color: ACCENT }}>global</span>, or <span style={{ color: GREEN }}>india</span> to set council mode.
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ background: "none", border: `1px solid ${BORDER}`, color: TEXT2, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
          >
            ← Back
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? ACCENT : BORDER}`,
            borderRadius: 12,
            padding: "60px 40px",
            textAlign: "center",
            cursor: "pointer",
            background: isDragging ? "rgba(74,158,255,0.05)" : BG2,
            transition: "all 0.2s",
            position: "relative",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.docx,.doc,.zip"
            style={{ display: "none" }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
          {isUploading ? (
            <div>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div style={{ color: ACCENT, fontSize: 14 }}>Extracting deal content…</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
              <div style={{ fontSize: 16, color: TEXT, marginBottom: 8, fontWeight: 600 }}>
                Drop files here or click to browse
              </div>
              <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.8 }}>
                Supported: <span style={{ color: ACCENT }}>PDF, TXT, DOCX, MD</span> — or a single <span style={{ color: AMBER }}>ZIP</span> containing multiple deals<br />
                Max 50 files · 20 MB per file<br />
                <br />
                <span style={{ color: TEXT2 }}>Filename examples:</span><br />
                <span style={{ color: AMBER }}>deal-gcc-fintech.pdf</span> → GCC Council &nbsp;|&nbsp;
                <span style={{ color: ACCENT }}>startup-global-saas.pdf</span> → Global VC &nbsp;|&nbsp;
                <span style={{ color: GREEN }}>india-pe-logistics.pdf</span> → India PE
              </div>
            </div>
          )}
        </div>

        {/* Format guide */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { mode: "GCC", color: "#f59e0b", keyword: "gcc", desc: "GCC Regulatory + Shariah + 8 specialists" },
            { mode: "Global VC", color: ACCENT, keyword: "global", desc: "10 VC-focused specialist agents" },
            { mode: "India PE", color: GREEN, keyword: "india", desc: "SEBI/FEMA + India PE specialists" },
          ].map(({ mode, color, keyword, desc }) => (
            <div key={mode} style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 4 }}>{mode} COUNCIL</div>
              <div style={{ fontSize: 11, color: TEXT2, marginBottom: 6 }}>Filename keyword: <span style={{ color }}>{keyword}</span></div>
              <div style={{ fontSize: 10, color: MUTED }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── STAGE: REVIEW ────────────────────────────────────────────────────────────
  if (stage === "review") {
    return (
      <div style={{ fontFamily: MONO, color: TEXT, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>📋 REVIEW EXTRACTED DEALS</div>
            <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>
              {uploadSummary?.totalDeals} deals extracted from {uploadSummary?.totalFiles} file{(uploadSummary?.totalFiles ?? 0) > 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setStage("upload")}
              style={{ background: "none", border: `1px solid ${BORDER}`, color: TEXT2, padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
            >
              ← Re-upload
            </button>
            <button
              onClick={startProcessing}
              style={{ background: ACCENT, border: "none", color: "#000", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
            >
              ⚡ Run Council on All {uploadedDeals.length} Deals →
            </button>
          </div>
        </div>

        {/* Council breakdown */}
        {uploadSummary && (
          <div style={{ display: "flex", gap: 12 }}>
            {Object.entries(uploadSummary.councilBreakdown).filter(([, v]) => v > 0).map(([mode, count]) => (
              <div key={mode} style={{ background: BG3, border: `1px solid ${councilColor(mode)}33`, borderRadius: 8, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: councilColor(mode), fontWeight: 700, fontSize: 12 }}>{councilLabel(mode)}</span>
                <span style={{ color: TEXT2, fontSize: 12 }}>{count} deal{count > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}

        {/* Deal list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
          {uploadedDeals.map((deal, i) => (
            <div key={i} style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 11, color: MUTED, minWidth: 28, textAlign: "right" }}>#{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{deal.dealName}</div>
                <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>
                  {deal.fromZip ? `📦 ${deal.zipSource} → ` : "📄 "}{deal.sourceFile}
                  &nbsp;·&nbsp;{deal.dealText.length.toLocaleString()} chars
                </div>
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: `${councilColor(deal.councilMode)}22`,
                color: councilColor(deal.councilMode),
                border: `1px solid ${councilColor(deal.councilMode)}44`,
              }}>
                {councilLabel(deal.councilMode)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── STAGE: PROCESSING ────────────────────────────────────────────────────────
  if (stage === "processing") {
    const currentDeal = uploadedDeals[processingIndex];
    const agents = currentDeal ? (AGENTS_BY_MODE[currentDeal.councilMode] || AGENTS_BY_MODE.gcc) : AGENTS_BY_MODE.gcc;
    const currentDealResult = deals[processingIndex];
    const activeAgents = currentDealResult?.processingAgents || [];
    const completedCount = deals.filter(d => d.status === "completed" || d.status === "failed").length;
    const progressPct = Math.round((completedCount / deals.length) * 100);

    return (
      <div style={{ fontFamily: MONO, color: TEXT, display: "flex", flexDirection: "column", gap: 24, minHeight: "60vh" }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT, letterSpacing: 2, marginBottom: 8 }}>
            ⚡ COUNCIL PROCESSING
          </div>
          <div style={{ fontSize: 12, color: TEXT2 }}>
            Running {deals.length} deal{deals.length > 1 ? "s" : ""} through the 10-agent council
          </div>
        </div>

        {/* Overall progress bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: TEXT2, marginBottom: 6 }}>
            <span>Overall Progress</span>
            <span>{completedCount} / {deals.length} deals</span>
          </div>
          <div style={{ height: 6, background: BG3, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progressPct}%`, background: ACCENT, borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: ACCENT, marginTop: 4 }}>{progressPct}%</div>
        </div>

        {/* Current deal + animated agent grid */}
        {currentDeal && (
          <div style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ACCENT, animation: "pulse 1s infinite" }} />
              <div style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>{currentDeal.dealName}</div>
              <div style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 12, background: `${councilColor(currentDeal.councilMode)}22`, color: councilColor(currentDeal.councilMode), border: `1px solid ${councilColor(currentDeal.councilMode)}44` }}>
                {councilLabel(currentDeal.councilMode)} COUNCIL
              </div>
            </div>

            {/* Agent grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {agents.map((agent) => {
                const isActive = activeAgents.includes(agent.name);
                return (
                  <div
                    key={agent.id}
                    style={{
                      background: isActive ? `${ACCENT}15` : BG3,
                      border: `1px solid ${isActive ? ACCENT : BORDER}`,
                      borderRadius: 8,
                      padding: "10px 8px",
                      textAlign: "center",
                      transition: "all 0.3s ease",
                      opacity: isActive ? 1 : 0.4,
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{agent.icon}</div>
                    <div style={{ fontSize: 9, color: isActive ? TEXT : TEXT2, fontWeight: isActive ? 700 : 400, lineHeight: 1.3 }}>
                      {agent.name}
                    </div>
                    {isActive && (
                      <div style={{ fontSize: 8, color: ACCENT, marginTop: 3 }}>● ANALYSING</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Deal queue status */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
          {deals.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", background: BG2, borderRadius: 6, border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 12 }}>
                {d.status === "completed" ? "✅" : d.status === "failed" ? "❌" : d.status === "processing" ? "⚡" : "⏳"}
              </div>
              <div style={{ flex: 1, fontSize: 11, color: d.status === "processing" ? TEXT : TEXT2 }}>{d.dealName}</div>
              <div style={{ fontSize: 10, color: d.status === "completed" ? verdictColor(d.verdict) : TEXT2 }}>
                {d.status === "completed" ? verdictLabel(d.verdict) : d.status === "processing" ? "Processing…" : d.status === "failed" ? "Failed" : "Queued"}
              </div>
            </div>
          ))}
        </div>

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      </div>
    );
  }

  // ── STAGE: RESULTS ───────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: MONO, color: TEXT, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header + actions */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: ACCENT, letterSpacing: 1 }}>📊 DATA ROOM RESULTS</div>
          <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>
            {stats.completed} of {stats.total} deals screened
            {stats.failed > 0 && <span style={{ color: RED }}> · {stats.failed} failed</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleBulkDownload}
            disabled={isDownloadingZip || stats.completed === 0}
            style={{
              background: isDownloadingZip ? BG3 : GREEN,
              border: "none",
              color: isDownloadingZip ? TEXT2 : "#000",
              padding: "10px 20px",
              borderRadius: 8,
              cursor: isDownloadingZip ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isDownloadingZip ? "⏳ Generating…" : `📦 Download All IC Memos (${stats.completed} PDFs)`}
          </button>
          <button
            onClick={() => { setStage("upload"); setUploadedDeals([]); setDeals([]); }}
            style={{ background: "none", border: `1px solid ${BORDER}`, color: TEXT2, padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}
          >
            + New Batch
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {[
          { label: "Total", value: stats.total, color: ACCENT },
          { label: "Approved", value: stats.approved, color: GREEN },
          { label: "Conditional", value: stats.conditional, color: AMBER },
          { label: "Rejected", value: stats.rejected, color: RED },
          { label: "Failed", value: stats.failed, color: MUTED },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["all", "APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED", "VETOED"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterVerdict(f)}
            style={{
              background: filterVerdict === f ? (f === "all" ? ACCENT : verdictColor(f as VerdictType)) : BG3,
              border: `1px solid ${filterVerdict === f ? "transparent" : BORDER}`,
              color: filterVerdict === f ? (f === "all" ? "#000" : "#000") : TEXT2,
              padding: "5px 14px",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: filterVerdict === f ? 700 : 400,
            }}
          >
            {f === "all" ? `All (${stats.total})` :
             f === "APPROVED" ? `✅ Approved (${stats.approved})` :
             f === "APPROVED_WITH_CONDITIONS" ? `⚠️ Conditional (${stats.conditional})` :
             f === "REJECTED" ? `❌ Rejected (${deals.filter(d => d.verdict === "REJECTED").length})` :
             `🚫 Vetoed (${deals.filter(d => d.verdict === "VETOED").length})`}
          </button>
        ))}
      </div>

      {/* Deal summary cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {filteredDeals.map((deal) => (
          <div
            key={deal.index}
            style={{
              background: BG2,
              border: `1px solid ${deal.verdict ? verdictColor(deal.verdict) + "55" : BORDER}`,
              borderRadius: 12,
              padding: 18,
              cursor: deal.councilResult ? "pointer" : "default",
              transition: "all 0.2s",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={() => deal.councilResult && onDrillDown(deal.councilResult)}
            onMouseEnter={e => { if (deal.councilResult) (e.currentTarget as HTMLDivElement).style.borderColor = deal.verdict ? verdictColor(deal.verdict) : ACCENT; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = deal.verdict ? verdictColor(deal.verdict) + "55" : BORDER; }}
          >
            {/* Verdict accent bar */}
            {deal.verdict && (
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: verdictColor(deal.verdict), borderRadius: "12px 12px 0 0" }} />
            )}

            {/* Deal name + council badge */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: TEXT, fontWeight: 700, lineHeight: 1.4, flex: 1 }}>{deal.dealName}</div>
              <div style={{ fontSize: 9, padding: "3px 8px", borderRadius: 12, background: `${councilColor(deal.councilMode)}22`, color: councilColor(deal.councilMode), border: `1px solid ${councilColor(deal.councilMode)}44`, whiteSpace: "nowrap", flexShrink: 0 }}>
                {councilLabel(deal.councilMode)}
              </div>
            </div>

            {/* Status / Verdict */}
            <div style={{ marginBottom: 10 }}>
              {deal.status === "processing" && (
                <div style={{ fontSize: 12, color: ACCENT }}>⚡ Processing…</div>
              )}
              {deal.status === "pending" && (
                <div style={{ fontSize: 12, color: MUTED }}>⏳ Queued</div>
              )}
              {deal.status === "failed" && (
                <div>
                  <div style={{ fontSize: 12, color: RED, marginBottom: 8 }}>❌ {deal.error || "Screening failed"}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); retryDeal(deal.index); }}
                    style={{ fontSize: 10, padding: "4px 12px", background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, color: ACCENT, borderRadius: 5, cursor: "pointer" }}
                  >
                    🔄 Retry
                  </button>
                </div>
              )}
              {deal.status === "completed" && (
                <div style={{ fontSize: 14, fontWeight: 700, color: verdictColor(deal.verdict) }}>
                  {verdictLabel(deal.verdict)}
                </div>
              )}
            </div>

            {/* Yes / No vote count bar */}
            {deal.status === "completed" && (deal.yesCount !== undefined || deal.noCount !== undefined) && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: `${GREEN}18`, border: `1px solid ${GREEN}44`, borderRadius: 6, padding: "5px 0",
                }}>
                  <span style={{ fontSize: 14 }}>✅</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>{deal.yesCount ?? 0}</span>
                  <span style={{ fontSize: 9, color: TEXT2, fontWeight: 600 }}>YES</span>
                </div>
                <div style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: `${RED}18`, border: `1px solid ${RED}44`, borderRadius: 6, padding: "5px 0",
                }}>
                  <span style={{ fontSize: 14 }}>❌</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: RED }}>{deal.noCount ?? 0}</span>
                  <span style={{ fontSize: 9, color: TEXT2, fontWeight: 600 }}>NO</span>
                </div>
              </div>
            )}

            {/* Triage info */}
            {deal.triage && deal.triage.decision !== "PROCEED" && (
              <div style={{ fontSize: 10, color: AMBER, background: `${AMBER}15`, border: `1px solid ${AMBER}33`, borderRadius: 6, padding: "4px 8px", marginBottom: 8 }}>
                🔍 Triage: {deal.triage.decision} ({Math.round(deal.triage.confidence * 100)}%)
              </div>
            )}

            {/* IC Report indicator + CTA */}
            {deal.status === "completed" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <div style={{ fontSize: 10, color: deal.hasIcReport ? GREEN : MUTED }}>
                  {deal.hasIcReport ? "📄 IC Report ready" : "📄 No IC Report"}
                </div>
                {deal.councilResult && (
                  <div style={{ fontSize: 10, color: ACCENT, fontWeight: 600 }}>
                    View Full Report →
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredDeals.length === 0 && (
        <div style={{ textAlign: "center", color: MUTED, padding: 40, fontSize: 13 }}>
          No deals match the selected filter.
        </div>
      )}
    </div>
  );
}
