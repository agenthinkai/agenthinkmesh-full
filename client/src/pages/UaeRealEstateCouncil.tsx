// client/src/pages/UaeRealEstateCouncil.tsx
//
// UAE Real Estate Council V1.3 — user-facing intake form and verdict card.
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

// ── Seed payload (Downtown Dubai apartment — ready) ───────────────────────────
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
                    <span className="font-semibold text-sm">{agent.name}</span>
                    <span className="text-xs opacity-70">{agent.role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-white/60 px-1.5 py-0.5 rounded">
                      {agent.label}
                    </span>
                    <span className="text-xs opacity-70">
                      conf={( agent.confidence * 100).toFixed(0)}%
                    </span>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UaeRealEstateCouncil() {
  // ── form state ────────────────────────────────────────────────────
  const [propertyType, setPropertyType]   = useState<PropertyType>(SEED.propertyType);
  const [assetClass, setAssetClass]       = useState<AssetClass>(SEED.assetClass);
  const [emirate, setEmirate]             = useState<Emirate>(SEED.emirate);
  const [community, setCommunity]         = useState(SEED.community);
  const [developer, setDeveloper]         = useState(SEED.developer);
  const [tower, setTower]                 = useState(SEED.tower);
  const [askingPrice, setAskingPrice]     = useState(String(SEED.askingPriceAED));
  const [areaSqft, setAreaSqft]           = useState(String(SEED.areaSqft));
  const [ppsfComps, setPpsfComps]         = useState(String(SEED.ppsfComps));
  const [annualRent, setAnnualRent]       = useState(String(SEED.annualRentAED));
  const [serviceCharge, setServiceCharge] = useState(String(SEED.serviceChargePerSqft));
  const [completionDate, setCompletionDate] = useState(SEED.completionDate);
  const [paymentPlan, setPaymentPlan]     = useState(SEED.paymentPlan);
  const [constructionPct, setConstructionPct] = useState("");
  const [escrowVerified, setEscrowVerified]   = useState<boolean | undefined>(undefined);
  const [notes, setNotes]                 = useState(SEED.notes);

  const [result, setResult]   = useState<ARECouncilResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const council = trpc.uaeRealestate.run.useMutation({
    onSuccess: (data) => {
      setResult(data as ARECouncilResult);
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
    setResult(null);
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <header className="border-b border-slate-200 pb-5">
          <div className="text-xs uppercase tracking-widest text-slate-500">
            AgenThink Mesh · Real Estate Division
          </div>
          <h1 className="text-3xl font-serif mt-1 text-slate-900">
            UAE Real Estate Council <em className="text-sky-600">V1.3</em>
          </h1>
          <p className="text-sm text-slate-600 mt-2 italic">
            Seven specialised agents. Decision-first output: BUY · WAIT · NEGOTIATE · AVOID.
            Off-plan protocol activates automatically. Submit a property for council review.
          </p>
        </header>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-6">

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
