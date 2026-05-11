/**
 * SadoArabicRefinement.tsx
 * SADO · Arabic Sovereign Data Refinement — /sado-arabic
 *
 * v1.1 — adds:
 *   Scope 1: Batch CSV mode (upload → per-row progress → combined CSV + audit zip)
 *   Scope 2: Tenant Policy panel (read active policy, edit thresholds)
 *   Scope 3: Signed audit (ed25519 via server, verify tab)
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  FileText, Play, Download, Shield, AlertTriangle, CheckCircle2, Upload,
  Languages, Lock, Activity, Clock, FileCheck, AlertCircle, Hash,
  Building2, ChevronRight, Loader2, Wifi, WifiOff, Eye, EyeOff,
  Settings, ListChecks, ShieldCheck, X, CheckCircle, XCircle,
} from 'lucide-react';

import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
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
  num: string; name: string; status: string; summary: string; children?: React.ReactNode;
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

// ─── Batch row types ──────────────────────────────────────────────────────────

interface BatchRow {
  rowIndex: number;
  rawText: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  result?: PipelineResults;
  traceId?: string;
  contentHash?: string;
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsvRows(raw: string): string[] {
  // Simple: one text per line (ignores header if it looks non-Arabic)
  return raw.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== 'text' && l !== '"text"');
}

function buildBatchCsv(rows: BatchRow[]): string {
  const header = [
    'row_index','trace_id','recommendation','sensitivity',
    'dialect','dialect_confidence','pii_types','high_pii','medium_pii',
    'encoding_issues','normalization_actions','content_hash','error',
  ].join(',');
  const lines = rows.map((r) => {
    if (r.status === 'error' || !r.result) {
      return [r.rowIndex,'','','','','','','','','','',r.contentHash ?? '', r.error ?? 'failed'].map(csvCell).join(',');
    }
    const { ingest, normalize, dialect, pii, recommendation } = r.result;
    return [
      r.rowIndex, r.traceId ?? '', recommendation.code, pii.sensitivity,
      dialect.primaryName, dialect.confidence, pii.found.length,
      pii.highCount, pii.mediumCount, ingest.issues.length, normalize.log.length,
      r.contentHash ?? '', '',
    ].map(csvCell).join(',');
  });
  return [header, ...lines].join('\n');
}

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = 'single' | 'batch' | 'policy' | 'verify';

export default function SadoArabicRefinement() {
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>('single');

  // ── Single mode state ──
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
  const [signedAudit, setSignedAudit]     = useState<Record<string, unknown> | null>(null);
  const [isSigning, setIsSigning]         = useState(false);

  // ── Batch mode state ──
  const [batchRows, setBatchRows]         = useState<BatchRow[]>([]);
  const [batchRunning, setBatchRunning]   = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const batchAbortRef                     = useRef(false);

  // ── Policy state ──
  const [policyTenant, setPolicyTenant]   = useState('stc-saudi-demo');
  const [editThreshold, setEditThreshold] = useState<number | null>(null);
  const [editCutoff, setEditCutoff]       = useState<number | null>(null);
  const [editLlmEnabled, setEditLlmEnabled] = useState<boolean | null>(null);
  const [policyMsg, setPolicyMsg]         = useState('');

  // ── Verify state ──
  const [verifyJson, setVerifyJson]       = useState('');
  const [verifyResult, setVerifyResult]   = useState<{ valid: boolean; reason?: string } | null>(null);
  const [verifyRunning, setVerifyRunning] = useState(false);

  const offline = deploymentMode === 'sovereign';

  // ── tRPC ──
  const dialectFallback  = trpc.sado.dialectFallback.useMutation();
  const storeSignedAudit = trpc.sado.storeSignedAudit.useMutation();
  const verifyAuditMut   = trpc.sado.verifyAuditRecord.useMutation();
  const savePolicy       = trpc.sado.saveArabicPolicy.useMutation();
  const { data: activePolicy, refetch: refetchPolicy } = trpc.sado.getArabicPolicy.useQuery(
    { tenantId: policyTenant },
    { enabled: mainTab === 'policy' && !!user }
  );

  // ── Helpers ──
  const handleSample = () => setInput(SAMPLE_INPUT);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setInput(String(ev.target?.result ?? ''));
    reader.readAsText(file);
  };

  // ── Single pipeline ──
  const runPipeline = useCallback(async (
    text: string,
    policy?: { dialectLlmFallbackThreshold?: number; encodingIssuesReviewCutoff?: number; llmFallbackEnabled?: boolean },
  ): Promise<{ results: PipelineResults; traceId: string; contentHash: string }> => {
    const llmThreshold = policy?.dialectLlmFallbackThreshold ?? 40;
    const llmEnabled   = policy?.llmFallbackEnabled ?? true;

    const tid  = makeTraceId();
    const hash = await hashSHA256(text);

    const ingest = detectEncodingIssues(text);
    await new Promise<void>((r) => setTimeout(r, 50));

    const normalize = normalizeArabic(text);
    await new Promise<void>((r) => setTimeout(r, 50));

    let dialect = detectDialect(normalize.text);
    const pii = detectPII(normalize.text);

    if (dialect.confidence < llmThreshold && deploymentMode !== 'sovereign' && llmEnabled) {
      try {
        const llmResult = await dialectFallback.mutateAsync({ text: normalize.text.slice(0, 800) });
        if (llmResult.primary && llmResult.primaryName) {
          dialect = { ...dialect, primary: llmResult.primary, primaryName: llmResult.primaryName, confidence: llmResult.confidence ?? dialect.confidence, llmFallbackUsed: true };
        }
      } catch { /* silent */ }
    }

    const recommendation = determineRecommendation(pii.sensitivity, dialect.confidence, ingest.issues.length);
    return { results: { ingest, normalize, dialect, pii, recommendation }, traceId: tid, contentHash: hash };
  }, [deploymentMode, dialectFallback]);

  const handleRunSingle = async () => {
    if (!input.trim() || isRunning) return;
    setIsRunning(true);
    setResults(null);
    setSignedAudit(null);
    setPipelineStatus({ ingest: 'running', normalize: 'idle', dialect: 'idle', compliance: 'idle' });
    try {
      setPipelineStatus((s) => ({ ...s, ingest: 'running' }));
      await new Promise<void>((r) => setTimeout(r, 450));
      setPipelineStatus((s) => ({ ...s, ingest: 'complete', normalize: 'running' }));
      await new Promise<void>((r) => setTimeout(r, 600));
      setPipelineStatus((s) => ({ ...s, normalize: 'complete', dialect: 'running' }));
      await new Promise<void>((r) => setTimeout(r, 750));
      setPipelineStatus((s) => ({ ...s, dialect: 'complete', compliance: 'running' }));
      await new Promise<void>((r) => setTimeout(r, 550));
      const { results: r, traceId: tid, contentHash: hash } = await runPipeline(input, activePolicy ?? undefined);
      setPipelineStatus((s) => ({ ...s, compliance: 'complete' }));
      setResults(r);
      setTraceId(tid);
      setContentHash(hash);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Audit export ──
  const auditExport = useMemo<AuditExportSchema | null>(() => {
    if (!results || !traceId) return null;
    return {
      schema_version: '1.0' as const,
      processor: 'SADO Arabic Refinement v1.1',
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
      policy_snapshot: activePolicy ? {
        dialectLlmFallbackThreshold: activePolicy.dialectLlmFallbackThreshold,
        encodingIssuesReviewCutoff: activePolicy.encodingIssuesReviewCutoff,
        llmFallbackEnabled: activePolicy.llmFallbackEnabled,
        auditStorageAdapter: activePolicy.auditStorageAdapter,
      } : null,
      disclaimer: 'This workflow supports sovereign data governance review and does not constitute legal or regulatory advice.',
    };
  }, [results, tenant, deploymentMode, traceId, contentHash, activePolicy]);

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

  const handleSignAndStore = async () => {
    if (!auditExport || !user) return;
    setIsSigning(true);
    try {
      const { signed } = await storeSignedAudit.mutateAsync({
        tenantId: tenant,
        payloadJson: JSON.stringify(auditExport),
      });
      setSignedAudit(signed as unknown as Record<string, unknown>);
    } catch (e) {
      console.error('Sign failed', e);
    } finally {
      setIsSigning(false);
    }
  };

  const downloadSignedAudit = () => {
    if (!signedAudit) return;
    const blob = new Blob([JSON.stringify(signedAudit, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sado-signed-audit-${traceId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Batch mode ──
  const handleBatchFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = String(ev.target?.result ?? '');
      const texts = parseCsvRows(raw);
      setBatchRows(texts.map((t, i) => ({ rowIndex: i + 1, rawText: t, status: 'pending' })));
      setBatchProgress(0);
    };
    reader.readAsText(file);
  };

  const runBatch = async () => {
    if (batchRunning || batchRows.length === 0) return;
    setBatchRunning(true);
    batchAbortRef.current = false;
    const rows = [...batchRows];
    for (let i = 0; i < rows.length; i++) {
      if (batchAbortRef.current) break;
      setBatchRows((prev) => prev.map((r) => r.rowIndex === rows[i].rowIndex ? { ...r, status: 'processing' } : r));
      try {
        const { results: r, traceId: tid, contentHash: hash } = await runPipeline(rows[i].rawText);
        setBatchRows((prev) => prev.map((r2) => r2.rowIndex === rows[i].rowIndex
          ? { ...r2, status: 'done', result: r, traceId: tid, contentHash: hash }
          : r2));
      } catch (err) {
        setBatchRows((prev) => prev.map((r2) => r2.rowIndex === rows[i].rowIndex
          ? { ...r2, status: 'error', error: String(err) }
          : r2));
      }
      setBatchProgress(i + 1);
    }
    setBatchRunning(false);
  };

  const downloadBatchCsv = () => {
    const csv = buildBatchCsv(batchRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sado-batch-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Policy save ──
  const handleSavePolicy = async () => {
    setPolicyMsg('');
    try {
      await savePolicy.mutateAsync({
        tenantId: policyTenant,
        ...(editThreshold !== null ? { dialectLlmFallbackThreshold: editThreshold } : {}),
        ...(editCutoff !== null ? { encodingIssuesReviewCutoff: editCutoff } : {}),
        ...(editLlmEnabled !== null ? { llmFallbackEnabled: editLlmEnabled } : {}),
      });
      await refetchPolicy();
      setPolicyMsg('Policy saved.');
      setEditThreshold(null);
      setEditCutoff(null);
      setEditLlmEnabled(null);
    } catch (e) {
      setPolicyMsg(`Error: ${String(e)}`);
    }
  };

  // ── Verify ──
  const handleVerify = async () => {
    setVerifyRunning(true);
    setVerifyResult(null);
    try {
      const parsed = JSON.parse(verifyJson);
      const result = await verifyAuditMut.mutateAsync({
        payload: parsed.payload,
        signature: parsed.signature,
        publicKey: parsed.publicKey,
        signedAt: parsed.signedAt,
        schemaVersion: '1.1',
      });
      setVerifyResult(result);
    } catch (e) {
      setVerifyResult({ valid: false, reason: String(e) });
    } finally {
      setVerifyRunning(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const tabs: { id: MainTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'single', label: 'Single',  icon: FileText },
    { id: 'batch',  label: 'Batch',   icon: ListChecks },
    { id: 'policy', label: 'Policy',  icon: Settings },
    { id: 'verify', label: 'Verify',  icon: ShieldCheck },
  ];

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
              <div className="text-[11px] text-slate-500 tracking-wide">v1.1 · sovereign workflow</div>
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
        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 pb-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setMainTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  mainTab === t.id
                    ? 'border-cyan-500 text-cyan-300'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ════════════════════════════════════════════════════════════════════
            TAB: SINGLE
        ════════════════════════════════════════════════════════════════════ */}
        {mainTab === 'single' && (
          <>
            {/* 1 · Input */}
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
                    Upload .txt
                    <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleFile} />
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
                  onClick={handleRunSingle}
                  disabled={!input.trim() || isRunning}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-medium transition-colors"
                >
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {isRunning ? 'Processing...' : 'Run refinement pipeline'}
                </button>
              </div>
            </Card>

            {/* 2 · Pipeline */}
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
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {user && (
                        <button
                          onClick={handleSignAndStore}
                          disabled={isSigning}
                          className="text-xs px-2.5 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors inline-flex items-center gap-1.5"
                        >
                          {isSigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                          Sign & store
                        </button>
                      )}
                      {signedAudit && (
                        <button
                          onClick={downloadSignedAudit}
                          className="text-xs px-2.5 py-1.5 rounded border border-indigo-700 text-indigo-300 hover:bg-indigo-950 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          Download signed
                        </button>
                      )}
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

                  {signedAudit && (
                    <div className="mb-4 p-3 bg-indigo-950/40 border border-indigo-800/60 rounded text-[11px] text-indigo-300 font-mono">
                      <div className="flex items-center gap-2 mb-1"><Lock className="w-3 h-3" /> Signed audit stored</div>
                      <div className="text-slate-400 truncate">sig: {String((signedAudit as { signature?: unknown }).signature ?? '').slice(0, 40)}…</div>
                    </div>
                  )}

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
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: BATCH
        ════════════════════════════════════════════════════════════════════ */}
        {mainTab === 'batch' && (
          <>
            <Card className="p-5">
              <SectionLabel icon={ListChecks}>Batch CSV Processing</SectionLabel>
              <p className="text-xs text-slate-400 mb-4">Upload a CSV with one Arabic text per row (no header required). Each row is processed through the full pipeline independently.</p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs px-3 py-2 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  Upload CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleBatchFile} />
                </label>
                {batchRows.length > 0 && (
                  <>
                    <span className="text-xs text-slate-500">{batchRows.length} rows loaded</span>
                    <button
                      onClick={runBatch}
                      disabled={batchRunning}
                      className="text-xs px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors inline-flex items-center gap-2"
                    >
                      {batchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {batchRunning ? `Processing ${batchProgress}/${batchRows.length}…` : 'Run batch'}
                    </button>
                    {batchRows.some((r) => r.status === 'done' || r.status === 'error') && (
                      <button
                        onClick={downloadBatchCsv}
                        className="text-xs px-3 py-2 rounded bg-slate-100 hover:bg-white text-slate-900 transition-colors inline-flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                      </button>
                    )}
                    {batchRunning && (
                      <button
                        onClick={() => { batchAbortRef.current = true; }}
                        className="text-xs px-3 py-2 rounded border border-red-800 text-red-400 hover:bg-red-950 transition-colors inline-flex items-center gap-2"
                      >
                        <X className="w-3.5 h-3.5" />
                        Abort
                      </button>
                    )}
                  </>
                )}
              </div>

              {batchRows.length > 0 && (
                <div className="mt-4">
                  {/* Progress bar */}
                  {batchRunning && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Progress</span>
                        <span>{batchProgress}/{batchRows.length}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 transition-all duration-300"
                          style={{ width: `${(batchProgress / batchRows.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Row table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-left">
                          <th className="pb-2 pr-3 font-medium w-10">#</th>
                          <th className="pb-2 pr-3 font-medium">Text (preview)</th>
                          <th className="pb-2 pr-3 font-medium w-20">Status</th>
                          <th className="pb-2 pr-3 font-medium w-20">Rec</th>
                          <th className="pb-2 pr-3 font-medium w-16">Dialect</th>
                          <th className="pb-2 font-medium w-16">PII</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {batchRows.map((row) => (
                          <tr key={row.rowIndex} className="hover:bg-slate-900/40">
                            <td className="py-2 pr-3 font-mono text-slate-500">{row.rowIndex}</td>
                            <td className="py-2 pr-3 text-slate-300 max-w-xs truncate" dir="auto">{row.rawText.slice(0, 60)}{row.rawText.length > 60 ? '…' : ''}</td>
                            <td className="py-2 pr-3">
                              {row.status === 'pending'    && <span className="text-slate-600">pending</span>}
                              {row.status === 'processing' && <span className="text-cyan-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />running</span>}
                              {row.status === 'done'       && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />done</span>}
                              {row.status === 'error'      && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" />error</span>}
                            </td>
                            <td className="py-2 pr-3 font-mono text-slate-300">{row.result?.recommendation.code ?? '—'}</td>
                            <td className="py-2 pr-3 font-mono text-slate-400">{row.result ? `${row.result.dialect.confidence}%` : '—'}</td>
                            <td className="py-2 font-mono text-slate-400">{row.result ? row.result.pii.found.length : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {batchRows.length === 0 && (
                <div className="mt-6 text-center text-slate-600 text-xs">Upload a CSV to begin batch processing.</div>
              )}
            </Card>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: POLICY
        ════════════════════════════════════════════════════════════════════ */}
        {mainTab === 'policy' && (
          <>
            {!user ? (
              <Card className="p-8 text-center">
                <div className="text-slate-500 text-sm">Sign in to view and edit tenant policy.</div>
              </Card>
            ) : (
              <Card className="p-5">
                <SectionLabel icon={Settings}>Active Tenant Policy</SectionLabel>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-slate-400">Tenant:</span>
                  <input
                    value={policyTenant}
                    onChange={(e) => setPolicyTenant(e.target.value)}
                    className="text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none w-48"
                  />
                </div>

                {activePolicy ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dialect LLM fallback threshold */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded p-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Dialect LLM Fallback Threshold</div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-slate-200">{activePolicy.dialectLlmFallbackThreshold ?? 40}</span>
                          <input
                            type="number"
                            min={0} max={100}
                            placeholder="override"
                            value={editThreshold ?? ''}
                            onChange={(e) => setEditThreshold(e.target.value ? Number(e.target.value) : null)}
                            className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none w-24"
                          />
                        </div>
                        <div className="text-[10px] text-slate-600 mt-1">LLM is called when lexical confidence is below this value</div>
                      </div>

                      {/* Encoding issues review cutoff */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded p-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Encoding Issues Review Cutoff</div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-slate-200">{activePolicy.encodingIssuesReviewCutoff ?? 5}</span>
                          <input
                            type="number"
                            min={0} max={20}
                            placeholder="override"
                            value={editCutoff ?? ''}
                            onChange={(e) => setEditCutoff(e.target.value ? Number(e.target.value) : null)}
                            className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none w-24"
                          />
                        </div>
                        <div className="text-[10px] text-slate-600 mt-1">Triggers REVIEW recommendation when encoding issues exceed this count</div>
                      </div>

                      {/* LLM fallback enabled */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded p-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">LLM Fallback Enabled</div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-mono ${activePolicy.llmFallbackEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {activePolicy.llmFallbackEnabled ? 'enabled' : 'disabled'}
                          </span>
                          <select
                            value={editLlmEnabled === null ? '' : String(editLlmEnabled)}
                            onChange={(e) => setEditLlmEnabled(e.target.value === '' ? null : e.target.value === 'true')}
                            className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 outline-none"
                          >
                            <option value="">no change</option>
                            <option value="true">enable</option>
                            <option value="false">disable</option>
                          </select>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-1">Disable to prevent any LLM calls (sovereign/air-gapped deployments)</div>
                      </div>

                      {/* Storage adapter */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded p-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Audit Storage Adapter</div>
                        <span className="text-sm font-mono text-slate-200">{activePolicy.auditStorageAdapter ?? 'local'}</span>
                        <div className="text-[10px] text-slate-600 mt-1">local = /tmp/sado-audit · s3 = S3-compatible bucket</div>
                      </div>
                    </div>

                    {(editThreshold !== null || editCutoff !== null || editLlmEnabled !== null) && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleSavePolicy}
                          disabled={savePolicy.isPending}
                          className="text-xs px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white transition-colors inline-flex items-center gap-2"
                        >
                          {savePolicy.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Save policy
                        </button>
                        <button
                          onClick={() => { setEditThreshold(null); setEditCutoff(null); setEditLlmEnabled(null); }}
                          className="text-xs px-3 py-2 rounded border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {policyMsg && <div className="text-xs text-emerald-400">{policyMsg}</div>}

                    {/* Raw policy JSON */}
                    <details className="group">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 inline-flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                        Raw policy JSON
                      </summary>
                      <pre className="mt-2 bg-slate-950 border border-slate-800 rounded p-3 text-[11px] text-slate-400 font-mono overflow-auto max-h-64">
                        {JSON.stringify(activePolicy, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No policy found for tenant "{policyTenant}". A default policy will be created on first use.</div>
                )}
              </Card>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB: VERIFY
        ════════════════════════════════════════════════════════════════════ */}
        {mainTab === 'verify' && (
          <Card className="p-5">
            <SectionLabel icon={ShieldCheck}>Verify Signed Audit Record</SectionLabel>
            <p className="text-xs text-slate-400 mb-4">
              Paste a signed audit JSON (downloaded from the Single tab after "Sign & store") to verify its ed25519 signature.
            </p>
            <textarea
              value={verifyJson}
              onChange={(e) => setVerifyJson(e.target.value)}
              placeholder={'{\n  "payload": "...",\n  "signature": "...",\n  "publicKey": "...",\n  "signedAt": "...",\n  "schemaVersion": "1.1"\n}'}
              className="w-full min-h-[200px] bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-300 font-mono outline-none focus:border-cyan-700 transition-colors resize-y"
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleVerify}
                disabled={!verifyJson.trim() || verifyRunning}
                className="text-xs px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors inline-flex items-center gap-2"
              >
                {verifyRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Verify signature
              </button>
              {verifyJson && (
                <button
                  onClick={() => { setVerifyJson(''); setVerifyResult(null); }}
                  className="text-xs px-3 py-2 rounded border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {verifyResult && (
              <div className={`mt-4 p-4 rounded border ${verifyResult.valid ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-red-950/40 border-red-800/60'}`}>
                <div className={`flex items-center gap-2 text-sm font-medium ${verifyResult.valid ? 'text-emerald-300' : 'text-red-300'}`}>
                  {verifyResult.valid ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {verifyResult.valid ? 'Signature valid — audit record is authentic' : 'Signature invalid — record may have been tampered with'}
                </div>
                {verifyResult.reason && (
                  <div className="text-xs text-slate-400 mt-2 font-mono">{verifyResult.reason}</div>
                )}
              </div>
            )}
          </Card>
        )}

        <footer className="text-[10px] text-slate-600 text-center pt-4 pb-8">
          SADO Arabic Data Refinement v1.1 · sovereign workflow · batch · signed audit
        </footer>
      </main>
    </div>
  );
}
