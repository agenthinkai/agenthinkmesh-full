// client/src/pages/UaeRealEstateCouncil.tsx
//
// UAE Real Estate Council V1.8 — Public Polish
// Adds: clickable field rows, auto-focus inline inputs, green flash on save,
// (edited) marker, missing-field direct input. No backend changes.

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

// ── Types (mirrors server/lib/uaeRealEstateEngine.ts) ─────────────────────────
type PropertyType = "ready" | "off_plan";
type AssetClass   = "apartment" | "villa" | "townhouse" | "penthouse" | "commercial";
type Emirate      = "dubai" | "abu_dhabi" | "sharjah" | "ras_al_khaimah" | "other";
type Decision     = "BUY" | "WAIT" | "NEGOTIATE" | "AVOID";

interface AREAgentResult {
  personaId:    string;
  name:         string;
  role:         string;
  vote:         Decision;
  confidence:   number;
  label:        string;
  rationale:    string;
  conditions:   string[];
  blockers:     string[];
  isSilentFail: boolean;
}

interface ARECouncilResult {
  decision:         Decision;
  confidenceLevel:  "HIGH" | "MEDIUM" | "LOW";
  confidenceScore:  number;
  buyCount:         number;
  waitCount:        number;
  negotiateCount:   number;
  avoidCount:       number;
  topSignals:       string[];
  keyRisk:          string;
  keyRiskLabel:     string;
  investmentThesis: string;
  entryRange: {
    fairValueLow:  number;
    fairValueHigh: number;
    idealEntry:    number;
    reasoning:     string;
  };
  offPlanRisk?: {
    paymentRisk:  string;
    delayRisk:    string;
    exitRisk:     string;
    mitigation:   string;
    riskLabel:    "LOW" | "MEDIUM" | "HIGH";
  };
  strategicView:    string;
  agents:           AREAgentResult[];
  durationMs:       number;
  guardrailApplied: boolean;
  silentFails:      string[];
}

interface PropertyExtractionResult {
  propertyType:         PropertyType | null;
  assetClass:           AssetClass | null;
  emirate:              Emirate | null;
  community:            string | null;
  developer:            string | null;
  tower:                string | null;
  askingPriceAED:       number | null;
  areaSqft:             number | null;
  ppsfAsking:           number | null;
  ppsfComps:            number | null;
  annualRentAED:        number | null;
  serviceChargePerSqft: number | null;
  completionDate:       string | null;
  paymentPlan:          string | null;
  constructionProgress: number | null;
  escrowVerified:       boolean | null;
  notes:                string | null;
  missingCritical:      string[];
  missingOptional:      string[];
  offPlanDetected:      boolean;
  confidencePenalty:    number;
}

// ── Mesh Score ──────────────────────────────────────────────────────────────
function computeMeshScore(result: ARECouncilResult): { score: number; interpretation: string } {
  const total = result.agents.length || 7;
  // Vote weights: BUY=3, NEGOTIATE=2, WAIT=1, AVOID=0
  const rawVoteScore = (
    result.buyCount * 3 +
    result.negotiateCount * 2 +
    result.waitCount * 1 +
    result.avoidCount * 0
  ) / (total * 3);

  const confScore = result.confidenceScore;
  // 70% votes, 30% confidence
  let blended = rawVoteScore * 0.7 + confScore * 0.3;

  if (result.guardrailApplied) blended = Math.max(0, blended - 0.06);
  if (result.offPlanRisk?.riskLabel === "HIGH")   blended = Math.max(0, blended - 0.08);
  if (result.offPlanRisk?.riskLabel === "MEDIUM") blended = Math.max(0, blended - 0.04);

  let score = Math.round(blended * 100);
  // Enforce decision alignment bands
  if (result.decision === "BUY")       score = Math.max(75, Math.min(100, score));
  if (result.decision === "NEGOTIATE") score = Math.max(60, Math.min(74,  score));
  if (result.decision === "WAIT")      score = Math.max(45, Math.min(59,  score));
  if (result.decision === "AVOID")     score = Math.max(0,  Math.min(44,  score));

  const interpretation =
    score >= 75 ? "Strong opportunity" :
    score >= 60 ? "Solid but price-sensitive" :
    score >= 45 ? "Mixed signals" :
                  "High risk";

  return { score, interpretation };
}

// ── Decision colours ──────────────────────────────────────────────────────────
const DECISION_STYLE: Record<Decision, { bg: string; border: string; text: string; badge: string }> = {
  BUY:       { bg: "bg-emerald-50",  border: "border-emerald-600", text: "text-emerald-800", badge: "bg-emerald-600 text-white" },
  WAIT:      { bg: "bg-amber-50",    border: "border-amber-500",   text: "text-amber-800",   badge: "bg-amber-500 text-white" },
  NEGOTIATE: { bg: "bg-sky-50",      border: "border-sky-600",     text: "text-sky-800",     badge: "bg-sky-600 text-white" },
  AVOID:     { bg: "bg-red-50",      border: "border-red-600",     text: "text-red-800",     badge: "bg-red-600 text-white" },
};

const VOTE_STYLE: Record<Decision, string> = {
  BUY:       "bg-emerald-100 text-emerald-800 border-emerald-300",
  WAIT:      "bg-amber-100 text-amber-800 border-amber-300",
  NEGOTIATE: "bg-sky-100 text-sky-800 border-sky-300",
  AVOID:     "bg-red-100 text-red-800 border-red-300",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}

function fieldLabel(key: string): string {
  const map: Record<string, string> = {
    community: "Community / Area",
    developer: "Developer",
    askingPriceAED: "Asking Price (AED)",
    areaSqft: "Area (sqft)",
    propertyType: "Property Type",
    assetClass: "Asset Class",
    emirate: "Emirate",
    tower: "Tower / Building",
    ppsfComps: "Comp PPSF",
    annualRentAED: "Annual Rent (AED)",
    serviceChargePerSqft: "Service Charge",
    completionDate: "Completion Date",
    paymentPlan: "Payment Plan",
    constructionProgress: "Construction Progress",
    escrowVerified: "Escrow Verified",
  };
  return map[key] ?? key;
}

// ── Recommended Action logic ──────────────────────────────────────────────────
function getRecommendedActions(result: ARECouncilResult): string[] {
  const { decision, entryRange } = result;
  const ideal = fmt(entryRange.idealEntry);
  const low   = fmt(entryRange.fairValueLow);
  const high  = fmt(entryRange.fairValueHigh);

  switch (decision) {
    case "BUY":
      return [
        `Proceed with acquisition near ideal entry price (AED ${ideal})`,
        "Verify escrow registration and finalise contract terms before transfer",
      ];
    case "NEGOTIATE":
      return [
        `Target entry AED ${low}–${high} (ideal: AED ${ideal}); use pricing gap vs comps as leverage`,
        "Confirm seller motivation and timeline before submitting revised offer",
      ];
    case "WAIT":
      return [
        "Monitor price movement or construction progress before committing",
        "Re-evaluate once the key uncertainty identified above reduces",
      ];
    case "AVOID":
      return [
        "Do not proceed under current conditions",
        "Reassess only if pricing or material risk factors change significantly",
      ];
  }
}

// ── Download Summary ──────────────────────────────────────────────────────────
function buildSummaryText(result: ARECouncilResult): string {
  const ts = new Date().toLocaleString("en-AE", { timeZone: "Asia/Dubai" });
  const actions = getRecommendedActions(result);
  const { score, interpretation } = computeMeshScore(result);
  const lines: string[] = [
    "═══════════════════════════════════════════════════",
    "  UAE REAL ESTATE COUNCIL — SUMMARY",
    `  Generated: ${ts} (GST)`,
    "═══════════════════════════════════════════════════",
    "",
    `DECISION:     ${result.decision}`,
    `CONFIDENCE:   ${result.confidenceLevel} (${(result.confidenceScore * 100).toFixed(0)}%)`,
    `VOTES:        ${result.buyCount} BUY · ${result.negotiateCount} NEG · ${result.waitCount} WAIT · ${result.avoidCount} AVOID`,
    `MESH SCORE:   ${score} / 100 — ${interpretation}`,
    "",
    "─── IDEAL ENTRY PRICE ───────────────────────────",
    `  Ideal Entry:  AED ${fmt(result.entryRange.idealEntry)}`,
    `  Fair Range:   AED ${fmt(result.entryRange.fairValueLow)} – AED ${fmt(result.entryRange.fairValueHigh)}`,
    `  Reasoning:    ${result.entryRange.reasoning}`,
    "",
    "─── TOP SIGNALS ─────────────────────────────────",
    ...result.topSignals.map(s => `  ↑ ${s}`),
    "",
    "─── KEY RISK ────────────────────────────────────",
    `  [${result.keyRiskLabel.replace(/_/g, " ")}] ${result.keyRisk}`,
    "",
    "─── RECOMMENDED ACTION ──────────────────────────",
    ...actions.map(a => `  • ${a}`),
    "",
  ];

  if (result.offPlanRisk) {
    lines.push(
      `─── OFF-PLAN RISK SUMMARY [${result.offPlanRisk.riskLabel}] ──────────`,
      `  Payment Risk: ${result.offPlanRisk.paymentRisk}`,
      `  Delay Risk:   ${result.offPlanRisk.delayRisk}`,
      `  Exit Risk:    ${result.offPlanRisk.exitRisk}`,
      `  Mitigation:   ${result.offPlanRisk.mitigation}`,
      "",
    );
  }

  lines.push(
    "─── INVESTMENT THESIS ───────────────────────────",
    result.investmentThesis,
    "",
    "─── STRATEGIC VIEW ──────────────────────────────",
    result.strategicView,
    "",
    "═══════════════════════════════════════════════════",
    "  AgenThinkMesh · UAE Real Estate Council V1.8",
    "  For discussion purposes only. Not financial advice.",
    "═══════════════════════════════════════════════════",
  );

  return lines.join("\n");
}

function downloadSummary(result: ARECouncilResult) {
  const text = buildSummaryText(result);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `UAE_RE_Council_${result.decision}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copySummary(result: ARECouncilResult): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(buildSummaryText(result));
    return true;
  } catch {
    return false;
  }
}

// ── Verdict card ──────────────────────────────────────────────────────────────
function VerdictCard({
  result,
  onAnalyzeAnother,
}: {
  result: ARECouncilResult;
  onAnalyzeAnother: () => void;
}) {
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [copyLabel, setCopyLabel]   = useState<"Copy Summary" | "Copied!">("Copy Summary");
  const style = DECISION_STYLE[result.decision];

  const confColor =
    result.confidenceLevel === "HIGH"   ? "text-emerald-700" :
    result.confidenceLevel === "MEDIUM" ? "text-amber-700"   : "text-red-700";

  const actions = getRecommendedActions(result);

  async function handleCopy() {
    const ok = await copySummary(result);
    if (ok) {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy Summary"), 2000);
    }
  }

  return (
    <div className={`rounded-xl border-2 ${style.border} ${style.bg} p-6 space-y-5`}>

      {/* ── 1. Decision + Share buttons ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Council Decision</div>
          <div className={`text-5xl font-black font-mono ${style.text}`}>{result.decision}</div>
          {result.guardrailApplied && (
            <div className="text-xs text-amber-700 italic mt-1">
              Confidence guardrail applied — BUY downgraded to WAIT (avg confidence {(result.confidenceScore * 100).toFixed(0)}%)
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-sm space-y-1">
            <div className="font-mono text-slate-700">
              {result.buyCount} BUY · {result.negotiateCount} NEG · {result.waitCount} WAIT · {result.avoidCount} AVOID
            </div>
            <div className={`text-xs font-semibold ${confColor}`}>
              Confidence: {result.confidenceLevel} ({(result.confidenceScore * 100).toFixed(0)}%)
            </div>
            <div className="text-xs text-slate-500">
              {(result.durationMs / 1000).toFixed(1)}s · {result.agents.length} agents
            </div>
          </div>
          {/* Share buttons */}
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleCopy}
              className="text-xs border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 transition-colors font-medium"
            >
              {copyLabel}
            </button>
            <button
              onClick={() => downloadSummary(result)}
              className="text-xs border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 transition-colors font-medium"
            >
              ↓ Download Summary
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Mesh Score ── */}
      {(() => {
        const { score, interpretation } = computeMeshScore(result);
        const scoreColor =
          score >= 75 ? "text-emerald-700" :
          score >= 60 ? "text-sky-700" :
          score >= 45 ? "text-amber-700" :
                        "text-red-700";
        const barColor =
          score >= 75 ? "bg-emerald-500" :
          score >= 60 ? "bg-sky-500" :
          score >= 45 ? "bg-amber-500" :
                        "bg-red-500";
        return (
          <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-200">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 mb-0.5">Mesh Score</div>
              <div className={`text-3xl font-black font-mono ${scoreColor}`}>
                {score} <span className="text-lg font-semibold text-slate-400">/ 100</span>
              </div>
              <div className={`text-xs font-semibold mt-0.5 ${scoreColor}`}>{interpretation}</div>
            </div>
            <div className="flex-1 max-w-[160px]">
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0</span><span>50</span><span>100</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 3. Recommended Action (CRITICAL — directly below decision) ── */}
      <div className={`rounded-lg border-2 p-4 ${
        result.decision === "BUY"       ? "bg-emerald-100 border-emerald-400" :
        result.decision === "NEGOTIATE" ? "bg-sky-100 border-sky-400" :
        result.decision === "WAIT"      ? "bg-amber-100 border-amber-400" :
                                          "bg-red-100 border-red-400"
      }`}>
        <div className="text-xs uppercase tracking-widest text-slate-600 mb-2 font-semibold">
          Recommended Action
        </div>
        <ul className="space-y-1.5">
          {actions.map((action, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-800 font-medium">
              <span className={`mt-0.5 shrink-0 font-bold ${
                result.decision === "BUY"       ? "text-emerald-700" :
                result.decision === "NEGOTIATE" ? "text-sky-700" :
                result.decision === "WAIT"      ? "text-amber-700" :
                                                  "text-red-700"
              }`}>→</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── 3. Top Signals ── */}
      {result.topSignals.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Top Signals</div>
          <ul className="space-y-1">
            {result.topSignals.map((s, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span className="text-emerald-600 font-bold mt-0.5">↑</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 4. Key Risk ── */}
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Key Risk</div>
        <div className="flex items-start gap-2">
          <span className="text-red-500 font-bold mt-0.5">▲</span>
          <div>
            <span className="text-xs font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded mr-2">
              {result.keyRiskLabel.replace(/_/g, " ")}
            </span>
            <span className="text-sm text-slate-700">{result.keyRisk}</span>
          </div>
        </div>
      </div>

      {/* ── 5. Investment Thesis ── */}
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Investment Thesis</div>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{result.investmentThesis}</p>
      </div>

      {/* ── 6. Entry Range ── */}
      <div className="bg-white/70 rounded-lg border border-slate-200 p-4">
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Suggested Entry Range</div>
        <div className="grid grid-cols-3 gap-3 text-center mb-2">
          <div>
            <div className="text-xs text-slate-500">Fair Value Low</div>
            <div className="font-mono font-bold text-slate-800">AED {fmt(result.entryRange.fairValueLow)}</div>
          </div>
          <div className="border-x border-slate-200">
            <div className="text-xs text-slate-500">Ideal Entry</div>
            <div className={`font-mono font-bold text-lg ${style.text}`}>AED {fmt(result.entryRange.idealEntry)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Fair Value High</div>
            <div className="font-mono font-bold text-slate-800">AED {fmt(result.entryRange.fairValueHigh)}</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 italic text-center">{result.entryRange.reasoning}</p>
      </div>

      {/* ── 7. Strategic View ── */}
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Strategic View</div>
        <p className="text-sm text-slate-600 italic leading-relaxed">{result.strategicView}</p>
      </div>

      {/* ── 8. Off-Plan Risk Summary ── */}
      {result.offPlanRisk && (
        <div className={`rounded-lg border p-4 ${
          result.offPlanRisk.riskLabel === "HIGH"   ? "bg-red-50 border-red-300" :
          result.offPlanRisk.riskLabel === "MEDIUM" ? "bg-amber-50 border-amber-300" :
                                                      "bg-emerald-50 border-emerald-300"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs uppercase tracking-widest text-slate-500">Off-Plan Risk Summary</div>
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold ${
              result.offPlanRisk.riskLabel === "HIGH"   ? "bg-red-600 text-white" :
              result.offPlanRisk.riskLabel === "MEDIUM" ? "bg-amber-500 text-white" :
                                                          "bg-emerald-600 text-white"
            }`}>{result.offPlanRisk.riskLabel}</span>
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <div><span className="font-semibold">Payment Risk:</span> {result.offPlanRisk.paymentRisk}</div>
            <div><span className="font-semibold">Delay Risk:</span> {result.offPlanRisk.delayRisk}</div>
            <div><span className="font-semibold">Exit Risk:</span> {result.offPlanRisk.exitRisk}</div>
            <div><span className="font-semibold">Mitigation:</span> {result.offPlanRisk.mitigation}</div>
          </div>
        </div>
      )}

      {/* ── 9. Agent Breakdown (collapsed) ── */}
      <div>
        <button
          type="button"
          onClick={() => setAgentsOpen(v => !v)}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
        >
          <span>{agentsOpen ? "▾" : "▸"}</span>
          Agent Breakdown ({result.agents.length} seats)
        </button>
        {agentsOpen && (
          <div className="mt-3 space-y-2">
            {result.agents.map(agent => (
              <div
                key={agent.personaId}
                className={`rounded-lg border px-3 py-2 ${VOTE_STYLE[agent.vote]}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs">{agent.vote}</span>
                    <span className="font-semibold text-xs">{agent.name}</span>
                    <span className="text-xs opacity-60">{agent.role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono opacity-70">conf {(agent.confidence * 100).toFixed(0)}%</span>
                    {agent.label && (
                      <span className="text-xs font-mono bg-white/60 px-1.5 py-0.5 rounded border border-current/20">
                        {agent.label}
                      </span>
                    )}
                    {agent.isSilentFail && (
                      <span className="text-xs bg-red-200 text-red-700 px-1.5 py-0.5 rounded">FAIL</span>
                    )}
                  </div>
                </div>
                <p className="text-xs mt-1 opacity-80">{agent.rationale}</p>
                {agent.conditions.length > 0 && (
                  <p className="text-xs mt-0.5 italic opacity-60">
                    Conditions: {agent.conditions.join("; ")}
                  </p>
                )}
                {agent.blockers.length > 0 && (
                  <p className="text-xs mt-0.5 font-mono opacity-60">
                    Blockers: {agent.blockers.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {result.silentFails.length > 0 && (
        <div className="text-xs text-red-600 font-mono">
          Silent fails: {result.silentFails.join(", ")}
        </div>
      )}

      {/* ── 10. Secondary CTAs ── */}
      <div className="border-t border-current/10 pt-4 flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={onAnalyzeAnother}
          className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 px-5 text-sm transition-colors"
        >
          Analyze another property →
        </button>
        <button
          onClick={() => downloadSummary(result)}
          className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-5 text-sm transition-colors"
        >
          ↓ Download Summary
        </button>
      </div>
    </div>
  );
}

// ── Inline-editable field row ─────────────────────────────────────────────────
type FieldRowDef = {
  key: string;
  displayValue: string | null;
  rawValue: string;
  critical: boolean;
  inputType: "text" | "number" | "textarea";
};

function InlineFieldRow({
  row,
  isEditing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onSave,
  onCancel,
  isEdited,
  flashKey,
}: {
  row: FieldRowDef;
  isEditing: boolean;
  editDraft: string;
  onEditDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isEdited: boolean;
  flashKey: string | null;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      (inputRef.current as HTMLInputElement | null)?.focus();
    }
  }, [isEditing]);

  const isFlashing = flashKey === row.key;
  const isMissing  = row.displayValue == null;

  const rowBg = isFlashing
    ? "bg-emerald-50 border-emerald-400"
    : isEditing
    ? "bg-white border-sky-400 ring-1 ring-sky-300"
    : isMissing
    ? row.critical
      ? "bg-amber-50 border-amber-300"
      : "bg-slate-50 border-slate-200 opacity-60"
    : "bg-slate-50 border-slate-200 hover:border-slate-400 hover:bg-white";

  return (
    <div
      className={`group relative flex items-start gap-2 rounded-lg px-3 py-2 text-sm border transition-all duration-150 cursor-pointer ${rowBg}`}
      onClick={() => { if (!isEditing) onStartEdit(); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && !isEditing) onStartEdit(); }}
      aria-label={`Edit ${fieldLabel(row.key)}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          {fieldLabel(row.key)}
          {isEdited && !isEditing && (
            <span className="text-sky-500 font-normal normal-case tracking-normal text-[10px]">(edited)</span>
          )}
        </div>

        {isEditing ? (
          <div className="mt-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
            {row.inputType === "textarea" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={editDraft}
                onChange={e => onEditDraftChange(e.target.value)}
                rows={3}
                className="w-full rounded border border-sky-400 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-400 resize-none"
                onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={row.inputType}
                value={editDraft}
                onChange={e => onEditDraftChange(e.target.value)}
                className="w-full rounded border border-sky-400 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-400"
                onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSave}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2.5 py-1 font-semibold transition-colors"
              >
                ✓ Save
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="text-xs border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 rounded px-2.5 py-1 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : row.displayValue != null ? (
          <div className="font-medium text-slate-800 truncate">{row.displayValue}</div>
        ) : (
          <div className={`italic text-xs mt-0.5 ${row.critical ? "text-amber-700 font-semibold" : "text-slate-400"}`}>
            {row.critical ? "Not found — click to add" : "Not found — click to add"}
          </div>
        )}
      </div>

      {/* Right indicator */}
      {!isEditing && (
        <div className="shrink-0 mt-0.5 flex items-center gap-1">
          {isFlashing ? (
            <span className="text-emerald-500">✓</span>
          ) : row.displayValue != null ? (
            <>
              <span className="text-emerald-500">✓</span>
              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✎</span>
            </>
          ) : row.critical ? (
            <>
              <span className="text-amber-500">!</span>
              <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✎</span>
            </>
          ) : (
            <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✎</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detected Details Card ─────────────────────────────────────────────────────
function DetectedDetailsCard({
  extracted,
  onRunCouncil,
  onEdit,
  onFieldEdit,
  isRunning,
}: {
  extracted: PropertyExtractionResult;
  onRunCouncil: () => void;
  onEdit: () => void;
  onFieldEdit: (key: keyof PropertyExtractionResult, rawValue: string) => void;
  isRunning: boolean;
}) {
  const [editingKey, setEditingKey]   = useState<string | null>(null);
  const [editDraft, setEditDraft]     = useState("");
  const [editedKeys, setEditedKeys]   = useState<Set<string>>(new Set());
  const [flashKey, setFlashKey]       = useState<string | null>(null);
  const [showNudge, setShowNudge]     = useState(false);

  // Refs for each field row so we can scroll-focus the first missing one
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hasCriticalMissing = extracted.missingCritical.length > 0;

  // When critical fields change (user fills them), hide nudge automatically
  useEffect(() => {
    if (!hasCriticalMissing) setShowNudge(false);
  }, [hasCriticalMissing]);

  function handleRunClick() {
    if (hasCriticalMissing && !showNudge) {
      setShowNudge(true);
      return;
    }
    setShowNudge(false);
    onRunCouncil();
  }

  function handleAddMissingFields() {
    setShowNudge(false);
    // Focus + scroll to first missing critical field
    const firstMissing = extracted.missingCritical[0];
    if (firstMissing) {
      const el = fieldRefs.current[firstMissing];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Trigger inline edit on that field after scroll
        setTimeout(() => el.click(), 200);
      }
    }
  }

  // Determine raw value for editing (strip display formatting)
  function getRawForEdit(key: string): string {
    switch (key) {
      case "askingPriceAED":       return extracted.askingPriceAED != null ? String(extracted.askingPriceAED) : "";
      case "areaSqft":             return extracted.areaSqft != null ? String(extracted.areaSqft) : "";
      case "ppsfAsking":           return extracted.ppsfAsking != null ? String(extracted.ppsfAsking) : "";
      case "ppsfComps":            return extracted.ppsfComps != null ? String(extracted.ppsfComps) : "";
      case "annualRentAED":        return extracted.annualRentAED != null ? String(extracted.annualRentAED) : "";
      case "serviceChargePerSqft": return extracted.serviceChargePerSqft != null ? String(extracted.serviceChargePerSqft) : "";
      case "constructionProgress": return extracted.constructionProgress != null ? String(extracted.constructionProgress) : "";
      case "escrowVerified":       return extracted.escrowVerified != null ? (extracted.escrowVerified ? "Yes — RERA confirmed" : "No / not confirmed") : "";
      default: {
        const v = extracted[key as keyof PropertyExtractionResult];
        return v != null ? String(v) : "";
      }
    }
  }

  function getInputType(key: string): "text" | "number" | "textarea" {
    if (["askingPriceAED", "areaSqft", "ppsfAsking", "ppsfComps", "annualRentAED", "serviceChargePerSqft", "constructionProgress"].includes(key)) return "number";
    if (key === "paymentPlan") return "textarea";
    return "text";
  }

  const startEdit = useCallback((key: string) => {
    setEditingKey(key);
    setEditDraft(getRawForEdit(key));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted]);

  function saveEdit(key: string) {
    onFieldEdit(key as keyof PropertyExtractionResult, editDraft.trim());
    setEditingKey(null);
    setEditedKeys(prev => new Set(prev).add(key));
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 350);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditDraft("");
  }

  const rows: FieldRowDef[] = [
    { key: "propertyType",         displayValue: extracted.propertyType,         rawValue: extracted.propertyType ?? "",         critical: false, inputType: "text" },
    { key: "assetClass",           displayValue: extracted.assetClass,           rawValue: extracted.assetClass ?? "",           critical: false, inputType: "text" },
    { key: "emirate",              displayValue: extracted.emirate,              rawValue: extracted.emirate ?? "",              critical: false, inputType: "text" },
    { key: "community",            displayValue: extracted.community,            rawValue: extracted.community ?? "",            critical: true,  inputType: "text" },
    { key: "developer",            displayValue: extracted.developer,            rawValue: extracted.developer ?? "",            critical: true,  inputType: "text" },
    { key: "tower",                displayValue: extracted.tower,                rawValue: extracted.tower ?? "",                critical: false, inputType: "text" },
    { key: "askingPriceAED",       displayValue: extracted.askingPriceAED != null ? `AED ${fmt(extracted.askingPriceAED)}` : null, rawValue: extracted.askingPriceAED != null ? String(extracted.askingPriceAED) : "", critical: true,  inputType: "number" },
    { key: "areaSqft",             displayValue: extracted.areaSqft != null ? `${fmt(extracted.areaSqft)} sqft` : null,           rawValue: extracted.areaSqft != null ? String(extracted.areaSqft) : "",           critical: true,  inputType: "number" },
    { key: "ppsfAsking",           displayValue: extracted.ppsfAsking != null ? `AED ${fmt(extracted.ppsfAsking)}/sqft` : null,   rawValue: extracted.ppsfAsking != null ? String(extracted.ppsfAsking) : "",   critical: false, inputType: "number" },
    { key: "ppsfComps",            displayValue: extracted.ppsfComps != null ? `AED ${fmt(extracted.ppsfComps)}/sqft` : null,     rawValue: extracted.ppsfComps != null ? String(extracted.ppsfComps) : "",     critical: false, inputType: "number" },
    { key: "annualRentAED",        displayValue: extracted.annualRentAED != null ? `AED ${fmt(extracted.annualRentAED)}/yr` : null, rawValue: extracted.annualRentAED != null ? String(extracted.annualRentAED) : "", critical: false, inputType: "number" },
    { key: "serviceChargePerSqft", displayValue: extracted.serviceChargePerSqft != null ? `AED ${extracted.serviceChargePerSqft}/sqft/yr` : null, rawValue: extracted.serviceChargePerSqft != null ? String(extracted.serviceChargePerSqft) : "", critical: false, inputType: "number" },
    { key: "completionDate",       displayValue: extracted.completionDate,       rawValue: extracted.completionDate ?? "",       critical: false, inputType: "text" },
    { key: "paymentPlan",          displayValue: extracted.paymentPlan,          rawValue: extracted.paymentPlan ?? "",          critical: false, inputType: "textarea" },
    { key: "constructionProgress", displayValue: extracted.constructionProgress != null ? `${extracted.constructionProgress}%` : null, rawValue: extracted.constructionProgress != null ? String(extracted.constructionProgress) : "", critical: false, inputType: "number" },
    { key: "escrowVerified",       displayValue: extracted.escrowVerified != null ? (extracted.escrowVerified ? "Yes — RERA confirmed" : "No / not confirmed") : null, rawValue: extracted.escrowVerified != null ? (extracted.escrowVerified ? "Yes — RERA confirmed" : "No / not confirmed") : "", critical: false, inputType: "text" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-0.5">Detected Details</div>
          <div className="text-sm text-slate-600">
            Click any field to edit inline.
            {hasCriticalMissing && (
              <span className="ml-2 text-amber-700 font-semibold">
                {extracted.missingCritical.length} critical field{extracted.missingCritical.length > 1 ? "s" : ""} missing — confidence will be reduced.
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {extracted.offPlanDetected && (
            <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-full font-semibold">
              Off-Plan Detected
            </span>
          )}
          {extracted.confidencePenalty > 0 && (
            <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-2 py-1 rounded-full font-mono">
              −{(extracted.confidencePenalty * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
      </div>

      {/* Field grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((row) => (
          <div key={row.key} ref={(el) => { fieldRefs.current[row.key] = el; }}>
            <InlineFieldRow
              row={row}
              isEditing={editingKey === row.key}
              editDraft={editingKey === row.key ? editDraft : ""}
              onEditDraftChange={setEditDraft}
              onStartEdit={() => startEdit(row.key)}
              onSave={() => saveEdit(row.key)}
              onCancel={cancelEdit}
              isEdited={editedKeys.has(row.key)}
              flashKey={flashKey}
            />
          </div>
        ))}
      </div>

      {/* Notes */}
      {extracted.notes && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Extracted Notes</div>
          {extracted.notes}
        </div>
      )}

      {/* Missing-field guardrail nudge */}
      {showNudge && hasCriticalMissing && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-2">
            <span className="text-amber-500 text-base mt-0.5 shrink-0">⚠</span>
            <div>
              <div className="text-sm font-semibold text-amber-900">
                Missing critical fields: {extracted.missingCritical.map(fieldLabel).join(", ")}.
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Add them for a higher-confidence result, or run anyway with a
                {" "}{(extracted.confidencePenalty * 100).toFixed(0)}% confidence reduction.
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAddMissingFields}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm px-4 py-2 transition-colors"
            >
              Add missing fields
            </button>
            <button
              type="button"
              onClick={() => { setShowNudge(false); onRunCouncil(); }}
              className="rounded-lg border border-amber-400 bg-white hover:bg-amber-50 text-amber-800 font-medium text-sm px-4 py-2 transition-colors"
            >
              Run anyway
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap pt-1">
        <button
          onClick={handleRunClick}
          disabled={isRunning || (extracted.community == null && extracted.developer == null && extracted.askingPriceAED == null)}
          className="flex-1 min-w-[160px] rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors"
        >
          {isRunning ? "Council deliberating…" : "Run UAE Real Estate Council →"}
        </button>
        <button
          onClick={onEdit}
          className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 text-sm transition-colors"
        >
          Edit in Structured Form
        </button>
      </div>
    </div>
  );
}

// ── Quick Paste panel ─────────────────────────────────────────────────────────
const EXAMPLE_PASTE = `Emaar Beachfront — Sunrise Bay Tower 2, 2BR apartment, 1,200 sqft.
Asking AED 3,200,000. Ready unit, motivated seller.
Annual rent potential AED 180,000 (6% gross yield area avg).
Comp PPSF from DLD: AED 2,400. Service charge AED 18/sqft/yr.
Facing sea, high floor, vacant. Dubai, developer Emaar.`;

function QuickPastePanel({
  onExtracted,
  onSwitchToStructured,
}: {
  onExtracted: (result: PropertyExtractionResult, rawText: string) => void;
  onSwitchToStructured: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const extract = trpc.uaeRealestate.extractPropertyDetails.useMutation({
    onSuccess: (data) => {
      onExtracted(data as PropertyExtractionResult, text);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function handleAnalyze() {
    if (text.trim().length < 10) {
      setError("Please paste at least a few lines of property description.");
      return;
    }
    setError(null);
    extract.mutate({ text: text.trim() });
  }

  function handleExample() {
    setText(EXAMPLE_PASTE);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
          Quick Paste Mode
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExample}
            className="text-xs text-sky-600 hover:text-sky-800 underline underline-offset-2 transition-colors"
          >
            Load example
          </button>
          <button
            type="button"
            onClick={onSwitchToStructured}
            className="text-xs text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1 transition-colors"
          >
            Advanced structured input ↗
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={8}
        placeholder="Paste property listing, WhatsApp message, broker note, or investment summary here…

Example: 'Emaar Beachfront 2BR, 1,200 sqft, asking AED 3.2M, sea view, ready unit, DLD comp PPSF AED 2,400, annual rent AED 180K'"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none leading-relaxed"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={extract.isPending || text.trim().length < 10}
          className="flex-1 min-w-[160px] rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors"
        >
          {extract.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Analyzing property…
            </span>
          ) : "Analyze Property →"}
        </button>
        <div className="text-xs text-slate-400">
          AI extracts structured fields · No hallucination · Off-plan auto-detected
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm p-3">
          {error}
        </div>
      )}
    </div>
  );
}

// ── Structured form (power user mode) ────────────────────────────────────────
const SEED = {
  propertyType:    "ready"      as PropertyType,
  assetClass:      "apartment"  as AssetClass,
  emirate:         "dubai"      as Emirate,
  community:       "Downtown Dubai",
  developer:       "Emaar",
  tower:           "Burj Vista",
  askingPriceAED:  2_800_000,
  areaSqft:        1_050,
  ppsfAsking:      2667,
  ppsfComps:       2500,
  annualRentAED:   165_000,
  serviceChargePerSqft: 20,
  completionDate:  "",
  paymentPlan:     "",
  constructionProgress: undefined as number | undefined,
  escrowVerified:  undefined as boolean | undefined,
  notes:           "Motivated seller — vacant for 4 months. Unit faces Burj Khalifa.",
};

interface StructuredFormProps {
  prefill?: PropertyExtractionResult | null;
  onBack: () => void;
  onResult: (r: ARECouncilResult) => void;
}

function StructuredForm({ prefill, onBack, onResult }: StructuredFormProps) {
  const [propertyType, setPropertyType]   = useState<PropertyType>(prefill?.propertyType ?? SEED.propertyType);
  const [assetClass, setAssetClass]       = useState<AssetClass>(prefill?.assetClass ?? SEED.assetClass);
  const [emirate, setEmirate]             = useState<Emirate>(prefill?.emirate ?? SEED.emirate);
  const [community, setCommunity]         = useState(prefill?.community ?? SEED.community);
  const [developer, setDeveloper]         = useState(prefill?.developer ?? SEED.developer);
  const [tower, setTower]                 = useState(prefill?.tower ?? SEED.tower);
  const [askingPrice, setAskingPrice]     = useState(prefill?.askingPriceAED != null ? String(prefill.askingPriceAED) : String(SEED.askingPriceAED));
  const [areaSqft, setAreaSqft]           = useState(prefill?.areaSqft != null ? String(prefill.areaSqft) : String(SEED.areaSqft));
  const [ppsfComps, setPpsfComps]         = useState(prefill?.ppsfComps != null ? String(prefill.ppsfComps) : String(SEED.ppsfComps ?? ""));
  const [annualRent, setAnnualRent]       = useState(prefill?.annualRentAED != null ? String(prefill.annualRentAED) : String(SEED.annualRentAED));
  const [serviceCharge, setServiceCharge] = useState(prefill?.serviceChargePerSqft != null ? String(prefill.serviceChargePerSqft) : String(SEED.serviceChargePerSqft));
  const [completionDate, setCompletionDate] = useState(prefill?.completionDate ?? SEED.completionDate);
  const [paymentPlan, setPaymentPlan]     = useState(prefill?.paymentPlan ?? SEED.paymentPlan);
  const [constructionPct, setConstructionPct] = useState(prefill?.constructionProgress != null ? String(prefill.constructionProgress) : "");
  const [escrowVerified, setEscrowVerified]   = useState<boolean | undefined>(prefill?.escrowVerified ?? undefined);
  const [notes, setNotes]                 = useState(prefill?.notes ?? SEED.notes);
  const [error, setError]                 = useState<string | null>(null);

  const council = trpc.uaeRealestate.run.useMutation({
    onSuccess: (data) => {
      onResult(data as ARECouncilResult);
      setError(null);
      setTimeout(() => {
        document.getElementById("are-verdict")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const asking = parseFloat(askingPrice.replace(/,/g, ""));
    const area   = parseFloat(areaSqft.replace(/,/g, ""));

    council.mutate({
      propertyType,
      assetClass,
      emirate,
      community: community.trim(),
      developer: developer.trim(),
      tower:     tower.trim() || undefined,
      askingPriceAED: asking,
      areaSqft:       area,
      ppsfAsking:     area > 0 ? Math.round(asking / area) : undefined,
      ppsfComps:      ppsfComps ? parseFloat(ppsfComps) : undefined,
      annualRentAED:  annualRent ? parseFloat(annualRent.replace(/,/g, "")) : undefined,
      serviceChargePerSqft: serviceCharge ? parseFloat(serviceCharge) : undefined,
      completionDate:       completionDate || undefined,
      paymentPlan:          paymentPlan || undefined,
      constructionProgress: constructionPct ? parseFloat(constructionPct) : undefined,
      escrowVerified:       escrowVerified,
      notes:                notes || undefined,
    });
  }

  const ppsfCalc = (() => {
    const a = parseFloat(askingPrice.replace(/,/g, ""));
    const s = parseFloat(areaSqft.replace(/,/g, ""));
    return a > 0 && s > 0 ? Math.round(a / s) : null;
  })();

  const grossYieldCalc = (() => {
    const r = parseFloat(annualRent.replace(/,/g, ""));
    const a = parseFloat(askingPrice.replace(/,/g, ""));
    return r > 0 && a > 0 ? ((r / a) * 100).toFixed(2) : null;
  })();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          ← Back to Quick Paste
        </button>
        {prefill && (
          <span className="text-xs text-sky-600 italic">
            Pre-filled from extracted details — edit as needed
          </span>
        )}
      </div>

      {/* Property basics */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Property</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Type</span>
            <select
              value={propertyType}
              onChange={e => setPropertyType(e.target.value as PropertyType)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ready">Ready</option>
              <option value="off_plan">Off-Plan</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Asset Class</span>
            <select
              value={assetClass}
              onChange={e => setAssetClass(e.target.value as AssetClass)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="apartment">Apartment</option>
              <option value="villa">Villa</option>
              <option value="townhouse">Townhouse</option>
              <option value="penthouse">Penthouse</option>
              <option value="commercial">Commercial</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Emirate</span>
            <select
              value={emirate}
              onChange={e => setEmirate(e.target.value as Emirate)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="dubai">Dubai</option>
              <option value="abu_dhabi">Abu Dhabi</option>
              <option value="sharjah">Sharjah</option>
              <option value="ras_al_khaimah">Ras Al Khaimah</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block md:col-span-1">
            <span className="text-xs uppercase tracking-wider text-slate-500">Community / Area *</span>
            <input
              required
              value={community}
              onChange={e => setCommunity(e.target.value)}
              placeholder="e.g. Downtown Dubai"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Developer *</span>
            <input
              required
              value={developer}
              onChange={e => setDeveloper(e.target.value)}
              placeholder="e.g. Emaar"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Tower / Building</span>
            <input
              value={tower}
              onChange={e => setTower(e.target.value)}
              placeholder="optional"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Asking Price (AED) *</span>
            <input
              required
              value={askingPrice}
              onChange={e => setAskingPrice(e.target.value)}
              placeholder="e.g. 2800000"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Area (sqft) *</span>
            <input
              required
              value={areaSqft}
              onChange={e => setAreaSqft(e.target.value)}
              placeholder="e.g. 1050"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <div className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">PPSF (calculated)</span>
            <div className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-600">
              {ppsfCalc ? `AED ${fmt(ppsfCalc)}/sqft` : "—"}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Comp PPSF (DLD)</span>
            <input
              value={ppsfComps}
              onChange={e => setPpsfComps(e.target.value)}
              placeholder="e.g. 2500"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Annual Rent (AED)</span>
            <input
              value={annualRent}
              onChange={e => setAnnualRent(e.target.value)}
              placeholder="e.g. 165000"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Service Charge (AED/sqft/yr)</span>
            <input
              value={serviceCharge}
              onChange={e => setServiceCharge(e.target.value)}
              placeholder="e.g. 20"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
        </div>
        {grossYieldCalc && (
          <div className="text-xs text-slate-500 font-mono">
            Gross yield: <span className="text-emerald-700 font-bold">{grossYieldCalc}%</span>
          </div>
        )}
      </section>

      {/* Off-plan specifics (conditional) */}
      {propertyType === "off_plan" && (
        <section className="bg-amber-50 rounded-xl border border-amber-300 p-5 space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
            Off-Plan Protocol Active
          </h2>
          <p className="text-xs text-amber-700 italic">
            Payment &amp; Delivery Risk Agent will assess cash-flow pressure, delay probability, and forfeiture exposure.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-slate-500">Completion Date</span>
              <input
                value={completionDate}
                onChange={e => setCompletionDate(e.target.value)}
                placeholder="e.g. Q4 2026"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-slate-500">Payment Plan</span>
              <input
                value={paymentPlan}
                onChange={e => setPaymentPlan(e.target.value)}
                placeholder="e.g. 40/60 post-handover"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-slate-500">Construction Progress (%)</span>
              <input
                value={constructionPct}
                onChange={e => setConstructionPct(e.target.value)}
                placeholder="e.g. 35"
                type="number" min="0" max="100"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-slate-500">Escrow Verified</span>
              <select
                value={escrowVerified === undefined ? "" : String(escrowVerified)}
                onChange={e => setEscrowVerified(e.target.value === "" ? undefined : e.target.value === "true")}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Not specified</option>
                <option value="true">Yes — RERA escrow confirmed</option>
                <option value="false">No / not confirmed</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {/* Analyst notes */}
      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Analyst Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Motivated seller, recent renovation, proximity to Metro, any other context..."
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
          />
        </label>
      </section>

      {/* Submit */}
      <button
        type="submit"
        disabled={council.isPending}
        className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors"
      >
        {council.isPending ? "Council deliberating…" : "Submit to UAE Real Estate Council"}
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm p-3">
          {error}
        </div>
      )}
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type UIMode = "paste" | "extracted" | "structured";

export default function UaeRealEstateCouncil() {
  const [mode, setMode]                     = useState<UIMode>("paste");
  const [extracted, setExtracted]           = useState<PropertyExtractionResult | null>(null);
  const [rawPastedText, setRawPastedText]   = useState<string>("");
  const [result, setResult]                 = useState<ARECouncilResult | null>(null);
  const [councilError, setCouncilError]     = useState<string | null>(null);

  const council = trpc.uaeRealestate.run.useMutation({
    onSuccess: (data) => {
      setResult(data as ARECouncilResult);
      setCouncilError(null);
      setTimeout(() => {
        document.getElementById("are-verdict")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    onError: (err) => {
      setCouncilError(err.message);
    },
  });

  function handleExtracted(ex: PropertyExtractionResult, rawText: string) {
    setExtracted(ex);
    setRawPastedText(rawText);
    setResult(null);
    setCouncilError(null);
    setMode("extracted");
  }

  // Apply inline field edits back to the extracted state
  function handleFieldEdit(key: keyof PropertyExtractionResult, rawValue: string) {
    if (!extracted) return;
    const updated = { ...extracted } as Record<string, unknown>;
    const numericKeys = ["askingPriceAED", "areaSqft", "ppsfAsking", "ppsfComps", "annualRentAED", "serviceChargePerSqft", "constructionProgress"];
    if (numericKeys.includes(key as string)) {
      const n = parseFloat(rawValue);
      updated[key as string] = rawValue === "" ? null : isNaN(n) ? null : n;
    } else if (key === "escrowVerified") {
      updated[key] = rawValue === "" ? null : rawValue.toLowerCase().startsWith("y");
    } else {
      updated[key as string] = rawValue === "" ? null : rawValue;
    }
    // Recompute missingCritical
    const criticalKeys = ["community", "developer", "askingPriceAED", "areaSqft"] as const;
    const newMissing = criticalKeys.filter(k => updated[k] == null);
    updated["missingCritical"] = newMissing;
    updated["confidencePenalty"] = Math.min(0.4, newMissing.length * 0.1);
    setExtracted(updated as unknown as PropertyExtractionResult);
  }

  function handleRunCouncilFromExtracted() {
    if (!extracted) return;
    setCouncilError(null);

    const asking = extracted.askingPriceAED ?? 0;
    const area   = extracted.areaSqft ?? 0;

    if (asking <= 0 || area <= 0) {
      setCouncilError("Asking price and area are required to run the council. Please use 'Edit in Structured Form' to fill them in.");
      return;
    }

    council.mutate({
      propertyType:    extracted.propertyType ?? (extracted.offPlanDetected ? "off_plan" : "ready"),
      assetClass:      extracted.assetClass ?? "apartment",
      emirate:         extracted.emirate ?? "dubai",
      community:       extracted.community ?? "Unknown Community",
      developer:       extracted.developer ?? "Unknown Developer",
      tower:           extracted.tower ?? undefined,
      askingPriceAED:  asking,
      areaSqft:        area,
      ppsfAsking:      area > 0 ? Math.round(asking / area) : undefined,
      ppsfComps:       extracted.ppsfComps ?? undefined,
      annualRentAED:   extracted.annualRentAED ?? undefined,
      serviceChargePerSqft: extracted.serviceChargePerSqft ?? undefined,
      completionDate:  extracted.completionDate ?? undefined,
      paymentPlan:     extracted.paymentPlan ?? undefined,
      constructionProgress: extracted.constructionProgress ?? undefined,
      escrowVerified:  extracted.escrowVerified ?? undefined,
      notes:           [extracted.notes, rawPastedText ? `[Source text]: ${rawPastedText.slice(0, 400)}` : ""]
                         .filter(Boolean).join("\n\n") || undefined,
    });
  }

  function handleEditInStructured() {
    setMode("structured");
  }

  function handleBackToPaste() {
    setMode(extracted ? "extracted" : "paste");
  }

  function handleAnalyzeAnother() {
    setResult(null);
    setExtracted(null);
    setRawPastedText("");
    setCouncilError(null);
    setMode("paste");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

   return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Public Top Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800 tracking-tight">AgenThink Mesh</span>
          <div className="flex items-center gap-5">
            <a href="/" className="text-xs text-slate-600 hover:text-sky-600 transition-colors font-medium">UAE Real Estate</a>
            <a href="/home#examples" className="text-xs text-slate-600 hover:text-sky-600 transition-colors">Examples</a>
            <a href="/contact" className="text-xs text-slate-600 hover:text-sky-600 transition-colors">Contact</a>
            <a href="/home" className="text-xs bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-md transition-colors font-medium">Open Dashboard</a>
          </div>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* ── Header ── */}
        <header className="border-b border-slate-200 pb-5">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            AgenThink Mesh · Real Estate Division
          </div>
          <h1 className="text-3xl font-serif mt-1 text-slate-900">
            UAE Real Estate Council <em className="text-sky-600">V1.8</em>
          </h1>
          <p className="text-sm text-slate-600 mt-2 italic">
            Seven specialised agents. Decision-first output: BUY · WAIT · NEGOTIATE · AVOID.
            Paste any property description to get started — or use the structured form for precision input.
          </p>
        </header>

        {/* ── Mode: Quick Paste ── */}
        {mode === "paste" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <QuickPastePanel
              onExtracted={handleExtracted}
              onSwitchToStructured={() => setMode("structured")}
            />
          </div>
        )}

        {/* ── Mode: Extracted Details ── */}
        {mode === "extracted" && extracted && (
          <div className="space-y-4">
            {/* Back to paste */}
            <button
              type="button"
              onClick={() => setMode("paste")}
              className="text-xs text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 transition-colors"
            >
              ← Back to Quick Paste
            </button>

            <DetectedDetailsCard
              extracted={extracted}
              onRunCouncil={handleRunCouncilFromExtracted}
              onEdit={handleEditInStructured}
              onFieldEdit={handleFieldEdit}
              isRunning={council.isPending}
            />

            {councilError && (
              <div className="rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm p-3">
                {councilError}
              </div>
            )}
          </div>
        )}

        {/* ── Mode: Structured Form ── */}
        {mode === "structured" && (
          <StructuredForm
            prefill={extracted}
            onBack={handleBackToPaste}
            onResult={(r) => {
              setResult(r);
              setMode(extracted ? "extracted" : "paste");
              setTimeout(() => {
                document.getElementById("are-verdict")?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
          />
        )}

        {/* ── Verdict ── */}
        {result && (
          <div id="are-verdict">
            <VerdictCard
              result={result}
              onAnalyzeAnother={handleAnalyzeAnother}
            />
          </div>
        )}

      </div>
    </div>
  );
}
