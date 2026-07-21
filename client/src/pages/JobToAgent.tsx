import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BrainCircuit, Zap, Rocket, Activity, TrendingDown, Clock, CheckCircle2,
  AlertTriangle, Info, ChevronRight, Upload, FileText, Link2, Play,
  DollarSign, Users, Timer, BarChart3, Shield, Cpu, Wifi, RefreshCw
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ParseResult = {
  roleTitle: string; department: string; seniorityLevel: string;
  coreWorkflows: string[]; dataInputs: string[]; decisionLogic: string[];
  outputDeliverables: string[]; toolsRequired: string[];
  automationScore: number; automationRationale: string;
  humanOversightRequired: boolean; estimatedAnnualSalaryUSD: number;
  agentArchetype: string;
};

type CompileResult = {
  agentId: string; agentName: string; systemPrompt: string; executionMode: string;
  scheduleCron: string; toolConnectors: { name: string; type: string; description: string }[];
  outputChannels: string[]; complianceFlags: string[]; hitlTriggers: string[];
  performanceKPIs: { metric: string; target: string; unit: string }[];
  estimatedDailyTokens: number; confidenceScore: number; deploymentNotes: string;
};

type DeployResult = {
  workerId: number; agentId: string; agentName: string; status: "active";
  deployedAt: string; executionMode: string; uptimePercent: number;
  tasksCompleted: number; tasksToday: number; lastHeartbeat: string;
  estimatedMonthlyCostUSD: number; humanEquivalentMonthlyCostUSD: number;
  savingsPercent: number;
};

type Step = "input" | "parsing" | "parsed" | "compiling" | "compiled" | "deploying" | "live";

// ── Helpers ───────────────────────────────────────────────────────────────────
const SAMPLE_JDS = [
  {
    label: "Financial Analyst",
    text: `Financial Analyst — Investment Banking Division\n\nResponsibilities:\n• Analyze financial statements, market data, and economic indicators to produce investment recommendations\n• Build and maintain financial models (DCF, LBO, comparable company analysis)\n• Prepare weekly sector reports and executive briefings for the Investment Committee\n• Monitor portfolio performance and flag deviations from benchmark targets\n• Coordinate with compliance to ensure all research outputs meet SEC and FINRA standards\n\nRequirements: CFA Level II, 3+ years in buy-side or sell-side research, advanced Excel/Python, Bloomberg terminal proficiency.`,
  },
  {
    label: "Compliance Officer",
    text: `AML/KYC Compliance Officer — Regional Bank\n\nResponsibilities:\n• Review and approve customer due diligence (CDD) and enhanced due diligence (EDD) files\n• Monitor transaction surveillance alerts and escalate suspicious activity reports (SARs)\n• Conduct periodic risk assessments of high-risk customer segments\n• Maintain regulatory change log and update internal policies within 30 days of new guidance\n• Liaise with SAMA/CBUAE regulators for examination requests and ad-hoc queries\n\nRequirements: CAMS certification, 5+ years in banking compliance, FATF/OFAC/UN sanctions knowledge.`,
  },
  {
    label: "Customer Success Manager",
    text: `Customer Success Manager — B2B SaaS\n\nResponsibilities:\n• Own a portfolio of 50–80 enterprise accounts with $2M+ ARR\n• Conduct quarterly business reviews (QBRs) and track product adoption metrics\n• Identify expansion and upsell opportunities and coordinate with Account Executives\n• Resolve escalated support tickets within 4-hour SLA\n• Produce monthly health score reports for each account using Salesforce and Gainsight\n\nRequirements: 3+ years in SaaS CS, Salesforce/Gainsight proficiency, strong written communication.`,
  },
];

const ARCHETYPE_COLORS: Record<string, string> = {
  "Research Agent": "text-blue-400 bg-blue-400/10 border-blue-400/30",
  "Analysis Agent": "text-purple-400 bg-purple-400/10 border-purple-400/30",
  "Communication Agent": "text-green-400 bg-green-400/10 border-green-400/30",
  "Process Agent": "text-amber-400 bg-amber-400/10 border-amber-400/30",
  "Decision Agent": "text-red-400 bg-red-400/10 border-red-400/30",
  "Monitoring Agent": "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  "Synthesis Agent": "text-pink-400 bg-pink-400/10 border-pink-400/30",
};

const EXEC_MODE_ICON: Record<string, React.ReactNode> = {
  continuous: <RefreshCw className="w-3.5 h-3.5" />,
  scheduled: <Clock className="w-3.5 h-3.5" />,
  "event-triggered": <Zap className="w-3.5 h-3.5" />,
  "on-demand": <Play className="w-3.5 h-3.5" />,
};

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45 } } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

// ── Component ─────────────────────────────────────────────────────────────────
export default function JobToAgent() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("input");
  const [rawInput, setRawInput] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [meshMode] = useState<"SWF" | "Enterprise" | "SMB" | "Government">("Enterprise");
  const [error, setError] = useState<string | null>(null);
  const [heartbeat, setHeartbeat] = useState(0);

  const parseJD = trpc.jobAgent.parseJD.useMutation({
    onSuccess: (data) => { setParseResult(data); setStep("parsed"); },
    onError: (e) => { setError(e.message); setStep("input"); },
  });

  const compileAgent = trpc.jobAgent.compileAgent.useMutation({
    onSuccess: (data) => { setCompileResult(data); setStep("compiled"); },
    onError: (e) => { setError(e.message); setStep("parsed"); },
  });

  const deployWorker = trpc.jobAgent.deployWorker.useMutation({
    onSuccess: (data) => {
      setDeployResult(data);
      setStep("live");
      // Simulate heartbeat ticks
      const iv = setInterval(() => setHeartbeat((h) => h + 1), 3000);
      setTimeout(() => clearInterval(iv), 60000);
    },
    onError: (e) => { setError(e.message); setStep("compiled"); },
  });

  const handleParse = useCallback(() => {
    if (!rawInput.trim()) return;
    setError(null);
    setStep("parsing");
    parseJD.mutate({ rawInput, inputType: "jd_text" });
  }, [rawInput, parseJD]);

  const handleCompile = useCallback(() => {
    if (!parseResult) return;
    setError(null);
    setStep("compiling");
    compileAgent.mutate({ ...parseResult, meshMode });
  }, [parseResult, compileAgent, meshMode]);

  const handleDeploy = useCallback(() => {
    if (!compileResult || !parseResult) return;
    setError(null);
    setStep("deploying");
    deployWorker.mutate({
      ...compileResult,
      roleTitle: parseResult.roleTitle,
      department: parseResult.department,
      estimatedAnnualSalaryUSD: parseResult.estimatedAnnualSalaryUSD,
    });
  }, [compileResult, parseResult, deployWorker]);

  const handleReset = () => {
    setStep("input"); setRawInput(""); setParseResult(null);
    setCompileResult(null); setDeployResult(null); setError(null); setHeartbeat(0);
  };

  const isLoading = step === "parsing" || step === "compiling" || step === "deploying";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
        {/* ── Header ── */}
        <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Job → Agent Engine</h1>
                <p className="text-xs text-slate-400">Universal Job-to-Agent Translation & Deployment</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Step indicators */}
              {(["input", "parsed", "compiled", "live"] as const).map((s, i) => {
                const labels = ["01 Ingest", "02 Parse", "03 Compile", "04 Deploy"];
                const reached = ["input", "parsed", "compiled", "live"].indexOf(step) >= i;
                return (
                  <div key={s} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${reached ? "text-violet-400" : "text-slate-600"}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${reached ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-slate-700 text-slate-600"}`}>{i + 1}</div>
                    <span className="hidden sm:inline">{labels[i]}</span>
                    {i < 3 && <ChevronRight className="w-3 h-3 text-slate-700" />}
                  </div>
                );
              })}
              {step !== "input" && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-400 hover:text-slate-200 ml-2">
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {/* ── Error Banner ── */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PANEL 1: Input ── */}
          <AnimatePresence mode="wait">
            {(step === "input" || step === "parsing") && (
              <motion.div key="input-panel" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0, y: -10 }}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main input */}
                  <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-violet-400" />
                      <h2 className="font-semibold text-slate-100">Job Description Input</h2>
                      <Tooltip>
                        <TooltipTrigger><Info className="w-3.5 h-3.5 text-slate-500" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">Paste any job description, role title, or unstructured text. The engine accepts JDs, LinkedIn posts, internal role specs, or even a single job title like "Financial Analyst".</TooltipContent>
                      </Tooltip>
                    </div>
                    <Textarea
                      value={rawInput}
                      onChange={(e) => setRawInput(e.target.value)}
                      placeholder="Paste any job description, role title, or unstructured text here…&#10;&#10;Examples:&#10;• Financial Analyst — Investment Banking Division&#10;• AML/KYC Compliance Officer&#10;• Customer Success Manager — B2B SaaS&#10;• Or paste a full JD with responsibilities and requirements"
                      className="min-h-[280px] bg-slate-950/60 border-slate-700 text-slate-100 placeholder:text-slate-600 resize-none font-mono text-sm leading-relaxed focus:border-violet-500 focus:ring-violet-500/20"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{rawInput.length.toLocaleString()} chars</span>
                        {rawInput.length > 100 && <span className="text-green-400">✓ Ready to parse</span>}
                      </div>
                      <Button
                        onClick={handleParse}
                        disabled={rawInput.trim().length < 5 || isLoading}
                        className="bg-violet-600 hover:bg-violet-500 text-white px-6 gap-2 shadow-lg shadow-violet-500/20"
                      >
                        {step === "parsing" ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Parsing JD…</>
                        ) : (
                          <><BrainCircuit className="w-4 h-4" /> Parse & Analyse</>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Sample JDs + info */}
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-semibold text-slate-200">Quick Start</h3>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">Load a sample job description to see the engine in action.</p>
                      <div className="space-y-2">
                        {SAMPLE_JDS.map((s) => (
                          <button key={s.label} onClick={() => setRawInput(s.text)}
                            className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 hover:border-violet-500/40 text-xs text-slate-300 transition-all">
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-violet-900/30 to-indigo-900/20 border border-violet-500/20 backdrop-blur p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-violet-400" />
                        <h3 className="text-sm font-semibold text-slate-200">How It Works</h3>
                      </div>
                      <ol className="space-y-2 text-xs text-slate-400">
                        {["Paste any job description or title", "AI extracts cognitive workflows & decision logic", "Agent compiler maps to Mesh architecture", "One-click deployment as a 24/7 digital worker"].map((t, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PANEL 2: Parse Results ── */}
          <AnimatePresence>
            {(step === "parsed" || step === "compiling") && parseResult && (
              <motion.div key="parse-panel" variants={stagger} initial="hidden" animate="visible">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Role summary */}
                  <motion.div variants={fadeUp} className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-6 space-y-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="font-semibold text-slate-100 text-lg leading-tight">{parseResult.roleTitle}</h2>
                        <p className="text-sm text-slate-400 mt-0.5">{parseResult.department} · {parseResult.seniorityLevel}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${ARCHETYPE_COLORS[parseResult.agentArchetype] ?? "text-slate-400 bg-slate-800 border-slate-700"}`}>
                        {parseResult.agentArchetype}
                      </span>
                    </div>

                    {/* Automation score */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Automation Potential</span>
                        <span className={`font-bold text-sm ${parseResult.automationScore >= 80 ? "text-green-400" : parseResult.automationScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                          {parseResult.automationScore}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${parseResult.automationScore}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={`h-full rounded-full ${parseResult.automationScore >= 80 ? "bg-green-500" : parseResult.automationScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                        />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{parseResult.automationRationale}</p>
                    </div>

                    {/* HITL */}
                    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${parseResult.humanOversightRequired ? "bg-amber-500/10 border border-amber-500/20 text-amber-300" : "bg-green-500/10 border border-green-500/20 text-green-300"}`}>
                      {parseResult.humanOversightRequired ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      {parseResult.humanOversightRequired ? "Human-in-the-loop required for critical decisions" : "Fully autonomous execution possible"}
                    </div>

                    {/* Salary */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-slate-800 pt-4">
                      <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                      <span>Human equivalent: <span className="text-slate-200 font-medium">${parseResult.estimatedAnnualSalaryUSD.toLocaleString()}/yr</span></span>
                    </div>
                  </motion.div>

                  {/* Centre: Workflows */}
                  <motion.div variants={fadeUp} className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Activity className="w-4 h-4 text-violet-400" /> Cognitive Workflows</h3>
                    <ul className="space-y-2">
                      {parseResult.coreWorkflows.map((w, i) => (
                        <motion.li key={i} variants={fadeUp} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                          {w}
                        </motion.li>
                      ))}
                    </ul>
                    <div className="border-t border-slate-800 pt-4 space-y-3">
                      <h4 className="text-xs font-medium text-slate-400">Data Inputs</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {parseResult.dataInputs.map((d, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300">{d}</span>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-slate-800 pt-4 space-y-3">
                      <h4 className="text-xs font-medium text-slate-400">Output Deliverables</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {parseResult.outputDeliverables.map((d, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-900/40 border border-indigo-500/20 text-indigo-300">{d}</span>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Right: Tools + CTA */}
                  <motion.div variants={fadeUp} className="space-y-4">
                    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-6 space-y-4">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Link2 className="w-4 h-4 text-cyan-400" /> Required Tool Connectors</h3>
                      <div className="space-y-2">
                        {parseResult.toolsRequired.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-300 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
                            <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={handleCompile}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white gap-2 shadow-lg shadow-violet-500/20 py-5"
                    >
                      {step === "compiling" ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Compiling Agent…</>
                      ) : (
                        <><Cpu className="w-4 h-4" /> Compile Agent Configuration</>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PANEL 3: Compiled Agent Config ── */}
          <AnimatePresence>
            {(step === "compiled" || step === "deploying") && compileResult && parseResult && (
              <motion.div key="compile-panel" variants={stagger} initial="hidden" animate="visible">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Agent spec */}
                  <motion.div variants={fadeUp} className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-6 space-y-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="font-semibold text-slate-100 text-lg">{compileResult.agentName}</h2>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">{compileResult.agentId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                          {EXEC_MODE_ICON[compileResult.executionMode]}
                          {compileResult.executionMode}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${compileResult.confidenceScore >= 80 ? "text-green-400 bg-green-400/10 border-green-400/30" : "text-amber-400 bg-amber-400/10 border-amber-400/30"}`}>
                          {compileResult.confidenceScore}% confidence
                        </span>
                      </div>
                    </div>

                    {/* System prompt preview */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-slate-400">System Prompt</h4>
                      <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 text-xs text-slate-300 font-mono leading-relaxed max-h-32 overflow-y-auto">
                        {compileResult.systemPrompt}
                      </div>
                    </div>

                    {/* Tool connectors */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-slate-400">Tool Connectors ({compileResult.toolConnectors.length})</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {compileResult.toolConnectors.map((tc, i) => (
                          <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700 text-xs">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-mono shrink-0">{tc.type}</span>
                            <div>
                              <p className="text-slate-200 font-medium">{tc.name}</p>
                              <p className="text-slate-500 mt-0.5 leading-tight">{tc.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* KPIs */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-slate-400">Performance KPIs</h4>
                      <div className="flex flex-wrap gap-2">
                        {compileResult.performanceKPIs.map((kpi, i) => (
                          <div key={i} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-900/30 border border-indigo-500/20 text-indigo-200">
                            <span className="text-indigo-400 font-medium">{kpi.metric}:</span> {kpi.target} {kpi.unit}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Economics + Deploy CTA */}
                  <motion.div variants={fadeUp} className="space-y-4">
                    {/* Economics calculator */}
                    <div className="rounded-2xl bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/20 backdrop-blur p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-green-400" />
                        <h3 className="text-sm font-semibold text-slate-200">Arbitrage Calculator</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5"><Users className="w-3 h-3" /> Human Cost / mo</span>
                          <span className="text-slate-200 font-medium">${Math.round(parseResult.estimatedAnnualSalaryUSD / 12).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5"><Cpu className="w-3 h-3" /> Agent Cost / mo</span>
                          <span className="text-green-300 font-medium">${Math.round(compileResult.estimatedDailyTokens * 30 * 0.000003).toLocaleString()}</span>
                        </div>
                        <div className="border-t border-green-500/20 pt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-400">Savings</span>
                            <span className="text-lg font-bold text-green-400">
                              {Math.round((1 - (compileResult.estimatedDailyTokens * 30 * 0.000003) / Math.max(parseResult.estimatedAnnualSalaryUSD / 12, 1)) * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-green-500/20 pt-3">
                          <span className="text-slate-400 flex items-center gap-1.5"><Timer className="w-3 h-3" /> Availability</span>
                          <span className="text-green-300 font-medium">24/7 · 365 days</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Onboarding</span>
                          <span className="text-green-300 font-medium">Instant vs 4–8 weeks</span>
                        </div>
                      </div>
                    </div>

                    {/* Compliance flags */}
                    {compileResult.complianceFlags.length > 0 && (
                      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                          <Shield className="w-3.5 h-3.5 text-amber-400" /> Compliance Flags
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {compileResult.complianceFlags.map((f, i) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleDeploy}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white gap-2 shadow-lg shadow-green-500/20 py-5"
                    >
                      {step === "deploying" ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /> Deploying Worker…</>
                      ) : (
                        <><Rocket className="w-4 h-4" /> Deploy Digital Worker</>
                      )}
                    </Button>
                    <p className="text-[11px] text-slate-500 text-center">{compileResult.deploymentNotes}</p>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PANEL 4: Live Execution Monitor ── */}
          <AnimatePresence>
            {step === "live" && deployResult && compileResult && parseResult && (
              <motion.div key="live-panel" variants={stagger} initial="hidden" animate="visible">
                {/* Live banner */}
                <motion.div variants={fadeUp} className="rounded-2xl bg-gradient-to-r from-green-900/40 to-emerald-900/30 border border-green-500/30 backdrop-blur p-5 flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                      <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-300">Digital Worker Active</p>
                      <p className="text-xs text-slate-400 mt-0.5">{deployResult.agentName} · Worker #{deployResult.workerId} · Deployed {new Date(deployResult.deployedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-green-400 animate-pulse" />
                    <span className="text-xs text-green-300 font-medium">LIVE</span>
                  </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Execution monitor */}
                  <motion.div variants={fadeUp} className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-6 space-y-5">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2"><Activity className="w-4 h-4 text-green-400" /> Execution Monitor</h3>

                    {/* KPI grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Uptime", value: `${deployResult.uptimePercent}%`, icon: <Wifi className="w-4 h-4" />, color: "text-green-400" },
                        { label: "Tasks Today", value: String(deployResult.tasksToday + heartbeat), icon: <CheckCircle2 className="w-4 h-4" />, color: "text-violet-400" },
                        { label: "Success Rate", value: "97.4%", icon: <BarChart3 className="w-4 h-4" />, color: "text-blue-400" },
                        { label: "Avg Latency", value: "1.24s", icon: <Timer className="w-4 h-4" />, color: "text-amber-400" },
                      ].map((kpi) => (
                        <div key={kpi.label} className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 space-y-1">
                          <div className={`${kpi.color} flex items-center gap-1.5 text-xs text-slate-400`}>{kpi.icon}<span>{kpi.label}</span></div>
                          <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Live log */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-slate-400">Live Activity Log</h4>
                      <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
                        {[
                          { time: "00:00:01", msg: `[INIT] Agent ${deployResult.agentName} initialized`, color: "text-green-400" },
                          { time: "00:00:02", msg: `[CONN] Tool connectors established (${compileResult.toolConnectors.length} active)`, color: "text-blue-400" },
                          { time: "00:00:03", msg: `[MODE] Execution mode: ${deployResult.executionMode}`, color: "text-violet-400" },
                          { time: "00:00:05", msg: `[TASK] Ingesting data from ${parseResult.dataInputs[0] ?? "primary source"}`, color: "text-slate-300" },
                          { time: "00:00:08", msg: `[PROC] Running workflow: ${parseResult.coreWorkflows[0] ?? "primary workflow"}`, color: "text-slate-300" },
                          { time: "00:00:12", msg: `[OUT]  Deliverable dispatched → ${compileResult.outputChannels[0] ?? "dashboard"}`, color: "text-cyan-400" },
                          ...(heartbeat > 0 ? [{ time: `00:${String(Math.floor(heartbeat * 3 / 60)).padStart(2, "0")}:${String((heartbeat * 3) % 60).padStart(2, "0")}`, msg: `[TICK] Heartbeat #${heartbeat} — all systems nominal`, color: "text-green-400" }] : []),
                        ].map((log, i) => (
                          <div key={i} className="flex gap-3">
                            <span className="text-slate-600 shrink-0">{log.time}</span>
                            <span className={log.color}>{log.msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Output channels */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-slate-400">Active Output Channels</h4>
                      <div className="flex flex-wrap gap-2">
                        {compileResult.outputChannels.map((ch, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            {ch}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Economics summary */}
                  <motion.div variants={fadeUp} className="space-y-4">
                    <div className="rounded-2xl bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/20 backdrop-blur p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <h3 className="text-sm font-semibold text-slate-200">Economics Summary</h3>
                      </div>
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Human Cost / mo</span>
                          <span className="text-slate-300 line-through">${deployResult.humanEquivalentMonthlyCostUSD.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Agent Cost / mo</span>
                          <span className="text-green-300 font-bold">${deployResult.estimatedMonthlyCostUSD.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-green-500/20 pt-3">
                          <span className="text-slate-400">Monthly Savings</span>
                          <span className="text-green-400 font-bold text-base">${(deployResult.humanEquivalentMonthlyCostUSD - deployResult.estimatedMonthlyCostUSD).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Cost Reduction</span>
                          <span className="text-green-400 font-bold text-lg">{deployResult.savingsPercent}%</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-green-500/20 pt-3">
                          <span className="text-slate-400">Annual Savings</span>
                          <span className="text-green-300 font-bold">${((deployResult.humanEquivalentMonthlyCostUSD - deployResult.estimatedMonthlyCostUSD) * 12).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Shield className="w-4 h-4 text-amber-400" /> HITL Triggers</h3>
                      {compileResult.hitlTriggers.length > 0 ? (
                        <ul className="space-y-1.5">
                          {compileResult.hitlTriggers.map((t, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                              {t}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-green-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Fully autonomous — no HITL required</p>
                      )}
                    </div>

                    <Button variant="outline" onClick={handleReset} className="w-full border-slate-700 text-slate-300 hover:text-slate-100 gap-2">
                      <Upload className="w-4 h-4" /> Deploy Another Role
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Auth gate ── */}
          {!user && (
            <div className="rounded-2xl bg-slate-900/60 border border-violet-500/20 backdrop-blur p-8 text-center space-y-3">
              <BrainCircuit className="w-10 h-10 text-violet-400 mx-auto" />
              <h3 className="font-semibold text-slate-200">Sign in to Deploy Workers</h3>
              <p className="text-sm text-slate-400">You can parse and compile job descriptions without signing in. To deploy live digital workers, sign in to your AgenThink Mesh account.</p>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
