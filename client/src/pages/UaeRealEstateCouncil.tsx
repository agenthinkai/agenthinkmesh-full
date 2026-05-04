// client/src/pages/UaeRealEstateCouncil.tsx
//
// UAE Real Estate Council V1.4 — Quick Paste Mode (default) + Structured Mode toggle
// Decision-first: BUY / WAIT / NEGOTIATE / AVOID
// All 8 output sections rendered inline (no redirects, no new pages).

import { useState } from "react";
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

// ── Verdict card ──────────────────────────────────────────────────────────────
function VerdictCard({ result }: { result: ARECouncilResult }) {
  const [agentsOpen, setAgentsOpen] = useState(false);
  const style = DECISION_STYLE[result.decision];

  const confColor =
    result.confidenceLevel === "HIGH"   ? "text-emerald-700" :
    result.confidenceLevel === "MEDIUM" ? "text-amber-700"   : "text-red-700";

  return (
    <div className={`rounded-xl border-2 ${style.border} ${style.bg} p-6 space-y-5`}>
      {/* ── 1. Decision ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Council Decision</div>
          <div className={`text-5xl font-black font-mono ${style.text}`}>{result.decision}</div>
          {result.guardrailApplied && (
            <div className="text-xs text-amber-700 italic mt-1">
              Confidence guardrail applied — BUY downgraded to WAIT (avg confidence {(result.confidenceScore * 100).toFixed(0)}%)
            </div>
          )}
        </div>
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
      </div>

      {/* ── 2. Top Signals ── */}
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

      {/* ── 3. Key Risk ── */}
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

      {/* ── 4. Investment Thesis ── */}
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Investment Thesis</div>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{result.investmentThesis}</p>
      </div>

      {/* ── 5. Entry Range ── */}
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

      {/* ── 6. Strategic View ── */}
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">Strategic View</div>
        <p className="text-sm text-slate-600 italic leading-relaxed">{result.strategicView}</p>
      </div>

      {/* ── 7. Off-Plan Risk Summary ── */}
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

      {/* ── 8. Agent Breakdown (collapsed) ── */}
      <div>
        <button
          onClick={() => setAgentsOpen(v => !v)}
          className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 hover:text-slate-800 transition-colors"
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
    </div>
  );
}

// ── Detected Details Card ─────────────────────────────────────────────────────
function DetectedDetailsCard({
  extracted,
  onRunCouncil,
  onEdit,
  isRunning,
}: {
  extracted: PropertyExtractionResult;
  onRunCouncil: () => void;
  onEdit: () => void;
  isRunning: boolean;
}) {
  const hasCriticalMissing = extracted.missingCritical.length > 0;

  const rows: Array<{ key: string; value: string | null; critical: boolean }> = [
    { key: "propertyType",         value: extracted.propertyType,         critical: false },
    { key: "assetClass",           value: extracted.assetClass,           critical: false },
    { key: "emirate",              value: extracted.emirate,              critical: false },
    { key: "community",            value: extracted.community,            critical: true  },
    { key: "developer",            value: extracted.developer,            critical: true  },
    { key: "tower",                value: extracted.tower,                critical: false },
    { key: "askingPriceAED",       value: extracted.askingPriceAED != null ? `AED ${fmt(extracted.askingPriceAED)}` : null, critical: true },
    { key: "areaSqft",             value: extracted.areaSqft != null ? `${fmt(extracted.areaSqft)} sqft` : null, critical: true },
    { key: "ppsfAsking",           value: extracted.ppsfAsking != null ? `AED ${fmt(extracted.ppsfAsking)}/sqft` : null, critical: false },
    { key: "ppsfComps",            value: extracted.ppsfComps != null ? `AED ${fmt(extracted.ppsfComps)}/sqft` : null, critical: false },
    { key: "annualRentAED",        value: extracted.annualRentAED != null ? `AED ${fmt(extracted.annualRentAED)}/yr` : null, critical: false },
    { key: "serviceChargePerSqft", value: extracted.serviceChargePerSqft != null ? `AED ${extracted.serviceChargePerSqft}/sqft/yr` : null, critical: false },
    { key: "completionDate",       value: extracted.completionDate,       critical: false },
    { key: "paymentPlan",          value: extracted.paymentPlan,          critical: false },
    { key: "constructionProgress", value: extracted.constructionProgress != null ? `${extracted.constructionProgress}%` : null, critical: false },
    { key: "escrowVerified",       value: extracted.escrowVerified != null ? (extracted.escrowVerified ? "Yes — RERA confirmed" : "No / not confirmed") : null, critical: false },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-0.5">Detected Details</div>
          <div className="text-sm text-slate-600">
            Review extracted fields before running the council.
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
        {rows.map(({ key, value, critical }) => (
          <div
            key={key}
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
              value == null
                ? critical
                  ? "bg-amber-50 border border-amber-300"
                  : "bg-slate-50 border border-slate-200 opacity-60"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500 uppercase tracking-wide">{fieldLabel(key)}</div>
              {value != null ? (
                <div className="font-medium text-slate-800 truncate">{value}</div>
              ) : (
                <div className={`italic text-xs mt-0.5 ${critical ? "text-amber-700 font-semibold" : "text-slate-400"}`}>
                  {critical ? "Not found — required" : "Not found"}
                </div>
              )}
            </div>
            {value != null && (
              <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
            )}
            {value == null && critical && (
              <span className="text-amber-500 mt-0.5 shrink-0">!</span>
            )}
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

      {/* Actions */}
      <div className="flex gap-3 flex-wrap pt-1">
        <button
          onClick={onRunCouncil}
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

      {hasCriticalMissing && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <strong>Missing critical fields:</strong> {extracted.missingCritical.map(fieldLabel).join(", ")}.
          The council will still run but confidence scores will be reduced by {(extracted.confidencePenalty * 100).toFixed(0)}%.
          Use "Edit in Structured Form" to fill them in manually.
        </div>
      )}
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
            <span className="text-xs uppercase tracking-wider text-slate-500">Implied PPSF</span>
            <div className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-600">
              {ppsfCalc ? `AED ${ppsfCalc.toLocaleString()}` : "—"}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Comp PPSF — RERA/DLD (AED)</span>
            <input
              value={ppsfComps}
              onChange={e => setPpsfComps(e.target.value)}
              placeholder="e.g. 2500 (leave blank if unknown)"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
          {ppsfCalc && ppsfComps && (
            <div className="block">
              <span className="text-xs uppercase tracking-wider text-slate-500">Premium to Comps</span>
              <div className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono ${
                ppsfCalc > parseFloat(ppsfComps) * 1.05
                  ? "border-red-300 bg-red-50 text-red-700"
                  : ppsfCalc < parseFloat(ppsfComps) * 0.95
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}>
                {(((ppsfCalc - parseFloat(ppsfComps)) / parseFloat(ppsfComps)) * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Rental economics */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Rental Economics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="block">
            <span className="text-xs uppercase tracking-wider text-slate-500">Gross Yield</span>
            <div className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-600">
              {grossYieldCalc ? `${grossYieldCalc}%` : "—"}
            </div>
          </div>
        </div>
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

  function handleRunCouncilFromExtracted() {
    if (!extracted) return;
    setCouncilError(null);

    // Build the best possible request from extracted fields
    // Fall back to sensible defaults for required fields if missing
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <header className="border-b border-slate-200 pb-5">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            AgenThink Mesh · Real Estate Division
          </div>
          <h1 className="text-3xl font-serif mt-1 text-slate-900">
            UAE Real Estate Council <em className="text-sky-600">V1.4</em>
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
            <VerdictCard result={result} />
          </div>
        )}

      </div>
    </div>
  );
}
