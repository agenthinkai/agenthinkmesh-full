/**
 * LegalRedline.tsx — LegalRedline Mesh landing page at /redline
 *
 * Full-stack contract audit tool:
 * 1. Hero header with CTA
 * 2. Upload dropzone (PDF, max 50MB)
 * 3. Demo trial mode (instant results without upload)
 * 4. Audit Results Dashboard:
 *    - Health Score Meter (0–100)
 *    - Summary counts: Critical / Warning / Clear
 *    - Clause table: Original | Persona | Risk | Benchmark | Redline
 *    - Export: PDF Proof Report & JSON Audit Trail
 * 5. Stripe $1,200 checkout for full audit unlock
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "wouter";

// ── Types ──────────────────────────────────────────────────────────────────────
interface AuditClause {
  id: number;
  clauseTitle: string;
  originalWording: string;
  persona: string;
  riskLevel: "CRITICAL" | "WARNING" | "CLEAR";
  riskRationale: string;
  marketBenchmark: string;
  redlineRewrite: string;
}

interface AuditResult {
  contractType: string;
  contractTitle: string;
  overallHealthScore: number;
  executiveSummary: string;
  criticalCount: number;
  warningCount: number;
  clearCount: number;
  clauses: AuditClause[];
}

interface AuditResponse {
  success: boolean;
  auditId: string;
  demo: boolean;
  result: AuditResult;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function riskBadge(level: string) {
  if (level === "CRITICAL") return "bg-red-500/20 text-red-400 border border-red-500/40";
  if (level === "WARNING")  return "bg-amber-500/20 text-amber-400 border border-amber-500/40";
  return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
}

function riskDot(level: string) {
  if (level === "CRITICAL") return "bg-red-500";
  if (level === "WARNING")  return "bg-amber-500";
  return "bg-emerald-500";
}

function scoreColour(score: number): string {
  if (score < 40) return "text-red-400";
  if (score < 70) return "text-amber-400";
  return "text-emerald-400";
}

function scoreRing(score: number): string {
  if (score < 40) return "stroke-red-500";
  if (score < 70) return "stroke-amber-500";
  return "stroke-emerald-500";
}

// ── Score Meter ────────────────────────────────────────────────────────────────
function ScoreMeter({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const gap = circ - dash;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140" className="rotate-[-90deg]">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          strokeWidth="12"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          className={`transition-all duration-1000 ${scoreRing(score)}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ marginTop: "-100px" }}>
        <span className={`text-4xl font-black ${scoreColour(score)}`}>{score}</span>
        <span className="text-xs text-slate-500 font-medium tracking-widest">/ 100</span>
      </div>
    </div>
  );
}

// ── Clause Row ─────────────────────────────────────────────────────────────────
function ClauseRow({ clause, expanded, onToggle }: {
  clause: AuditClause;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-800/40 hover:bg-slate-800/70 transition-colors">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${riskDot(clause.riskLevel)}`} />
        <span className="flex-1 font-semibold text-slate-200 text-sm">{clause.clauseTitle}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskBadge(clause.riskLevel)}`}>
          {clause.riskLevel}
        </span>
        <span className="text-slate-500 text-xs ml-2">{clause.persona}</span>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
          <div className="mt-3">
            <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">Original Wording</p>
            <p className="text-sm text-slate-400 italic bg-slate-900/50 rounded-lg px-3 py-2">
              &ldquo;{clause.originalWording}&rdquo;
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">Risk Rationale</p>
            <p className="text-sm text-slate-300">{clause.riskRationale}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">Market Benchmark</p>
            <p className="text-sm text-slate-400">{clause.marketBenchmark}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">AI Redline Rewrite</p>
            <p className="text-sm text-emerald-300 bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2">
              {clause.redlineRewrite}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LegalRedline() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Extracting contract text…");
  const [auditId, setAuditId] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedClauses, setExpandedClauses] = useState<Set<number>>(new Set());
  const [filterRisk, setFilterRisk] = useState<"ALL" | "CRITICAL" | "WARNING" | "CLEAR">("ALL");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Check for paid=1 in URL on mount (Stripe redirect back)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      const aid = params.get("auditId");
      if (aid) setAuditId(aid);
      // Clean URL
      window.history.replaceState({}, "", "/redline");
    }
  }, []);

  // Loading message rotation
  useEffect(() => {
    if (!loading) return;
    const msgs = [
      "Extracting contract text…",
      "Identifying material clauses…",
      "Benchmarking against market standards…",
      "Generating AI redline rewrites…",
      "Calculating risk score…",
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % msgs.length;
      setLoadingMsg(msgs[i]);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
      setError(null);
    } else {
      setError("Only PDF files are accepted.");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(null); }
  };

  const runAudit = async (demo = false) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAuditId(null);
    setExpandedClauses(new Set());

    try {
      let response: Response;
      if (demo) {
        response = await fetch("/api/audit-contract?demo=true", { method: "POST" });
      } else {
        if (!file) { setError("Please upload a PDF first."); setLoading(false); return; }
        const formData = new FormData();
        formData.append("pdf", file);
        response = await fetch("/api/audit-contract", { method: "POST", body: formData });
      }

      const data: AuditResponse = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error ?? "Audit failed. Please try again.");
        setLoading(false);
        return;
      }

      setAuditId(data.auditId);
      setResult(data.result);
      setIsDemo(data.demo);

      // Expand all CRITICAL clauses by default
      const criticalIds = new Set(
        data.result.clauses
          .filter((c) => c.riskLevel === "CRITICAL")
          .map((c) => c.id)
      );
      setExpandedClauses(criticalIds);

      // Scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleClause = (id: number) => {
    setExpandedClauses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    if (!result) return;
    setExpandedClauses(new Set(result.clauses.map((c) => c.id)));
  };

  const collapseAll = () => setExpandedClauses(new Set());

  const filteredClauses = result?.clauses.filter(
    (c) => filterRisk === "ALL" || c.riskLevel === filterRisk
  ) ?? [];

  const handleExportPdf = async () => {
    if (!auditId) return;
    setExportingPdf(true);
    try {
      const res = await fetch(`/api/redline/export-pdf/${auditId}`);
      if (!res.ok) { setError("PDF export failed."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LegalRedline-ProofReport-${auditId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("PDF export failed.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportJson = async () => {
    if (!auditId) return;
    try {
      const res = await fetch(`/api/redline/export-json/${auditId}`);
      if (!res.ok) { setError("JSON export failed."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LegalRedline-AuditTrail-${auditId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("JSON export failed.");
    }
  };

  const handleStripeCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/redline/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditId: auditId ?? "",
          origin: `${window.location.origin}/redline`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Could not start checkout. Please try again.");
      }
    } catch {
      setError("Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sky-400 font-black text-lg tracking-tight">AgenThinkMesh</span>
            <span className="text-slate-600 text-sm hidden sm:inline">/ LegalRedline</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI Audit Engine Live
            </span>
            <button
              onClick={() => runAudit(true)}
              disabled={loading}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-400/50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              Try Demo
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-950/30 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-20 sm:pb-16">
          <div className="flex items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-1 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              LegalRedline Mesh — Powered by AgenThinkMesh AI
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight max-w-3xl">
            Audit M&amp;A Contracts &amp; SPAs{" "}
            <span className="text-sky-400">in 2 Minutes</span>
            <br className="hidden sm:block" />
            <span className="text-slate-300"> — Spot Off-Market Terms Before You Sign</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Upload any Share Purchase Agreement, Shareholders&apos; Agreement, or Commercial Lease.
            Our AI audits every material clause against institutional benchmarks, flags critical risks,
            and generates specific redline rewrites — in under 2 minutes.
          </p>

          {/* Trust signals */}
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
            {[
              "SPA / SHA / Commercial Lease",
              "Clause-by-clause analysis",
              "BVCA & ABA benchmarks",
              "AI redline rewrites",
              "PDF proof report",
            ].map((tag) => (
              <span key={tag} className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Upload Zone ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Dropzone */}
          <div className="lg:col-span-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-8 sm:p-12 flex flex-col items-center justify-center gap-4 min-h-[220px] ${
                dragging
                  ? "border-sky-400 bg-sky-500/10"
                  : file
                  ? "border-emerald-500/60 bg-emerald-950/20"
                  : "border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {file ? (
                <>
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-emerald-400">{file.name}</p>
                    <p className="text-sm text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
                  </div>
                  <p className="text-xs text-slate-600">Click to change file</p>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-xl bg-slate-700/60 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-300">Upload SPA, SHA, or Lease PDF</p>
                    <p className="text-sm text-slate-500 mt-1">Drag &amp; drop or click to browse · Max 50 MB</p>
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              onClick={() => runAudit(false)}
              disabled={!file || loading}
              className="mt-4 w-full py-3.5 rounded-xl font-bold text-sm bg-sky-500 hover:bg-sky-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {loadingMsg}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Run Full AI Audit
                </>
              )}
            </button>
          </div>

          {/* Pricing card */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Free demo */}
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-slate-300">Demo Trial</span>
                <span className="text-lg font-black text-emerald-400">Free</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-500 mb-4">
                {["10-clause sample audit", "Risk score preview", "3 AI redline examples", "No upload required"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => runAudit(true)}
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/30 transition-all disabled:opacity-40"
              >
                Run Free Demo
              </button>
            </div>

            {/* Full audit */}
            <div className="rounded-2xl border border-sky-500/40 bg-sky-950/20 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-300">Full Contract Audit</span>
                <span className="text-2xl font-black text-sky-400">$1,200</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">One-time · per contract</p>
              <ul className="space-y-1.5 text-xs text-slate-400 mb-4">
                {[
                  "Full clause-by-clause analysis",
                  "Up to 25 flagged clauses",
                  "BVCA / ABA benchmark citations",
                  "AI redline rewrites for every risk",
                  "PDF Proof Report download",
                  "Clean JSON Audit Trail",
                  "Unlimited re-exports",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleStripeCheckout}
                disabled={checkoutLoading}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {checkoutLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                )}
                Unlock Full Audit — $1,200
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Audit Results Dashboard ── */}
      {result && (
        <section ref={resultsRef} className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
          {/* Demo banner */}
          {isDemo && (
            <div className="flex items-center gap-3 bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-300">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>Demo mode</strong> — showing a sample SPA audit. Upload your own PDF for a real analysis.
              </span>
            </div>
          )}

          {/* Score + Summary row */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Health score */}
            <div className="sm:col-span-2 lg:col-span-1 bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 flex flex-col items-center gap-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contract Health</p>
              <div className="relative flex items-center justify-center w-36 h-36">
                <ScoreMeter score={result.overallHealthScore} />
                <div className="absolute flex flex-col items-center">
                  <span className={`text-4xl font-black ${scoreColour(result.overallHealthScore)}`}>
                    {result.overallHealthScore}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">/ 100</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center">
                {result.overallHealthScore < 40 ? "High Risk — Do Not Sign" :
                 result.overallHealthScore < 70 ? "Moderate Risk — Negotiate" :
                 "Buyer-Favourable"}
              </p>
            </div>

            {/* Risk counts */}
            {[
              { label: "Critical Risks", count: result.criticalCount, colour: "text-red-400", bg: "bg-red-950/30 border-red-800/40", dot: "bg-red-500" },
              { label: "Warnings", count: result.warningCount, colour: "text-amber-400", bg: "bg-amber-950/30 border-amber-800/40", dot: "bg-amber-500" },
              { label: "Clear / Passed", count: result.clearCount, colour: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-800/40", dot: "bg-emerald-500" },
            ].map((item) => (
              <div key={item.label} className={`${item.bg} border rounded-2xl p-5 flex flex-col items-center justify-center gap-1`}>
                <span className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                <span className={`text-4xl font-black ${item.colour}`}>{item.count}</span>
                <span className="text-xs text-slate-500 font-medium text-center">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Contract info + executive summary */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h2 className="text-lg font-bold text-white">{result.contractTitle}</h2>
              <span className="text-xs font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
                {result.contractType}
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{result.executiveSummary}</p>
          </div>

          {/* Clause table */}
          <div className="bg-slate-800/30 border border-slate-700/60 rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-200">Clause Analysis</h3>
                <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                  {filteredClauses.length} clause{filteredClauses.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Filter buttons */}
                {(["ALL", "CRITICAL", "WARNING", "CLEAR"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterRisk(f)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-all ${
                      filterRisk === f
                        ? "bg-sky-500 text-white"
                        : "text-slate-500 hover:text-slate-300 border border-slate-700/60"
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <button onClick={expandAll} className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1">
                  Expand all
                </button>
                <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1">
                  Collapse
                </button>
              </div>
            </div>

            {/* Clause list */}
            <div className="p-4 space-y-2">
              {filteredClauses.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No clauses match this filter.</p>
              ) : (
                filteredClauses.map((clause) => (
                  <ClauseRow
                    key={clause.id}
                    clause={clause}
                    expanded={expandedClauses.has(clause.id)}
                    onToggle={() => toggleClause(clause.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-700/60 hover:bg-slate-700 border border-slate-600/60 text-slate-200 transition-all disabled:opacity-40"
            >
              {exportingPdf ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Download PDF Proof Report
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-700/60 hover:bg-slate-700 border border-slate-600/60 text-slate-200 transition-all"
            >
              <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download JSON Audit Trail
            </button>

            <button
              onClick={handleStripeCheckout}
              disabled={checkoutLoading}
              className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Unlock Full Audit — $1,200
            </button>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800/60 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <span>© {new Date().getFullYear()} AgenThinkMesh · LegalRedline Mesh</span>
          <span>AI-generated analysis is for informational purposes only and does not constitute legal advice.</span>
        </div>
      </footer>
    </div>
  );
}
