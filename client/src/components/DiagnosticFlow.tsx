/**
 * DiagnosticFlow — shared component used by both /founder (EN) and /zh (ZH)
 *
 * Stages:
 *   idle → running → preview → email_capture → full_report
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Analytics helper ──────────────────────────────────────────────────────────
function trackEvent(name: string, props?: Record<string, unknown>) {
  try {
    const w = window as any;
    if (w.umami?.track) w.umami.track(name, props);
    if (w.gtag) w.gtag("event", name, props);
  } catch { /* non-fatal */ }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type Lang = "zh" | "en";

interface Dimension {
  name: "business_model" | "market" | "moat" | "cashflow";
  score: number;
  note: string;
}

interface Gap {
  title: string;
  why_fatal: string;
  fix: string;
}

interface DiagnosisResult {
  score: number;
  dimensions: Dimension[];
  gaps: Gap[];
  tiersUsed: string[];
  attemptsCount: number;
  escalated: boolean;
}

// ── Copy strings ──────────────────────────────────────────────────────────────
const COPY = {
  zh: {
    placeholder: "用大白话描述你的创业想法（最多2000字）",
    submitBtn: "开始诊断",
    running: "正在分析…",
    scoreLabel: "创业健康分",
    dimensionNames: {
      business_model: "商业模式",
      market: "市场容量",
      moat: "竞争壁垒",
      cashflow: "现金流",
    },
    gapsPreviewTitle: "三大致命漏洞",
    gapsPreviewNote: "（完整分析见下方）",
    emailGateTitle: "获取完整报告 + 免费每周进度检查",
    emailGateSubtitle: "输入您的邮箱",
    emailPlaceholder: "your@email.com",
    emailSubmit: "获取完整报告",
    emailSkip: "跳过，直接查看报告",
    fullReportTitle: "完整诊断报告",
    whyFatalLabel: "为何致命",
    fixLabel: "修补方案",
    errorMsg: "诊断失败，请重试。",
    charCount: (n: number) => `${n} / 2000`,
    minChars: "请至少输入10个字符",
    emailSuccess: "邮箱已记录，正在显示完整报告…",
  },
  en: {
    placeholder: "Describe your startup idea in plain words (up to 2,000 characters)",
    submitBtn: "Run Diagnosis",
    running: "Analysing…",
    scoreLabel: "Idea Health Score",
    dimensionNames: {
      business_model: "Business Model",
      market: "Market Size",
      moat: "Competitive Moat",
      cashflow: "Cash Flow",
    },
    gapsPreviewTitle: "Three Fatal Gaps",
    gapsPreviewNote: "(full analysis below)",
    emailGateTitle: "Get your full report + free weekly progress check",
    emailGateSubtitle: "Enter your email",
    emailPlaceholder: "your@email.com",
    emailSubmit: "Get Full Report",
    emailSkip: "Skip — show me the report",
    fullReportTitle: "Full Diagnostic Report",
    whyFatalLabel: "Why it's fatal",
    fixLabel: "Fix",
    errorMsg: "Diagnosis failed. Please try again.",
    charCount: (n: number) => `${n} / 2,000`,
    minChars: "Please enter at least 10 characters",
    emailSuccess: "Email captured — loading full report…",
  },
};

// ── Score colour ──────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 70) return "#34D399"; // green
  if (s >= 45) return "#FBBF24"; // amber
  return "#F87171"; // red
}

function dimColor(s: number) {
  if (s >= 70) return "bg-emerald-400/15 text-emerald-300 border-emerald-400/30";
  if (s >= 45) return "bg-amber-400/15 text-amber-300 border-amber-400/30";
  return "bg-red-400/15 text-red-300 border-red-400/30";
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DiagnosticFlow({
  lang,
  buSource = "diaspora",
}: {
  lang: Lang;
  buSource?: string;
}) {
  const c = COPY[lang];

  const [idea, setIdea] = useState("");
  const [stage, setStage] = useState<"idle" | "running" | "preview" | "email_capture" | "full_report">("idle");
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const runMutation = trpc.diagnosis.run.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStage("preview");
      trackEvent("diagnosis_complete", { lang, score: data.score, source: buSource });
    },
    onError: (err) => {
      setStage("idle");
      toast.error(err.message ?? c.errorMsg);
      trackEvent("diagnosis_error", { lang, source: buSource });
    },
  });

  const captureLeadMutation = trpc.diagnosis.captureLead.useMutation({
    onSuccess: () => {
      toast.success(c.emailSuccess);
      setStage("full_report");
      trackEvent("lead_captured", { lang, source: buSource });
    },
    onError: () => {
      // Non-fatal — still show report
      setStage("full_report");
    },
  });

  function handleSubmit() {
    if (idea.trim().length < 10) {
      setInputError(c.minChars);
      return;
    }
    setInputError(null);
    setStage("running");
    trackEvent("diagnosis_started", { lang, source: buSource });
    runMutation.mutate({ idea: idea.trim(), language: lang });
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(lang === "zh" ? "请输入有效邮箱" : "Please enter a valid email");
      return;
    }
    setEmailError(null);
    if (!result) { setStage("full_report"); return; }
    captureLeadMutation.mutate({
      email: trimmed,
      ideaHealthScore: result.score,
      gap1: result.gaps[0]?.title,
      gap2: result.gaps[1]?.title,
      gap3: result.gaps[2]?.title,
      language: lang,
      buSource,
      ideaSnippet: idea.trim().slice(0, 500),
    });
  }

  function handleSkip() {
    setStage("full_report");
    trackEvent("email_gate_skipped", { lang, source: buSource });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Idle / input
  if (stage === "idle") {
    return (
      <div className="w-full">
        <textarea
          value={idea}
          onChange={(e) => { setIdea(e.target.value); setInputError(null); }}
          placeholder={c.placeholder}
          maxLength={2000}
          rows={6}
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/20 resize-none transition-colors"
          style={{ fontFamily: lang === "zh" ? "'Noto Sans SC', sans-serif" : undefined }}
        />
        <div className="flex items-center justify-between mt-1.5 mb-4">
          <span className="text-xs text-red-400">{inputError ?? ""}</span>
          <span className="text-xs text-slate-600">{c.charCount(idea.length)}</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={idea.trim().length < 10}
          className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 rounded-xl transition-colors"
        >
          {c.submitBtn}
        </button>
      </div>
    );
  }

  // Running
  if (stage === "running") {
    return (
      <div className="w-full flex flex-col items-center gap-4 py-10">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">{c.running}</p>
      </div>
    );
  }

  if (!result) return null;

  // Preview (score + 4 dimensions + 3 gap TITLES only)
  if (stage === "preview") {
    return (
      <div className="w-full space-y-6">
        {/* Score */}
        <div className="flex items-center gap-5 bg-white/5 border border-white/10 rounded-xl p-5">
          <div
            className="text-5xl font-black font-mono"
            style={{ color: scoreColor(result.score) }}
          >
            {result.score}
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">{c.scoreLabel}</div>
            <div className="h-2 w-40 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${result.score}%`, background: scoreColor(result.score) }}
              />
            </div>
          </div>
        </div>

        {/* 4 Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          {result.dimensions.map((d) => (
            <div key={d.name} className={`border rounded-xl p-4 ${dimColor(d.score)}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{c.dimensionNames[d.name]}</span>
                <span className="text-xs font-mono font-bold">{d.score}</span>
              </div>
              <p className="text-xs opacity-80 leading-relaxed">{d.note}</p>
            </div>
          ))}
        </div>

        {/* 3 Gap titles (teaser) */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">
            {c.gapsPreviewTitle} <span className="normal-case">{c.gapsPreviewNote}</span>
          </div>
          <ol className="space-y-2">
            {result.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-300 font-medium">{g.title}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* CTA to email gate */}
        <button
          onClick={() => setStage("email_capture")}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
        >
          {lang === "zh" ? "查看完整诊断报告 →" : "View Full Diagnostic Report →"}
        </button>
      </div>
    );
  }

  // Email capture gate
  if (stage === "email_capture") {
    return (
      <div className="w-full">
        <div className="bg-white/5 border border-cyan-400/20 rounded-xl p-6">
          <h3 className="text-base font-semibold text-white mb-1">{c.emailGateTitle}</h3>
          <p className="text-sm text-slate-400 mb-5">{c.emailGateSubtitle}</p>
          <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
              placeholder={c.emailPlaceholder}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-colors"
              disabled={captureLeadMutation.isPending}
            />
            <button
              type="submit"
              disabled={captureLeadMutation.isPending}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {captureLeadMutation.isPending ? "…" : c.emailSubmit}
            </button>
          </form>
          {emailError && <p className="mt-2 text-xs text-red-400">{emailError}</p>}
          <button
            onClick={handleSkip}
            className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
          >
            {c.emailSkip}
          </button>
        </div>
      </div>
    );
  }

  // Full report
  return (
    <div className="w-full space-y-6">
      {/* Score recap */}
      <div className="flex items-center gap-5 bg-white/5 border border-white/10 rounded-xl p-5">
        <div
          className="text-5xl font-black font-mono"
          style={{ color: scoreColor(result.score) }}
        >
          {result.score}
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">{c.scoreLabel}</div>
          <div className="h-2 w-40 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full"
              style={{ width: `${result.score}%`, background: scoreColor(result.score) }}
            />
          </div>
        </div>
      </div>

      {/* 4 Dimensions */}
      <div className="grid grid-cols-2 gap-3">
        {result.dimensions.map((d) => (
          <div key={d.name} className={`border rounded-xl p-4 ${dimColor(d.score)}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">{c.dimensionNames[d.name]}</span>
              <span className="text-xs font-mono font-bold">{d.score}</span>
            </div>
            <p className="text-xs opacity-80 leading-relaxed">{d.note}</p>
          </div>
        ))}
      </div>

      {/* Full gaps */}
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-4">{c.fullReportTitle}</div>
        <div className="space-y-4">
          {result.gaps.map((g, i) => (
            <div key={i} className="bg-white/5 border border-red-400/20 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="mt-0.5 w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <h4 className="text-sm font-semibold text-white">{g.title}</h4>
              </div>
              <div className="ml-9 space-y-3">
                <div>
                  <div className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-1">{c.whyFatalLabel}</div>
                  <p className="text-sm text-slate-300 leading-relaxed">{g.why_fatal}</p>
                </div>
                <div>
                  <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">{c.fixLabel}</div>
                  <p className="text-sm text-slate-300 leading-relaxed">{g.fix}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Run again */}
      <button
        onClick={() => { setStage("idle"); setIdea(""); setResult(null); }}
        className="w-full border border-white/15 hover:border-white/30 text-slate-400 hover:text-white text-sm py-2.5 rounded-xl transition-colors"
      >
        {lang === "zh" ? "重新诊断另一个想法" : "Diagnose another idea"}
      </button>
    </div>
  );
}
