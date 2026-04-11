/**
 * PortfolioMesh Demo — prefilled IPS, auto-run, no setup friction
 * Route: /portfolio-mesh/demo
 */
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ── Demo IPS preset ───────────────────────────────────────────────────────────
const DEMO_IPS = {
  name: "Institutional Endowment — Demo",
  targetReturn: 0.075,
  targetVolatilityMin: 0.06,
  targetVolatilityMax: 0.12,
  maxDrawdown: 0.15,
  benchmark: "60/40 Blend",
  constraints: {
    "US Equity":              { min: 0.10, max: 0.40 },
    "International Equity":   { min: 0.05, max: 0.25 },
    "Bonds":                  { min: 0.10, max: 0.35 },
    "Credit":                 { min: 0.00, max: 0.15 },
    "Gold":                   { min: 0.00, max: 0.10 },
    "Cash":                   { min: 0.02, max: 0.10 },
  },
};

type Step = "idle" | "creating" | "macro" | "assets" | "construction" | "cio" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle:         "Ready to run",
  creating:     "Creating run…",
  macro:        "Step 1 — Macro regime analysis…",
  assets:       "Step 2 — Asset class agents…",
  construction: "Step 3 — Portfolio construction…",
  cio:          "Step 4 — CIO output generation…",
  done:         "Complete",
  error:        "Error",
};

export default function PortfolioMeshDemo() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("idle");
  const [runId, setRunId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const createRun    = trpc.portfolioMesh.createRun.useMutation();
  const runMacro     = trpc.portfolioMesh.classifyMacro.useMutation();
  const runAssets    = trpc.portfolioMesh.runAssetAgents.useMutation();
  const runConstruct = trpc.portfolioMesh.constructPortfolios.useMutation();
  const runCio       = trpc.portfolioMesh.generateCioOutput.useMutation();

  async function startDemo() {
    if (hasStarted.current) return;
    hasStarted.current = true;
    try {
      // 1. Create run
      setStep("creating");
      const { runId: newRunId } = await createRun.mutateAsync({ ipsSnapshot: DEMO_IPS });
      setRunId(newRunId);

      // 2. Macro
      setStep("macro");
      const macroRes = await runMacro.mutateAsync({ runId: newRunId });

      // 3. Asset agents
      setStep("assets");
      const assetRes = await runAssets.mutateAsync({
        runId: newRunId,
        regime: macroRes.regime,
      });

      // 4. Construction
      setStep("construction");
      const constructRes = await runConstruct.mutateAsync({
        runId: newRunId,
        assetEstimates: assetRes.map(e => ({ asset: e.asset, finalReturn: e.finalReturn, finalVolatility: e.finalVolatility })),
        constraints: DEMO_IPS.constraints,
      });

      // 5. CIO Output
      setStep("cio");
      await runCio.mutateAsync({
        runId: newRunId,
        constructionResults: constructRes,
        macroRegime: macroRes.regime,
        ipsSnapshot: DEMO_IPS,
      });

      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStep("error");
    }
  }

  // Auto-start when user is authenticated
  useEffect(() => {
    if (user && step === "idle") {
      startDemo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const progress: Record<Step, number> = {
    idle: 0, creating: 5, macro: 25, assets: 50, construction: 75, cio: 90, done: 100, error: 0,
  };

  return (
    <div className="min-h-screen bg-[#0B1629] text-slate-100">
      <SiteNav />
      <div className="max-w-2xl mx-auto px-4 py-8 pt-24">

        {/* Demo Mode Banner */}
        <div className="flex items-center gap-3 mb-8 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <span className="text-amber-400 text-lg">⚡</span>
          <div>
            <p className="text-amber-300 text-sm font-semibold">Demo Mode</p>
            <p className="text-amber-200/60 text-xs">
              Running with a prefilled Institutional Endowment IPS. No setup required.
            </p>
          </div>
          <Badge className="ml-auto bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
            DEMO
          </Badge>
        </div>

        {/* IPS Summary */}
        <div className="mb-8 p-4 rounded-lg bg-slate-900/60 border border-white/10">
          <p className="text-slate-400 text-xs font-mono mb-3 uppercase tracking-wider">Prefilled IPS — {DEMO_IPS.name}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Target Return", value: `${(DEMO_IPS.targetReturn * 100).toFixed(1)}%` },
              { label: "Vol Range", value: `${(DEMO_IPS.targetVolatilityMin * 100).toFixed(0)}–${(DEMO_IPS.targetVolatilityMax * 100).toFixed(0)}%` },
              { label: "Max Drawdown", value: `${(DEMO_IPS.maxDrawdown * 100).toFixed(0)}%` },
              { label: "Benchmark", value: DEMO_IPS.benchmark },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded p-3 border border-white/10">
                <p className="text-slate-500 text-xs mb-1">{label}</p>
                <p className="text-slate-200 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Auth gate */}
        {!user && (
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4 text-sm">Sign in to run the demo automatically.</p>
            <a href={getLoginUrl("/portfolio-mesh/demo")}>
              <Button className="bg-blue-600 hover:bg-blue-500 text-white">
                Sign In to Run Demo
              </Button>
            </a>
          </div>
        )}

        {/* Progress */}
        {user && step !== "done" && step !== "error" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-300 text-sm font-medium">{STEP_LABELS[step]}</p>
                <p className="text-slate-500 text-xs">{progress[step]}%</p>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-violet-500 to-cyan-500 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${progress[step]}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {(["macro", "assets", "construction", "cio"] as Step[]).map((s, i) => {
                const stepOrder: Step[] = ["creating", "macro", "assets", "construction", "cio", "done"];
                const currentIdx = stepOrder.indexOf(step);
                const thisIdx = stepOrder.indexOf(s);
                const isDone = currentIdx > thisIdx;
                const isActive = currentIdx === thisIdx;
                return (
                  <div key={s} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isDone  ? "bg-emerald-500/10 border-emerald-500/30" :
                    isActive ? "bg-violet-500/10 border-violet-500/30" :
                               "bg-white/5 border-white/10"
                  }`}>
                    <span className="text-sm w-5 text-center">
                      {isDone ? "✓" : isActive ? <span className="animate-spin inline-block">⟳</span> : `${i + 1}`}
                    </span>
                    <span className={`text-sm ${isDone ? "text-emerald-300" : isActive ? "text-violet-300" : "text-slate-500"}`}>
                      {["Macro Regime Analysis", "Asset Class Agents", "Portfolio Construction", "CIO Output Generation"][i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error state */}
        {step === "error" && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-red-300 text-sm font-medium mb-1">Demo run failed</p>
            <p className="text-red-200/60 text-xs">{error}</p>
            <Button
              className="mt-4 bg-red-600 hover:bg-red-500 text-white"
              onClick={() => { hasStarted.current = false; setStep("idle"); setError(null); startDemo(); }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Done — navigate to result */}
        {step === "done" && runId && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
              <span className="text-emerald-400 text-xl">✓</span>
              <div>
                <p className="text-emerald-300 text-sm font-semibold">Demo run complete</p>
                <p className="text-emerald-200/60 text-xs">CIO Board Memo generated. Viewing results now.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                className="bg-blue-600 hover:bg-blue-500 text-white flex-1"
                onClick={() => navigate(`/portfolio-mesh/run/${runId}`)}
              >
                View CIO Output →
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-slate-300 hover:bg-white/5"
                onClick={() => navigate("/portfolio-mesh")}
              >
                Full Run
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
