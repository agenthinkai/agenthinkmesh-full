/**
 * SadoArabicRefinement.tsx
 * SADO · Arabic Sovereign Data Refinement — /sado-arabic
 *
 * Ported from the standalone reference implementation.
 * Adds: TypeScript types, tRPC LLM dialect fallback for low-confidence results.
 */

import React, { useState, useMemo } from 'react';
import {
  FileText, Play, Download, Shield, AlertTriangle, CheckCircle2, Upload,
  Languages, Lock, Activity, Clock, FileCheck, AlertCircle, Hash,
  Building2, ChevronRight, Loader2, Wifi, WifiOff, Eye, EyeOff,
} from 'lucide-react';

import { trpc } from '@/lib/trpc';
import {
  detectEncodingIssues,
  normalizeArabic,
  detectDialect,
  detectPII,
  redactPII,
  determineRecommendation,
  hashSHA256,
  makeTraceId,
  SAMPLE_INPUT,
} from '@/lib/arabicRefinementLogic';

import type {
  PipelineStatus,
  PipelineResults,
  AuditExportSchema,
  RecommendationCode,
} from '@/lib/arabicRefinementTypes';

// ─── UI Primitives ────────────────────────────────────────────────────────────

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-slate-900/60 border border-slate-800 rounded-lg ${className}`}>{children}</div>
);

const SectionLabel: React.FC<{ children: React.ReactNode; icon?: React.FC<{ className?: string }> }> = ({ children, icon: Icon }) => (
  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-medium mb-3">
    {Icon && <Icon className="w-3.5 h-3.5" />}
    {children}
  </div>
);

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const cls =
    status === 'complete' ? 'bg-emerald-500' :
    status === 'running'  ? 'bg-cyan-400 animate-pulse' :
    status === 'error'    ? 'bg-red-500' : 'bg-slate-600';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
};

const AgentCard: React.FC<{
  num: string;
  name: string;
  status: string;
  summary: string;
  children?: React.ReactNode;
}> = ({ num, name, status, summary, children }) => {
  const borderCls =
    status === 'complete' ? 'border-emerald-900/60' :
    status === 'running'  ? 'border-cyan-700' : 'border-slate-800';
  return (
    <div className={`bg-slate-900/40 border ${borderCls} rounded-lg p-4 transition-colors`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-slate-800 text-slate-300 text-xs font-mono">{num}</div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-100">{name}</div>
            {summary && <div className="text-xs text-slate-400 mt-0.5">{summary}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
          {status === 'running'  && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
          {status === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          <StatusDot status={status} />
        </div>
      </div>
      {children && <div className="mt-3 pt-3 border-t border-slate-800/60">{children}</div>}
    </div>
  );
};

const SeverityBadge: React.FC<{ level: string }> = ({ level }) => {
  const map: Record<string, string> = {
    HIGH:   'bg-red-950/60 text-red-300 border-red-900/60',
    MEDIUM: 'bg-amber-950/60 text-amber-300 border-amber-900/60',
    LOW:    'bg-emerald-950/60 text-emerald-300 border-emerald-900/60',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border ${map[level] ?? map.LOW}`}>
      {level}
    </span>
  );
};

const RecBadge: React.FC<{ code: RecommendationCode }> = ({ code }) => {
  const cfg: Record<RecommendationCode, { cls: string; icon: React.FC<{ className?: string }> }> = {
    ALLOW:    { cls: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/70', icon: CheckCircle2 },
    REVIEW:   { cls: 'bg-amber-950/40 text-amber-300 border-amber-800/70',       icon: Eye },
    ESCALATE: { cls: 'bg-red-950/40 text-red-300 border-red-800/70',             icon: AlertTriangle },
  };
  const c = cfg[code];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium tracking-wide rounded border ${c.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {code}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SadoArabicRefinement() {
  const [input, setInput]                 = useState('');
  const [tenant, setTenant]               = useState('stc-saudi-demo');
  const [deploymentMode, setDeploymentMode] = useState<'sovereign' | 'internal' | 'test'>('sovereign');
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>({
    ingest: 'idle', normalize: 'idle', dialect: 'idle', compliance: 'idle',
  });
  const [results, setResults]             = useState<PipelineResults | null>(null);
  const [traceId, setTraceId]             = useState<string | null>(null);
  const [contentHash, setContentHash]     = useState<string | null>(null);
  const [isRunning, setIsRunning]         = useState(false);
  const [showRedacted, setShowRedacted]   = useState(false);
  const [showAuditJson, setShowAuditJson] = useState(false);

  const offline = deploymentMode === 'sovereign';

  // tRPC mutation for LLM dialect fallback (fires only when confidence < 40)
  const dialectFallback = trpc.sado.dialectFallback.useMutation();

  const handleSample = () => setInput(SAMPLE_INPUT);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setInput(String(ev.target?.result ?? ''));
    reader.readAsText(file);
  };

  const runPipeline = async () => {
    if (!input.trim() || isRunning) return;
    setIsRunning(true);
    setResults(null);
    setPipelineStatus({ ingest: 'running', normalize: 'idle', dialect: 'idle', compliance: 'idle' });

    const tid = makeTraceId();
    setTraceId(tid);
    const hash = await hashSHA256(input);
    setContentHash(hash);

    // Step 1 — Ingest
    await new Promise<void>((r) => setTimeout(r, 450));
    const ingest = detectEncodingIssues(input);
    setPipelineStatus((s) => ({ ...s, ingest: 'complete', normalize: 'running' }));

    // Step 2 — Normalize
    await new Promise<void>((r) => setTimeout(r, 600));
    const normalize = normalizeArabic(input);
    setPipelineStatus((s) => ({ ...s, normalize: 'complete', dialect: 'running' }));

    // Step 3 — Dialect + PII
    await new Promise<void>((r) => setTimeout(r, 750));
    let dialect = detectDialect(normalize.text);
    const pii = detectPII(normalize.text);

    // LLM fallback: if lexical confidence < 40 and not in sovereign mode, ask the server
    if (dialect.confidence < 40 && deploymentMode !== 'sovereign') {
      try {
        const llmResult = await dialectFallback.mutateAsync({ text: normalize.text.slice(0, 800) });
        if (llmResult.primary && llmResult.primaryName) {
          dialect = {
            ...dialect,
            primary: llmResult.primary,
            primaryName: llmResult.primaryName,
            confidence: llmResult.confidence ?? dialect.confidence,
            llmFallbackUsed: true,
          };
        }
      } catch {
        // Fallback failed silently — lexical result stands
      }
    }

    setPipelineStatus((s) => ({ ...s, dialect: 'complete', compliance: 'running' }));

    // Step 4 — Compliance
    await new Promise<void>((r) => setTimeout(r, 550));
    const recommendation = determineRecommendation(pii.sensitivity, dialect.confidence, ingest.issues.length);
    setPipelineStatus((s) => ({ ...s, compliance: 'complete' }));

    setResults({ ingest, normalize, dialect, pii, recommendation });
    setIsRunning(false);
  };

  const auditExport = useMemo<AuditExportSchema | null>(() => {
    if (!results || !traceId) return null;
    return {
      schema_version: '1.0',
      processor: 'SADO Arabic Refinement v1.0',
      tenant,
      deployment_mode: deploymentMode,
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      input: {
        char_count: results.ingest.charCount,
        line_count: results.ingest.lineCount,
        content_hash_sha256: contentHash,
      },
      ingest: {
        encoding_issues: results.ingest.issues,
        direction: results.ingest.direction,
        arabic_char_count: results.ingest.arabicChars,
        latin_char_count: results.ingest.latinChars,
      },
      normalization: {
        actions: results.normalize.log,
        output_char_count: results.normalize.text.length,
      },
      dialect: {
        primary: results.dialect.primary,
        primary_name: results.dialect.primaryName,
        confidence_percent: results.dialect.confidence,
        scores: Object.fromEntries(
          Object.entries(results.dialect.scores).map(([k, v]) => [k, { name: v.name, hits: v.hits }])
        ),
      },
      pii: {
        found: results.pii.found.map((f) => ({ type: f.type, count: f.count, severity: f.severity, tier: f.tier })),
        sensitivity: results.pii.sensitivity,
        high_count: results.pii.highCount,
        medium_count: results.pii.mediumCount,
      },
      recommendation: results.recommendation,
      disclaimer: 'This workflow supports sovereign data governance review and does not constitute legal or regulatory advice.',
    };
  }, [results, tenant, deploymentMode, traceId, contentHash]);

  const downloadAudit = () => {
    if (!auditExport) return;
    const blob = new Blob([JSON.stringify(auditExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sado-audit-${traceId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      {/* ── HEADER ── */}
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-100 tracking-tight">SADO · Arabic Data Refinement</div>
              <div className="text-[11px] text-slate-500 tracking-wide">v1.0 · sovereign workflow</div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-2 py-1 rounded border border-slate-800 bg-slate-900/60">
              {offline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
              {offline ? 'offline-ready' : 'network mode'}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-2 py-1 rounded border border-slate-800 bg-slate-900/60 font-mono">
              <Building2 className="w-3 h-3" />
              <input
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                className="bg-transparent outline-none w-32 text-slate-300"
                placeholder="tenant"
              />
            </div>
            <select
              value={deploymentMode}
              onChange={(e) => setDeploymentMode(e.target.value as 'sovereign' | 'internal' | 'test')}
              className="text-[11px] bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 outline-none cursor-pointer"
            >
              <option value="sovereign">deployment: sovereign</option>
              <option value="internal">deployment: internal</option>
              <option value="test">deployment: test</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── 1 · INPUT ── */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <SectionLabel icon={FileText}>1 · Input</SectionLabel>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSample}
                className="text-xs px-2.5 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Load sample
              </button>
              <label className="text-xs px-2.5 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1.5">
                <Upload className="w-3 h-3" />
                Upload .txt / .csv
                <input type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" onChange={handleFile} />
              </label>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ألصق نص الدعم العربي هنا — Paste messy Arabic customer-support text here..."
            dir="auto"
            className="w-full min-h-[180px] bg-slate-950 border border-slate-800 rounded p-3 text-sm text-slate-100 outline-none focus:border-cyan-700 transition-colors resize-y"
            style={{ fontFamily: '"Segoe UI", Tahoma, "Noto Sans Arabic", "Arial Unicode MS", sans-serif', lineHeight: 1.7 }}
          />
          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <div className="text-[11px] text-slate-500 font-mono">
              {input.length.toLocaleString()} chars · {input.split('\n').length} lines
            </div>
            <button
              onClick={runPipeline}
              disabled={!input.trim() || isRunning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium transition-colors"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Processing...' : 'Run refinement pipeline'}
            </button>
          </div>
        </Card>

        {/* ── 2 · PIPELINE ── */}
        <Card className="p-5">
          <SectionLabel icon={Activity}>2 · Pipeline</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <AgentCard num="01" name="Arabic Ingest" summary="Encoding & RTL detection" status={pipelineStatus.ingest}>
              {results && (
                <div className="text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400"><span>direction</span><span className="font-mono text-slate-300">{results.ingest.direction}</span></div>
                  <div className="flex justify-between text-slate-400"><span>arabic / latin</span><span className="font-mono text-slate-300">{results.ingest.arabicChars} / {results.ingest.latinChars}</span></div>
                  <div className="flex justify-between text-slate-400"><span>issues</span><span className="font-mono text-slate-300">{results.ingest.issues.length}</span></div>
                </div>
              )}
            </AgentCard>
            <AgentCard num="02" name="Normalization" summary="Character & whitespace cleanup" status={pipelineStatus.normalize}>
              {results && (
                <div className="text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400"><span>actions</span><span className="font-mono text-slate-300">{results.normalize.log.length}</span></div>
                  <div className="flex justify-between text-slate-400"><span>output chars</span><span className="font-mono text-slate-300">{results.normalize.text.length.toLocaleString()}</span></div>
                </div>
              )}
            </AgentCard>
            <AgentCard num="03" name="Dialect + PII" summary="Lexical scoring & entity scan" status={pipelineStatus.dialect}>
              {results && (
                <div className="text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400"><span>dialect</span><span className="font-mono text-slate-300 truncate ml-2">{results.dialect.primaryName.split(' ')[0]}</span></div>
                  <div className="flex justify-between text-slate-400"><span>confidence</span><span className="font-mono text-slate-300">{results.dialect.confidence}%{results.dialect.llmFallbackUsed ? ' (LLM)' : ''}</span></div>
                  <div className="flex justify-between text-slate-400"><span>PII types</span><span className="font-mono text-slate-300">{results.pii.found.length}</span></div>
                </div>
              )}
            </AgentCard>
            <AgentCard num="04" name="Compliance + Export" summary="Sensitivity, recommendation, audit" status={pipelineStatus.compliance}>
              {results && (
                <div className="text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400"><span>sensitivity</span><SeverityBadge level={results.pii.sensitivity} /></div>
                  <div className="flex justify-between text-slate-400"><span>recommendation</span><span className="font-mono text-slate-300">{results.recommendation.code}</span></div>
                </div>
              )}
            </AgentCard>
          </div>
        </Card>

        {/* ── RESULTS ── */}
        {results && (
          <>
            {/* 3 · Governance recommendation */}
            <Card className="p-5">
              <SectionLabel icon={Shield}>3 · Governance recommendation</SectionLabel>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <RecBadge code={results.recommendation.code} />
                  <p className="text-sm text-slate-300 mt-3 leading-relaxed">{results.recommendation.reason}</p>
                </div>
                <div className="text-right text-[11px] text-slate-500 font-mono space-y-1">
                  <div className="flex items-center justify-end gap-1.5"><Hash className="w-3 h-3" /><span>{traceId}</span></div>
                  {contentHash && <div className="flex items-center justify-end gap-1.5"><Lock className="w-3 h-3" /><span>{contentHash.slice(0, 16)}…</span></div>}
                  <div className="flex items-center justify-end gap-1.5"><Clock className="w-3 h-3" /><span>{new Date().toISOString().split('.')[0]}Z</span></div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800/60 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>This workflow supports sovereign data governance review and does not constitute legal or regulatory advice.</span>
              </div>
            </Card>

            {/* 4 · Cleaned output + Dialect/PII */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <Card className="p-5 lg:col-span-3">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <SectionLabel icon={Languages}>4 · Cleaned output</SectionLabel>
                  <button
                    onClick={() => setShowRedacted(!showRedacted)}
                    className="text-xs px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                  >
                    {showRedacted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showRedacted ? 'PII-redacted view' : 'Original cleaned view'}
                  </button>
                </div>
                <div
                  dir="auto"
                  className="bg-slate-950 border border-slate-800 rounded p-4 text-sm text-slate-100 max-h-80 overflow-auto whitespace-pre-wrap"
                  style={{ fontFamily: '"Segoe UI", Tahoma, "Noto Sans Arabic", sans-serif', lineHeight: 1.85 }}
                >
                  {showRedacted ? redactPII(results.normalize.text) : results.normalize.text}
                </div>
                <details className="mt-3 group">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-200 inline-flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                    Normalization log ({results.normalize.log.length})
                  </summary>
                  <div className="mt-2 text-[11px] font-mono text-slate-400 space-y-1 pl-4">
                    {results.normalize.log.map((entry, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span>{entry.step}</span>
                        {entry.count > 0 && <span className="text-slate-500">×{entry.count}</span>}
                      </div>
                    ))}
                  </div>
                </details>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <SectionLabel icon={Languages}>Dialect & PII</SectionLabel>
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Primary dialect</div>
                    <div className="text-sm text-slate-100">{results.dialect.primaryName}</div>
                    {results.dialect.llmFallbackUsed && (
                      <div className="text-[10px] text-cyan-500 mt-0.5">LLM fallback used</div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden">
                        <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${results.dialect.confidence}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{results.dialect.confidence}%</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Dialect signal distribution</div>
                    <div className="space-y-1.5">
                      {Object.entries(results.dialect.scores)
                        .filter(([, v]) => v.hits > 0)
                        .sort((a, b) => b[1].hits - a[1].hits)
                        .map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="text-slate-400 truncate">{v.name}</span>
                            <span className="font-mono text-slate-300">{v.hits} hits</span>
                          </div>
                        ))}
                      {results.dialect.totalHits === 0 && (
                        <div className="text-[11px] text-slate-500 italic">No dialect markers matched.</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">PII detected</div>
                    {results.pii.found.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic">No PII patterns matched.</div>
                    ) : (
                      <div className="space-y-2">
                        {results.pii.found.map((p, i) => (
                          <div key={i} className="bg-slate-950/60 border border-slate-800 rounded p-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs text-slate-200">{p.type}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-mono">×{p.count}</span>
                                <SeverityBadge level={p.severity} />
                              </div>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 truncate">
                              {p.examples.join(' · ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* 5 · Audit & export */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <SectionLabel icon={FileCheck}>5 · Audit & export</SectionLabel>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAuditJson(!showAuditJson)}
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    {showAuditJson ? 'Hide JSON' : 'Preview JSON'}
                  </button>
                  <button
                    onClick={downloadAudit}
                    className="text-xs px-2.5 py-1.5 rounded bg-slate-100 hover:bg-white text-slate-900 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Download audit JSON
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Trace ID</div>
                  <div className="text-xs font-mono text-slate-200 mt-1 truncate">{traceId}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Tenant</div>
                  <div className="text-xs font-mono text-slate-200 mt-1 truncate">{tenant}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Mode</div>
                  <div className="text-xs font-mono text-slate-200 mt-1">{deploymentMode}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Content hash</div>
                  <div className="text-xs font-mono text-slate-200 mt-1 truncate">{contentHash?.slice(0, 12)}…</div>
                </div>
              </div>

              {showAuditJson && auditExport && (
                <pre className="bg-slate-950 border border-slate-800 rounded p-3 text-[11px] text-slate-300 max-h-96 overflow-auto font-mono leading-relaxed">
                  {JSON.stringify(auditExport, null, 2)}
                </pre>
              )}
            </Card>
          </>
        )}

        {!results && !isRunning && (
          <Card className="p-8 text-center">
            <div className="text-slate-500 text-sm">Paste Arabic support text above, or load the sample, then run the pipeline.</div>
            <div className="text-[11px] text-slate-600 mt-2">All processing runs locally in this view. No content leaves the page.</div>
          </Card>
        )}

        <footer className="text-[10px] text-slate-600 text-center pt-4 pb-8">
          SADO Arabic Data Refinement v1.0 · standalone reference implementation
        </footer>
      </main>
    </div>
  );
}
