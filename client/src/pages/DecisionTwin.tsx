// AgenThink Decision Twin — Executive Edition
// Productionized from approved HTML spec (decision-twin-pilot.html)
// Design: Warm paper (#F6F4EF) · Fraunces serif · KEO red brand · Teal accent
// DO NOT redesign. DO NOT change UX. Productionize only.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import type { CompanyTemplate, SliderState } from "@/lib/companyTemplate";
import { getTemplate, DEFAULT_TEMPLATE_ID } from "@/lib/companyTemplate";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const AI_LEAK = 3.2;
const AI_GROSS = 4.8;
const BASE_MULT = 8.5;

const CONF_MAP: Record<string, number> = {
  Exploratory: 42, Moderate: 62, "Moderate-High": 74, High: 86,
};

const POSITION: [number, number, string, string][] = [
  [0, 35, "High Risk", "var(--red)"],
  [35, 50, "Moderate Risk", "var(--gold)"],
  [50, 68, "Stable", "var(--gold)"],
  [68, 82, "Well Positioned", "var(--green)"],
  [82, 101, "Strong", "var(--green)"],
];

const GEO_GROWTH: Record<string, { g: number; r: number }> = {
  ksa: { g: 9.2, r: 3.8 }, uae: { g: 7.8, r: 2.9 },
  kw: { g: 4.1, r: 3.2 }, other: { g: 5.5, r: 4.5 },
};

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface BaseData {
  name: string;
  R0: number; E0: number; M0: number; U0: number;
  hcFee: number; hcTot: number;
  geoGrowth0: number; geoRisk0: number;
  digital0: number;
  bankingMode?: boolean;
  telcoMode?: boolean;
  engineeringMode?: boolean;
  conf: { level: string; cls: "low" | "med" | "high"; k: number; changed: number };
}

interface ComputedResult {
  revenue: number; ebitda: number; margin: number;
  ev: number; mult: number; health: number;
  capture: number; dig: number; geoRisk: number; bg: number;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function priceAt(p: number) {
  const t = p / 100;
  return {
    cap: clamp(0.05 + t * 0.55, 0.05, 0.6),
    mgn: t * 8 - 1,
    mult: t * 3,
    risk: t * 2,
  };
}

function positionOf(h: number) {
  const p = POSITION.find(x => h >= x[0] && h < x[1]) || POSITION[0];
  return { l: p[2], c: p[3] };
}

function bandOf(h: number) {
  return h >= 70 ? { l: "Resilient", c: "var(--dt-green)" }
    : h >= 45 ? { l: "Stable", c: "var(--dt-gold)" }
    : { l: "Exposed", c: "var(--dt-red)" };
}

function fM(x: number, cur = "$") { return cur + (cur === "KD" ? " " : "") + x.toFixed(0) + "M"; }
function fEV(x: number, cur = "$") {
  const pfx = cur + (cur === "KD" ? " " : "");
  return x >= 1000 ? pfx + (x / 1000).toFixed(2) + "B" : pfx + x.toFixed(0) + "M";
}
function rng(point: number, k: number) { return { lo: point * (1 - k), hi: point * (1 + k) }; }
function fMr(point: number, k: number, cur = "$") { const r = rng(point, k); return fM(r.lo, cur) + " – " + fM(r.hi, cur); }
function fEVr(point: number, k: number, cur = "$") { const r = rng(point, k); return fEV(r.lo, cur) + " – " + fEV(r.hi, cur); }

// ─── COMPUTE ENGINE ───────────────────────────────────────────────────────────

function computeResult(s: SliderState, B: BaseData): ComputedResult {
  const ai = s.ai / 100;
  const a0 = 0.15; // baseline AI adoption
  const p = priceAt(s.pricing);
  const p0 = priceAt(10);
  const aiLeak = AI_LEAK * ai * (1 - p.cap) - AI_LEAK * a0 * (1 - p0.cap);
  const dig = clamp(B.digital0 + s.daGrowth / 100 * 22, B.digital0, 45);
  const daRev = Math.max(0, dig - B.digital0) / 100 * 0.6;
  const shareF = 1 + (s.share - 8) * 0.04;
  const growthF = 1 + (s.growth - 3) / 100;
  const gccF = 1 + s.gcc / 100 * 0.18;
  const revenue = clamp(B.R0 * shareF * growthF * gccF * (1 - aiLeak / 100) * (1 + daRev), 0, 1e7);
  const aiCap = AI_GROSS * ai * p.cap - AI_GROSS * a0 * p0.cap;
  const daMgn = Math.max(0, dig - B.digital0) / 23 * 3;
  const costDrag = (s.costInfl - 5) * 0.5;
  const margin = clamp(B.M0 + aiCap + p.mgn + daMgn - costDrag, -10, 55);
  const ebitda = revenue * margin / 100;
  const geoRisk = clamp(B.geoRisk0 + s.gcc / 100 * 1.5, 1, 10);
  const bg = 0.5 * B.geoGrowth0 + (s.growth - 3) * 0.4 + s.gcc / 100 * 4
    + Math.max(0, dig - B.digital0) / 23 * 6 + ai * 1 + (s.share - 8) * 0.3 + 3;
  const mult = clamp(BASE_MULT + Math.max(0, bg - 8) * 0.3 + Math.max(0, dig - 5) * 0.08
    + p.mult + ai * 1.8 - Math.max(0, geoRisk - 4) * 0.2
    - Math.max(0, p.risk - 1.5) * 0.25 - Math.max(0, s.costInfl - 3) * 0.15, 6, 20);
  const health = clamp(Math.round(
    28 * clamp(margin / 30, 0, 1) + 22 * clamp(bg / 16, 0, 1) + 20 * p.cap
    + 16 * clamp(dig / 30, 0, 1) + 14 * clamp(1 - (geoRisk - 3) / 7, 0, 1)
  ), 0, 100);
  return { revenue, ebitda, margin, ev: ebitda * mult, mult, health, capture: p.cap, dig, geoRisk, bg };
}

function calibrateBase(
  template: CompanyTemplate,
  inputs: { rev: number; eb: number; emp: number; fee: number; util: number; geo: Record<string, number>; dig: number }
): BaseData {
  const { rev, eb, emp, fee, util, geo, dig } = inputs;
  const tot = (geo.ksa || 0) + (geo.uae || 0) + (geo.kw || 0) + (geo.other || 0) || 100;
  const gs = { ksa: (geo.ksa || 0) / tot, uae: (geo.uae || 0) / tot, kw: (geo.kw || 0) / tot, other: (geo.other || 0) / tot };
  const geoGrowth0 = gs.ksa * GEO_GROWTH.ksa.g + gs.uae * GEO_GROWTH.uae.g + gs.kw * GEO_GROWTH.kw.g + gs.other * GEO_GROWTH.other.g;
  const geoRisk0 = gs.ksa * GEO_GROWTH.ksa.r + gs.uae * GEO_GROWTH.uae.r + gs.kw * GEO_GROWTH.kw.r + gs.other * GEO_GROWTH.other.r;
  const d = template.defaults;
  const changed = [
    Math.abs(rev - d.rev) > 0.001 || Math.abs(eb - d.eb) > 0.001,
    Math.abs(emp - d.emp) > 0.001 || Math.abs(fee - d.fee) > 0.001 || Math.abs(util - d.util) > 0.001,
    Math.abs((geo.ksa || d.geo.ksa) - d.geo.ksa) > 0.001 || Math.abs((geo.uae || d.geo.uae) - d.geo.uae) > 0.001,
    Math.abs(dig - d.dig) > 0.001,
  ].filter(Boolean).length;
  const frac = changed / 4;
  const conf = frac >= 0.66
    ? { level: "High Confidence", cls: "high" as const, k: 0.07, changed }
    : frac >= 0.33
    ? { level: "Medium Confidence", cls: "med" as const, k: 0.12, changed }
    : { level: "Low Confidence", cls: "low" as const, k: 0.18, changed };
  return { name: template.name, R0: rev, E0: eb, M0: eb / rev * 100, U0: util, hcFee: fee, hcTot: emp, geoGrowth0, geoRisk0, digital0: clamp(dig, 0, 100), bankingMode: template.bankingMode ?? false, conf };
}

function computeIndicators(r: ComputedResult, s: SliderState, B: BaseData) {
  const band = (v: number, safe: number, watch: number) => v >= safe ? "safe" : v >= watch ? "watch" : "alert";
  // Banking-specific EWI for Warba — all signals reinforce the valuation rerating insight
  if (B.bankingMode) {
    const gulfMerger = s.gulfMerger ?? 0;
    const gulfConversion = s.gulfConversion ?? 0;
    const digitalAdoption = s.digitalAdoption ?? 50;
    const costToIncomeTarget = s.costToIncomeTarget ?? 43;
    const mortgageLaw = s.mortgageLaw ?? 30;
    const depositGrowth = s.depositGrowth ?? 10;
    return [
      {
        n: "Valuation Narrative Clarity",
        st: (s.growth >= 12 && digitalAdoption >= 55) ? "safe" : (s.growth >= 8 || digitalAdoption >= 45) ? "watch" : "alert",
        d: {
          safe: "Clear strategic direction — market can price the premium.",
          watch: "Narrative partially defined — valuation uncertainty persists.",
          alert: "No coherent story. Market defaults to 'merger risk'. P/B stays at 1.4x.",
        },
      },
      {
        n: "Cost-to-Income Trajectory",
        st: band(100 - costToIncomeTarget, 57, 50),
        d: {
          safe: "Cost efficiency improving — below Boubyan's 42%. Premium multiple justified.",
          watch: "Cost-to-income stable but not improving. Valuation premium at risk.",
          alert: "Cost-to-income rising. Integration costs consuming the efficiency gains.",
        },
      },
      {
        n: "Peer Bank Merger Risk",
        st: (gulfMerger < 30) ? "safe" : (gulfMerger >= 30 && gulfConversion >= 40) ? "safe" : (gulfMerger >= 30 && gulfConversion >= 20) ? "watch" : "alert",
        d: {
          safe: "Peer bank merger risk contained — clear timeline or no commitment.",
          watch: "Peer bank merger in progress — Sharia conversion timeline not yet defined.",
          alert: "Peer bank merger proceeding without conversion plan. P/B compression risk is high.",
        },
      },
      {
        n: "Digital Adoption Rate",
        st: band(digitalAdoption, 65, 50),
        d: {
          safe: "Digital adoption above 65% — platform premium narrative is credible.",
          watch: "Digital adoption building but below Boubyan benchmark.",
          alert: "Digital adoption stalling. Boubyan's P/B premium becomes structural.",
        },
      },
      {
        n: "Mortgage Law Readiness",
        st: band(mortgageLaw, 60, 30),
        d: {
          safe: "Pre-built and ready. Warba launches on approval day — Al Rajhi precedent.",
          watch: "Partial readiness. Risk of losing first-mover advantage to KFH or Boubyan.",
          alert: "Not ready. If the law passes tomorrow, Warba is 6 months behind.",
        },
      },
      {
        n: "Deposit Growth Momentum",
        st: band(depositGrowth, 10, 6),
        d: {
          safe: "Deposit growth above 10% — funding base supports balance sheet expansion.",
          watch: "Deposit growth slowing. Funding cost pressure emerging.",
          alert: "Deposit compression. Balance sheet growth constrained — limits rerating.",
        },
      },
    ];
  }
  // Generic EWI for non-banking templates
  return [
    { n: "Utilization", st: band(B.U0 + (s.growth - 5), 70, 60), d: { safe: "Demand supports a full book.", watch: "Pipeline softening — monitor.", alert: "Weak utilization threatens revenue." } },
    { n: "Digital Revenue %", st: band(r.dig, 12, 8), d: { safe: "Digital mix is building scale.", watch: "Digital still sub-scale.", alert: "Digital revenue dangerously thin." } },
    { n: "Pricing Pressure", st: band(s.pricing, 55, 25), d: { safe: "Value-based pricing protects margin.", watch: "Mixed pricing — exposed in part.", alert: "Hourly billing leaves value on the table." } },
    { n: "Proposal Win Rate", st: band(s.ai * 0.6 + s.share * 2, 55, 30), d: { safe: "Competitive and well-positioned.", watch: "Win rate under some pressure.", alert: "Losing ground on competitiveness." } },
    { n: "Margin Trend", st: band(r.margin, 15, 11), d: { safe: "Margins healthy and improving.", watch: "Margins flat to slipping.", alert: "Margins compressing — act now." } },
    { n: "Competitive Pressure", st: band(s.ai, 60, 25), d: { safe: "Prepared for new-model rivals.", watch: "Partially exposed to disruption.", alert: "Highly exposed to an AI-native rival." } },
  ];
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

function track(event: string, props?: Record<string, string | number>) {
  try {
    if ((window as unknown as { plausible?: (e: string, o?: object) => void }).plausible) {
      (window as unknown as { plausible: (e: string, o?: object) => void }).plausible(event, props ? { props } : undefined);
    }
  } catch { /* silent */ }
}

// ─── SHAREABLE URL ────────────────────────────────────────────────────────────

function encodeState(templateId: string, s: SliderState, scenario: string | null): string {
  const params = new URLSearchParams({
    t: templateId,
    ai: String(s.ai), pr: String(s.pricing), sh: String(s.share),
    gr: String(s.growth), ci: String(s.costInfl), da: String(s.daGrowth), gc: String(s.gcc),
    ...(scenario ? { sc: scenario } : {}),
  });
  return `${window.location.origin}/?${params.toString()}`;
}

function decodeStateFromURL(): { templateId: string; sliders: Partial<SliderState>; scenario: string | null } | null {
  const p = new URLSearchParams(window.location.search);
  if (!p.has("ai")) return null;
  return {
    templateId: p.get("t") || DEFAULT_TEMPLATE_ID,
    sliders: {
      ai: p.has("ai") ? Number(p.get("ai")) : undefined,
      pricing: p.has("pr") ? Number(p.get("pr")) : undefined,
      share: p.has("sh") ? Number(p.get("sh")) : undefined,
      growth: p.has("gr") ? Number(p.get("gr")) : undefined,
      costInfl: p.has("ci") ? Number(p.get("ci")) : undefined,
      daGrowth: p.has("da") ? Number(p.get("da")) : undefined,
      gcc: p.has("gc") ? Number(p.get("gc")) : undefined,
    },
    scenario: p.get("sc"),
  };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function DecisionTwin() {
  const params = useParams<{ templateId?: string }>();
  const [, setLocation] = useLocation();

  const templateId = params.templateId || DEFAULT_TEMPLATE_ID;
  const template = useMemo(() => getTemplate(templateId), [templateId]);

  // Wizard state
  const [showOnboard, setShowOnboard] = useState(false); // splash removed — go straight to twin
  const [showTwin, setShowTwin] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [genErr, setGenErr] = useState("");

  // Wizard inputs
  const [wName, setWName] = useState("");
  // Banking mode: wRev=totalAssets, wEb=netProfit, wUtil=roe, wDig=costToIncome, wFee=npl, wArch=capitalAdequacy
  const [wRev, setWRev] = useState(template.bankingMode && template.bankingDefaults ? String(template.bankingDefaults.totalAssets) : "");
  const [wEb, setWEb] = useState(template.bankingMode && template.bankingDefaults ? String(template.bankingDefaults.netProfit) : "");
  const [wEmp, setWEmp] = useState(String(template.defaults.emp));
  const [wFee, setWFee] = useState(template.bankingMode && template.bankingDefaults ? String(template.bankingDefaults.npl) : String(template.defaults.fee));
  const [wUtil, setWUtil] = useState(template.bankingMode && template.bankingDefaults ? String(template.bankingDefaults.roe) : String(template.defaults.util));
  const [wGeoKsa, setWGeoKsa] = useState(String(template.defaults.geo.ksa));
  const [wGeoUae, setWGeoUae] = useState(String(template.defaults.geo.uae));
  const [wGeoKw, setWGeoKw] = useState(String(template.defaults.geo.kw));
  const [wGeoOther, setWGeoOther] = useState(String(template.defaults.geo.other));
  const [wArch, setWArch] = useState(template.bankingMode && template.bankingDefaults ? String(template.bankingDefaults.capitalAdequacy) : String(template.defaults.svc.arch));
  const [wEng, setWEng] = useState(String(template.defaults.svc.eng));
  const [wPm, setWPm] = useState(String(template.defaults.svc.pm));
  const [wPgm, setWPgm] = useState(String(template.defaults.svc.pgm));
  const [wDa, setWDa] = useState(String(template.defaults.svc.da));
  const [wDig, setWDig] = useState(template.bankingMode && template.bankingDefaults ? String(template.bankingDefaults.costToIncome) : String(template.defaults.dig));

  // Twin state
  const [B, setB] = useState<BaseData | null>(null);
  const [BASE, setBASE] = useState<ComputedResult | null>(null);
  const [ST, setST] = useState<SliderState>({ ai: 15, pricing: 10, share: 8, growth: 3, costInfl: 5, daGrowth: 5, gcc: 10 });
  const [activeScn, setActiveScn] = useState<string | null>("current");

  const n = (v: string) => parseFloat(v) || 0;
  const geoTotal = n(wGeoKsa) + n(wGeoUae) + n(wGeoKw) + n(wGeoOther);
  const svcTotal = n(wArch) + n(wEng) + n(wPm) + n(wPgm) + n(wDa);
  const impliedMargin = n(wRev) > 0 ? (n(wEb) / n(wRev) * 100).toFixed(1) : null;

  // Auto-generate for pre-filled company modes (banking, telco, engineering)
  const hasAutoGenerated = useRef(false);
  useEffect(() => {
    if (hasAutoGenerated.current) return;
    if (template.bankingMode || template.telcoMode || template.engineeringMode || template.conglomerateMode) {
      hasAutoGenerated.current = true;
      // Small delay so the page renders before the twin appears
      const t = setTimeout(() => { validateAndGenerate(); }, 80);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.bankingMode, template.telcoMode, template.engineeringMode, template.conglomerateMode]);

  // Check URL for shared state on mount
  useEffect(() => {
    const decoded = decodeStateFromURL();
    if (decoded) {
      const tpl = getTemplate(decoded.templateId);
      const d = tpl.defaults;
      const rev = d.rev; const eb = d.eb;
      const base = calibrateBase(tpl, { rev, eb, emp: d.emp, fee: d.fee, util: d.util, geo: d.geo as unknown as Record<string, number>, dig: d.dig });
      const defaultSet = tpl.scenarios["current"]?.set || ST;
      const mergedSliders: SliderState = { ...defaultSet, ...Object.fromEntries(Object.entries(decoded.sliders).filter(([, v]) => v !== undefined)) } as SliderState;
      setB(base);
      const baseResult = computeResult(defaultSet, base);
      setBASE(baseResult);
      setST(mergedSliders);
      setActiveScn(decoded.scenario);
      setShowTwin(true);
      setShowOnboard(false);
      track("Twin Loaded from URL", { template: decoded.templateId });
    }
  }, []);

  const generate = useCallback(() => {
    let rev: number, eb: number, base: BaseData;
    if (template.bankingMode && template.bankingDefaults) {
      const bd = template.bankingDefaults;
      // Map banking figures to the generic BaseData structure
      // totalAssets → rev proxy; netProfit → eb proxy; roe → util proxy
      const totalAssets = n(wRev) || bd.totalAssets;
      const netProfit = n(wEb) || bd.netProfit;
      const roe = n(wUtil) || bd.roe;
      const cti = n(wDig) || bd.costToIncome;
      const npl = n(wFee) || bd.npl;
      const capAdeq = n(wArch) || bd.capitalAdequacy;
      // Derive a revenue proxy: net interest income ≈ 2.8% of assets (Kuwait Islamic banks)
      rev = totalAssets * 0.028;
      // Derive EBITDA proxy from net profit + provisions (approx 1.4x net profit)
      eb = netProfit * 1.4;
      const changed = [
        Math.abs(totalAssets - bd.totalAssets) > 0.1,
        Math.abs(netProfit - bd.netProfit) > 0.1,
        Math.abs(roe - bd.roe) > 0.1,
        Math.abs(cti - bd.costToIncome) > 0.1 || Math.abs(npl - bd.npl) > 0.1 || Math.abs(capAdeq - bd.capitalAdequacy) > 0.1,
      ].filter(Boolean).length;
      const frac = changed / 4;
      const conf = frac >= 0.66
        ? { level: "High Confidence", cls: "high" as const, k: 0.07, changed }
        : frac >= 0.33
        ? { level: "Medium Confidence", cls: "med" as const, k: 0.12, changed }
        : { level: "Low Confidence", cls: "low" as const, k: 0.18, changed };
      base = {
        name: wName.trim() || template.name,
        R0: rev, E0: eb, M0: eb / rev * 100,
        U0: roe, // ROE stored in U0 slot for banking
        hcFee: npl, // NPL stored in hcFee slot
        hcTot: cti, // Cost-to-income stored in hcTot slot
        geoGrowth0: 5.2, // Kuwait banking sector avg growth
        geoRisk0: 3.8,
        digital0: 18, // Warba digital banking baseline
        bankingMode: true,
        conf,
      };
    } else if (template.telcoMode && template.telcoDefaults) {
      // Telco mode: pre-filled from telcoDefaults
      const td = template.telcoDefaults;
      rev = td.revenue;
      eb = td.ebitda;
      const changed = 0;
      const conf = { level: "High Confidence", cls: "high" as const, k: 0.07, changed };
      base = {
        name: wName.trim() || template.name,
        R0: rev, E0: eb, M0: td.ebitdaMargin,
        U0: td.evEbitda, // current EV/EBITDA stored in U0
        hcFee: td.digitalRevenuePct, // digital revenue % stored in hcFee
        hcTot: td.capexRevenuePct,   // capex/revenue % stored in hcTot
        geoGrowth0: 8.5,
        geoRisk0: 3.2,
        digital0: td.digitalRevenuePct,
        telcoMode: true,
        conf,
      };
    } else if (template.engineeringMode && template.engineeringDefaults) {
      // Engineering mode: pre-filled from engineeringDefaults
      const ed = template.engineeringDefaults;
      rev = ed.revenue;
      eb = ed.ebitda;
      const changed = 0;
      const conf = { level: "Medium Confidence", cls: "med" as const, k: 0.12, changed };
      base = {
        name: wName.trim() || template.name,
        R0: rev, E0: eb, M0: ed.ebitdaMargin,
        U0: ed.utilizationRate, // utilization stored in U0
        hcFee: ed.digitalRevenuePct, // digital revenue % stored in hcFee
        hcTot: ed.fixedFeePct,       // fixed fee % stored in hcTot
        geoGrowth0: 6.5,
        geoRisk0: 3.5,
        digital0: ed.digitalRevenuePct,
        engineeringMode: true,
        conf,
      };
    } else {
      rev = n(wRev) || template.defaults.rev;
      eb = n(wEb) || template.defaults.eb;
      base = calibrateBase(template, {
        rev, eb,
        emp: n(wEmp) || template.defaults.emp,
        fee: n(wFee) || template.defaults.fee,
        util: n(wUtil) || template.defaults.util,
        geo: { ksa: n(wGeoKsa), uae: n(wGeoUae), kw: n(wGeoKw), other: n(wGeoOther) } as Record<string, number>,
        dig: n(wDig) || template.defaults.dig,
      });
    }
    const currentSet = template.scenarios["current"]?.set || ST;
    const baseResult = computeResult(currentSet, base);
    setB({ ...base, name: wName.trim() || template.name });
    setBASE(baseResult);
    setST({ ...currentSet });
    setActiveScn("current");
    setShowTwin(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    track("Twin Generated", { confidence: base.conf.level, template: templateId });
  }, [wName, wRev, wEb, wEmp, wFee, wUtil, wGeoKsa, wGeoUae, wGeoKw, wGeoOther, wArch, wEng, wPm, wPgm, wDa, wDig, template, templateId]);

  const validateAndGenerate = useCallback(() => {
    if (template.bankingMode || template.telcoMode || template.engineeringMode || template.conglomerateMode) {
      // Pre-filled modes: no required field
      setGenErr("");
      generate();
      return;
    }
    const rev = n(wRev);
    if (!(rev > 0)) { setGenErr("Enter your annual revenue to begin."); return; }
    setGenErr("");
    generate();
  }, [wRev, generate, template.bankingMode]);

  const handleEdit = useCallback(() => {
    setShowTwin(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleReset = useCallback(() => {
    if (!template) return;
    const currentSet = template.scenarios["current"]?.set || ST;
    setST({ ...currentSet });
    setActiveScn("current");
  }, [template]);

  const handleShare = useCallback(() => {
    const url = encodeState(templateId, ST, activeScn);
    setShareUrl(url);
    setShowShare(true);
    track("Share URL Generated", { template: templateId, scenario: activeScn || "custom" });
  }, [templateId, ST, activeScn]);

  const copyShare = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  }, [shareUrl]);

  const handleSlider = useCallback((key: keyof SliderState, value: number) => {
    setST(prev => ({ ...prev, [key]: value }));
    setActiveScn(null);
  }, []);

  const handleScenario = useCallback((key: string) => {
    const scn = template.scenarios[key];
    if (!scn) return;
    setST({ ...scn.set });
    setActiveScn(key);
    track("Scenario Selected", { scenario: scn.name, template: templateId });
  }, [template, templateId]);

  // Derived computations
  const result = useMemo(() => {
    if (!B) return null;
    return computeResult(ST, B);
  }, [ST, B]);

  const indicators = useMemo(() => {
    if (!result || !B) return [];
    return computeIndicators(result, ST, B);
  }, [result, ST, B]);

  const activeScnData = activeScn ? template.scenarios[activeScn] : null;
  const k = B?.conf.k ?? 0.18;
  const atBase = activeScn === "current";

  // Render recommendation
  const recData = useMemo(() => {
    if (activeScnData) return activeScnData;
    if (!result) return null;
    const bd = bandOf(result.health);
    const rec = bd.l === "Resilient"
      ? "These settings point to a resilient, high-value position. Lock in what gets you here — especially value-based pricing and digital scale."
      : bd.l === "Stable"
      ? "These settings improve on today but stop short of a defensible position. The gap is usually pricing power and digital mix."
      : "These settings leave the firm exposed — value depends on hours and efficiency leaks to clients. Pricing and digital are the levers that move you out of the danger zone.";
    return {
      rec, conf: "Exploratory" as const,
      assum: ["Based on the levers you have set, not a named scenario", "Industry-benchmark relationships apply", "No external shock modelled"],
      risks: ["Custom settings may combine in ways that need validation", "Pricing and delivery risk rise with outcome models", "Concentration and cost risks depend on your inputs"],
      acts: ["Compare this against the named scenarios", "Note which single lever moves health most", "Use it to frame the real data conversation"],
      opp: ["Reprice work toward value", "Scale digital advisory", "Capture regional growth"],
      rsk: ["Hourly billing caps upside", "Margin pressure", "New-model competition"],
    };
  }, [activeScnData, result]);

  const confPct = B ? { low: 33, med: 66, high: 90 }[B.conf.cls] : 60;

  // Gauge zone
  const gaugeHalfW = result ? Math.max(6, k * 100 * 0.9) : 10;
  const gaugeLeft = result ? clamp(result.health - gaugeHalfW, 0, 100 - 2 * gaugeHalfW) : 40;

  // Scenario EV previews
  const scenarioEVs = useMemo(() => {
    if (!B) return {};
    const out: Record<string, { ev: number; health: number }> = {};
    Object.entries(template.scenarios).forEach(([k, s]) => {
      const r = computeResult(s.set, B);
      out[k] = { ev: r.ev, health: r.health };
    });
    return out;
  }, [B, template]);

  // ─── CSS VARIABLES ──────────────────────────────────────────────────────────
  const brand = template.brand;
  const brandDark = template.brandDark;
  // Reporting currency for this twin (KD, $, AED, etc.)
  const cur = template.currency ?? "$";

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        :root {
          --paper: #F6F4EF; --surface: #FFFFFF; --ink: #1B2330;
          --muted: #6A7585; --faint: #9AA3AF; --line: #E7E3DA; --line2: #EFECE4;
          --dt-teal: #0E7C6B; --dt-teal-soft: #E3F0ED;
          --dt-gold: #B8842A; --dt-gold-soft: #F6ECD8;
          --dt-green: #2E9E6B; --dt-amber: #C8922A; --dt-red: #C2543B;
          --brand: ${brand}; --brand-dark: ${brandDark};
          --shadow: 0 1px 2px rgba(27,35,48,.04), 0 8px 28px rgba(27,35,48,.06);
          --shadow-lg: 0 12px 50px rgba(27,35,48,.16);
          --disp: 'Fraunces', Georgia, serif;
          --sans: 'Inter', system-ui, sans-serif;
        }
        .dt-body { background: var(--paper); color: var(--ink); font-family: var(--sans); line-height: 1.55; -webkit-font-smoothing: antialiased; min-height: 100vh; }
        .dt-wrap { max-width: 1120px; margin: 0 auto; padding: 0 22px; }
        .dt-num { font-variant-numeric: tabular-nums; }
        .dt-up { color: var(--dt-green); } .dt-dn { color: var(--dt-red); } .dt-flat { color: var(--faint); }

        /* Onboarding */
        .dt-ob { position: fixed; inset: 0; z-index: 120; background: rgba(20,26,36,.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 22px; }
        .dt-ob.hide { display: none; }
        .dt-ob-card { background: var(--paper); border-radius: 20px; max-width: 540px; width: 100%; box-shadow: var(--shadow-lg); overflow: hidden; animation: dt-rise .45s ease; }
        .dt-ob-top { background: linear-gradient(135deg, var(--brand), var(--brand-dark)); color: #fff; padding: 26px 30px; }
        .dt-ob-top .obk { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; opacity: .85; margin-bottom: 9px; font-weight: 600; }
        .dt-ob-top h2 { font-family: var(--disp); font-size: 27px; font-weight: 600; letter-spacing: -.01em; line-height: 1.1; }
        .dt-ob-top p { font-size: 13.5px; opacity: .92; margin-top: 9px; line-height: 1.5; }
        .dt-ob-body { padding: 24px 30px 26px; }
        .dt-ob-steps { display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px; }
        .dt-ob-step { display: flex; gap: 14px; align-items: flex-start; }
        .dt-ob-step .obn { font-family: var(--disp); font-size: 15px; font-weight: 700; color: var(--brand); background: rgba(216,30,44,.08); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; }
        .dt-ob-step .obt { font-size: 13.5px; color: #2C3645; line-height: 1.45; }
        .dt-ob-note { font-size: 11.5px; color: var(--muted); background: var(--dt-gold-soft); border-radius: 9px; padding: 11px 14px; line-height: 1.5; margin-bottom: 20px; }
        .dt-ob-go { width: 100%; font-family: var(--sans); font-size: 15px; font-weight: 600; color: #fff; background: var(--ink); border: none; border-radius: 11px; padding: 15px; cursor: pointer; transition: .15s; }
        .dt-ob-go:hover { background: #10202e; }
        .dt-ob-time { text-align: center; font-size: 11px; color: var(--faint); margin-top: 12px; }

        /* Brand bar */
        .dt-brandbar { height: 4px; background: linear-gradient(90deg, var(--brand), var(--brand-dark)); }
        .dt-wordmark { font-family: var(--disp); font-weight: 700; color: var(--brand); letter-spacing: .01em; }

        /* Wizard */
        .dt-wizard { max-width: 840px; margin: 0 auto; padding: 34px 22px 60px; }
        .dt-wz-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--brand); background: rgba(216,30,44,.08); padding: 7px 14px; border-radius: 20px; }
        .dt-wz-head { text-align: center; margin-bottom: 26px; }
        .dt-wz-head h1 { font-family: var(--disp); font-size: clamp(28px,4.5vw,42px); font-weight: 600; letter-spacing: -.02em; margin: 16px 0 10px; }
        .dt-wz-head h1 em { font-style: italic; color: var(--brand); }
        .dt-wz-head p { color: var(--muted); font-size: 14.5px; max-width: 50ch; margin: 0 auto; line-height: 1.55; }
        .dt-wz-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 24px 28px; margin-bottom: 16px; }
        .dt-wz-sec { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--dt-gold); font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .dt-wz-sec::after { content: ""; flex: 1; height: 1px; background: var(--line2); }
        .dt-wz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 24px; }
        .dt-wz-grid.three { grid-template-columns: 1fr 1fr 1fr; }
        .dt-fld { display: flex; flex-direction: column; gap: 7px; }
        .dt-fld label { font-size: 12.5px; font-weight: 600; color: var(--ink); }
        .dt-fld label .opt { font-weight: 400; color: var(--faint); font-size: 11px; }
        .dt-ip { display: flex; align-items: center; background: var(--paper); border: 1px solid var(--line); border-radius: 9px; padding: 0 13px; transition: border-color .15s, box-shadow .15s; }
        .dt-ip:focus-within { border-color: var(--dt-teal); box-shadow: 0 0 0 3px rgba(14,124,107,.08); }
        .dt-ip .pre, .dt-ip .post { font-size: 13px; color: var(--faint); font-weight: 500; }
        .dt-ip input { flex: 1; background: none; border: none; outline: none; color: var(--ink); font-size: 15px; font-weight: 600; padding: 11px 7px; width: 100%; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
        .dt-ip input::-webkit-outer-spin-button, .dt-ip input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .dt-ip.name input { font-family: var(--disp); font-weight: 600; }
        .dt-mix-tot { font-size: 11.5px; margin-top: 11px; color: var(--muted); }
        .dt-mix-tot b { font-variant-numeric: tabular-nums; }
        .dt-mix-tot.ok b { color: var(--dt-green); } .dt-mix-tot.off b { color: var(--dt-gold); }
        .dt-live { font-size: 13px; color: var(--muted); margin-top: 11px; }
        .dt-live b { color: var(--dt-teal); font-variant-numeric: tabular-nums; font-weight: 700; }
        .dt-gen { display: flex; justify-content: center; margin-top: 8px; }
        .dt-gen button { font-family: var(--sans); font-size: 16px; font-weight: 600; color: #fff; background: var(--brand); border: none; border-radius: 12px; padding: 16px 40px; cursor: pointer; box-shadow: 0 8px 26px rgba(216,30,44,.22); transition: transform .12s, box-shadow .12s; }
        .dt-gen button:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(216,30,44,.3); }
        .dt-gen-err { color: var(--brand); font-size: 12.5px; font-weight: 600; text-align: center; margin-top: 12px; min-height: 16px; }
        .dt-wz-note { text-align: center; font-size: 11.5px; color: var(--faint); margin-top: 18px; line-height: 1.7; }
        .dt-adv-toggle { display: block; width: 100%; text-align: left; font-size: 13.5px; font-weight: 600; color: var(--muted); background: none; border: 1px dashed var(--line); border-radius: 12px; padding: 15px 20px; cursor: pointer; margin-bottom: 16px; transition: .15s; }
        .dt-adv-toggle:hover { border-color: var(--dt-teal); color: var(--ink); }

        /* Twin header */
        .dt-header { position: sticky; top: 0; z-index: 40; background: rgba(246,244,239,.86); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
        .dt-brand { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 15px 0 12px; flex-wrap: wrap; }
        .dt-brand h1 { font-family: var(--disp); font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
        .dt-brand h1 b { color: var(--muted); font-weight: 600; }
        .dt-brand .calib { font-size: 11.5px; color: var(--dt-teal); margin-top: 2px; font-weight: 500; }
        .dt-hbtns { display: flex; gap: 9px; flex-wrap: wrap; }
        .dt-hbtn { font-size: 12.5px; font-weight: 600; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 9px; padding: 9px 14px; cursor: pointer; transition: .15s; }
        .dt-hbtn:hover { border-color: var(--dt-teal); color: var(--dt-teal); }
        .dt-hbtn.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
        .dt-hbtn.primary:hover { background: #10202e; }
        .dt-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: var(--line); border-top: 1px solid var(--line); }
        .dt-metric { background: rgba(246,244,239,.7); padding: 11px 0 12px; text-align: center; }
        .dt-metric .k { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 5px; }
        .dt-metric .v { font-family: var(--disp); font-size: clamp(19px,3vw,27px); font-weight: 600; line-height: 1; }
        .dt-metric .d { font-size: 11px; font-weight: 600; margin-top: 4px; min-height: 14px; }
        .dt-metric.health .v { display: inline-flex; align-items: center; gap: 8px; font-size: clamp(15px,2.3vw,21px); }
        .dt-hdot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
        .dt-metric .v.range { font-size: clamp(14px,2.1vw,19px); letter-spacing: -.01em; }
        .dt-confbar { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 9px 0; background: rgba(246,244,239,.7); border-top: 1px solid var(--line); font-size: 11.5px; color: var(--muted); flex-wrap: wrap; }
        .dt-confchip { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 5px 12px; border-radius: 20px; }
        .dt-confchip .cd { width: 7px; height: 7px; border-radius: 50%; }
        .dt-confchip.low { background: var(--dt-gold-soft); color: var(--dt-gold); } .dt-confchip.low .cd { background: var(--dt-gold); }
        .dt-confchip.med { background: var(--dt-teal-soft); color: var(--dt-teal); } .dt-confchip.med .cd { background: var(--dt-teal); }
        .dt-confchip.high { background: #E1F0E7; color: var(--dt-green); } .dt-confchip.high .cd { background: var(--dt-green); }

        /* Sections */
        .dt-section { padding: 44px 0 6px; }
        .dt-sec-head { display: flex; align-items: baseline; gap: 13px; margin-bottom: 20px; }
        .dt-sec-n { font-family: var(--disp); font-size: 15px; font-weight: 600; color: var(--dt-gold); width: 26px; flex: none; }
        .dt-sec-head h2 { font-family: var(--disp); font-size: clamp(21px,3.2vw,28px); font-weight: 600; letter-spacing: -.01em; }
        .dt-sec-head p { font-size: 13.5px; color: var(--muted); margin-top: 3px; }
        .dt-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }

        /* Overview */
        .dt-ov { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
        .dt-ov .lead { padding: 26px 28px; }
        .dt-ov .lead p { font-size: 15px; color: #2C3645; line-height: 1.65; }
        .dt-ov .lead .tag { font-family: var(--disp); font-size: 13px; color: var(--dt-teal); font-weight: 600; margin-bottom: 12px; display: block; }
        .dt-gauge { padding: 26px 28px; display: flex; flex-direction: column; justify-content: center; }
        .dt-gauge .gl { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
        .dt-gauge .gband { font-family: var(--disp); font-size: 32px; font-weight: 600; margin-bottom: 4px; }
        .dt-gtrack { height: 9px; border-radius: 6px; margin-top: 18px; background: linear-gradient(90deg,#E0A99B 0%,#E8CE97 45%,#9FCFB7 100%); position: relative; }
        .dt-gzone { position: absolute; top: -3px; height: 15px; border-radius: 8px; background: rgba(27,35,48,.18); border: 1px solid rgba(27,35,48,.4); transition: left .5s cubic-bezier(.22,1,.36,1), width .5s; }
        .dt-gscale { display: flex; justify-content: space-between; font-size: 10px; color: var(--faint); margin-top: 8px; text-transform: uppercase; letter-spacing: .06em; }
        .dt-gnote { font-size: 10.5px; color: var(--faint); margin-top: 10px; font-style: italic; }

        /* Sliders */
        .dt-sliders { padding: 24px 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px 36px; }
        .dt-sld .st { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
        .dt-sld .sn { font-size: 13.5px; font-weight: 600; }
        .dt-sld .sv { font-family: var(--disp); font-size: 16px; font-weight: 600; color: var(--dt-teal); }
        .dt-range { -webkit-appearance: none; appearance: none; width: 100%; height: 5px; border-radius: 5px; background: var(--line); outline: none; cursor: pointer; }
        .dt-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid var(--dt-teal); cursor: pointer; box-shadow: 0 2px 6px rgba(27,35,48,.18); transition: transform .1s; }
        .dt-range::-webkit-slider-thumb:hover { transform: scale(1.14); }
        .dt-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid var(--dt-teal); cursor: pointer; }
        .dt-sld .se { display: flex; justify-content: space-between; font-size: 10px; color: var(--faint); margin-top: 7px; text-transform: uppercase; letter-spacing: .05em; }
        .dt-hint { font-size: 12px; color: var(--muted); padding: 0 28px 22px; }

        /* Scenarios */
        .dt-scn-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .dt-scn { background: var(--surface); border: 1px solid var(--line); border-radius: 13px; padding: 16px 18px; cursor: pointer; text-align: left; transition: .18s; box-shadow: var(--shadow); }
        .dt-scn:hover { transform: translateY(-2px); border-color: var(--dt-teal); }
        .dt-scn.active { border-color: var(--dt-teal); background: var(--dt-teal-soft); box-shadow: 0 8px 28px rgba(14,124,107,.13); }
        .dt-scn.base.active { border-color: var(--dt-gold); background: var(--dt-gold-soft); }
        .dt-scn .sname { font-family: var(--disp); font-size: 16px; font-weight: 600; margin-bottom: 4px; }
        .dt-scn .stag { font-size: 11.5px; color: var(--muted); font-weight: 500; }
        .dt-scn.active .stag { color: var(--dt-teal); }
        .dt-scn.base.active .stag { color: var(--dt-gold); }
        .dt-scn .sev { font-family: var(--disp); font-size: 13px; font-weight: 600; color: var(--dt-gold); margin-top: 9px; }

        /* Pathways */
        .dt-paths { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .dt-pcol { padding: 22px 24px; }
        .dt-pcol h3 { font-family: var(--disp); font-size: 17px; font-weight: 600; margin-bottom: 4px; }
        .dt-pcol .psub { font-size: 12px; color: var(--muted); margin-bottom: 16px; }
        .dt-pcol.grow h3 { color: var(--dt-green); } .dt-pcol.fail h3 { color: var(--dt-red); }
        .dt-pitem { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line2); align-items: flex-start; transition: .2s; }
        .dt-pitem:first-of-type { border-top: none; }
        .dt-picon { width: 9px; height: 9px; border-radius: 50%; margin-top: 6px; flex: none; }
        .grow .dt-picon { background: var(--dt-green); } .fail .dt-picon { background: var(--dt-red); }
        .dt-ptext .pt { font-size: 13.5px; font-weight: 600; }
        .dt-ptext .pd { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .dt-pitem .pflag { margin-left: auto; font-size: 9.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; padding: 3px 8px; border-radius: 20px; align-self: center; opacity: 0; transition: .2s; white-space: nowrap; }
        .grow .pflag { background: var(--dt-teal-soft); color: var(--dt-teal); }
        .fail .pflag { background: #F6E0DA; color: var(--dt-red); }
        .dt-pitem.live .pflag { opacity: 1; }
        .dt-pitem.live { background: linear-gradient(90deg,rgba(0,0,0,.012),transparent); }

        /* EWI */
        .dt-ews { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .dt-ind { background: var(--surface); border: 1px solid var(--line); border-radius: 13px; padding: 16px 18px; box-shadow: var(--shadow); }
        .dt-ind .it { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9px; }
        .dt-ind .iname { font-size: 13px; font-weight: 600; }
        .dt-pill { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 4px 10px; border-radius: 20px; }
        .dt-pill.safe { background: #E1F0E7; color: var(--dt-green); }
        .dt-pill.watch { background: var(--dt-gold-soft); color: var(--dt-gold); }
        .dt-pill.alert { background: #F6E0DA; color: var(--dt-red); }
        .dt-ind .idesc { font-size: 12px; color: var(--muted); line-height: 1.5; }

        /* Recommendation */
        .dt-rec { padding: 26px 30px; }
        .dt-rec-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; }
        .dt-rec-main { flex: 1; min-width: 260px; }
        .dt-rec-label { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--dt-gold); font-weight: 600; margin-bottom: 8px; }
        .dt-rec-text { font-family: var(--disp); font-size: 20px; font-weight: 500; line-height: 1.4; color: var(--ink); }
        .dt-conf { min-width: 150px; }
        .dt-conf .cl { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
        .dt-conf .cv { font-family: var(--disp); font-size: 17px; font-weight: 600; margin-bottom: 8px; }
        .dt-cbar { height: 6px; border-radius: 5px; background: var(--line); }
        .dt-cbar i { display: block; height: 100%; border-radius: 5px; background: var(--dt-teal); transition: width .4s; }
        .dt-rec-cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 22px; border-top: 1px solid var(--line); padding-top: 20px; }
        .dt-rec-cols h4 { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 11px; display: flex; align-items: center; gap: 7px; }
        .dt-rec-cols h4::before { content: ""; width: 6px; height: 6px; border-radius: 50%; }
        .dt-rec-cols .assum h4::before { background: var(--dt-teal); }
        .dt-rec-cols .risks h4::before { background: var(--dt-red); }
        .dt-rec-cols .acts h4::before { background: var(--dt-gold); }
        .dt-rec-cols ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .dt-rec-cols li { font-size: 13px; color: #2C3645; padding-left: 15px; position: relative; line-height: 1.45; }
        .dt-rec-cols li::before { content: "–"; position: absolute; left: 0; color: var(--faint); }

        /* Roadmap */
        .dt-road { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        .dt-rstage { padding: 22px 24px; }
        .dt-rstage .rk { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 9px; }
        .dt-rstage.now .rk { color: var(--dt-teal); }
        .dt-rstage h3 { font-family: var(--disp); font-size: 19px; font-weight: 600; margin-bottom: 8px; }
        .dt-rstage p { font-size: 13px; color: var(--muted); line-height: 1.55; }
        .dt-rstage.now { border-color: var(--dt-teal); background: var(--dt-teal-soft); }
        .dt-roadnote { font-size: 12px; color: var(--faint); text-align: center; margin-top: 16px; line-height: 1.6; }

        /* Board overlay */
        .dt-overlay { position: fixed; inset: 0; z-index: 80; background: rgba(20,26,36,.55); backdrop-filter: blur(6px); display: none; align-items: center; justify-content: center; padding: 24px; }
        .dt-overlay.show { display: flex; }
        .dt-board { background: var(--paper); border-radius: 20px; max-width: 980px; width: 100%; max-height: 92vh; overflow: auto; box-shadow: var(--shadow-lg); padding: 38px 44px; position: relative; }
        .dt-bclose { position: absolute; top: 18px; right: 20px; font-size: 13px; font-weight: 600; color: var(--muted); background: none; border: none; cursor: pointer; padding: 6px 10px; border-radius: 7px; transition: .12s; }
        .dt-bclose:hover { color: var(--ink); }
        .dt-bhead { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 2px solid var(--ink); padding-bottom: 16px; margin-bottom: 22px; flex-wrap: wrap; }
        .dt-bhead .bk { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--dt-gold); font-weight: 600; margin-bottom: 6px; }
        .dt-bhead h2 { font-family: var(--disp); font-size: 30px; font-weight: 600; letter-spacing: -.01em; }
        .dt-bhead .blogo { font-family: var(--disp); font-size: 15px; font-weight: 600; color: var(--muted); }
        .dt-bmetrics { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
        .dt-bmetrics .bm { background: var(--surface); padding: 18px 22px; text-align: center; }
        .dt-bmetrics .bmk { font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
        .dt-bmetrics .bmv { font-family: var(--disp); font-size: 28px; font-weight: 600; }
        .dt-bcols { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-bottom: 24px; }
        .dt-bcols h3 { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 12px; font-weight: 700; }
        .dt-bcols .opp h3 { color: var(--dt-green); } .dt-bcols .rsk h3 { color: var(--dt-red); }
        .dt-bcols ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .dt-bcols li { font-size: 14px; color: #2C3645; padding-left: 24px; position: relative; line-height: 1.4; }
        .dt-bcols .opp li::before { content: "↑"; position: absolute; left: 0; color: var(--dt-green); font-weight: 700; }
        .dt-bcols .rsk li::before { content: "↓"; position: absolute; left: 0; color: var(--dt-red); font-weight: 700; }
        .dt-brec { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--dt-teal); border-radius: 10px; padding: 18px 22px; }
        .dt-brec .brk { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--dt-gold); font-weight: 600; margin-bottom: 7px; }
        .dt-brec p { font-family: var(--disp); font-size: 18px; font-weight: 500; line-height: 1.45; }
        .dt-bpdf { font-family: var(--sans); font-size: 12.5px; font-weight: 600; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 9px; padding: 9px 15px; cursor: pointer; margin-top: 6px; }
        .dt-bpdf:hover { border-color: var(--brand); color: var(--brand); }

        /* Share modal */
        .dt-share-modal { position: fixed; inset: 0; z-index: 90; background: rgba(20,26,36,.55); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 24px; }
        .dt-share-card { background: var(--paper); border-radius: 16px; max-width: 480px; width: 100%; box-shadow: var(--shadow-lg); padding: 28px 32px; position: relative; }
        .dt-share-card h3 { font-family: var(--disp); font-size: 22px; font-weight: 600; margin-bottom: 8px; }
        .dt-share-card p { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
        .dt-share-url { width: 100%; font-family: var(--sans); font-size: 12px; color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; word-break: break-all; margin-bottom: 12px; }
        .dt-share-copy { font-family: var(--sans); font-size: 14px; font-weight: 600; color: #fff; background: var(--ink); border: none; border-radius: 9px; padding: 11px 20px; cursor: pointer; transition: .15s; }
        .dt-share-copy:hover { background: #10202e; }

        /* Footer */
        .dt-footer { padding: 40px 0 60px; text-align: center; font-size: 11.5px; color: var(--faint); line-height: 1.8; }

        /* Executive Cockpit (banking-mode only) */
        .dt-cockpit { background: var(--brand-dark); color: #fff; padding: 26px 0 22px; }
        .dt-ck-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
        .dt-ck-title { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; opacity: .6; font-weight: 600; }
        .dt-ck-ts { font-size: 10px; opacity: .45; }
        .dt-ck-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
        .dt-ck-kpi { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 13px 13px 11px; }
        .dt-ck-kpi.highlight { background: rgba(255,255,255,.13); border-color: rgba(255,255,255,.22); }
        .dt-ck-kpi.alert { background: rgba(216,30,44,.2); border-color: rgba(216,30,44,.4); }
        .dt-ck-kpi.good { background: rgba(14,124,107,.2); border-color: rgba(14,124,107,.4); }
        .dt-ck-k { font-size: 9.5px; opacity: .58; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 5px; }
        .dt-ck-v { font-size: 21px; font-weight: 700; font-family: var(--disp); line-height: 1; margin-bottom: 3px; }
        .dt-ck-d { font-size: 9.5px; opacity: .52; }
        .dt-ck-bar { height: 3px; background: rgba(255,255,255,.15); border-radius: 2px; margin-top: 7px; }
        .dt-ck-bar i { display: block; height: 100%; border-radius: 2px; transition: width .4s cubic-bezier(.23,1,.32,1); }

        /* Peer Benchmarking (banking-mode only) */
        .dt-peers-wrap { overflow: hidden; border: 1px solid var(--line); border-radius: 10px; }
        .dt-peers-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; }
        .dt-peer-cell { padding: 11px 15px; font-size: 13px; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); }
        .dt-peer-cell:nth-child(4n) { border-right: none; }
        .dt-peer-cell.hdr { font-size: 9.5px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); background: #ede9e0; font-weight: 600; padding: 9px 15px; }
        .dt-peer-cell.warba { background: rgba(26,92,150,.05); font-weight: 600; }
        .dt-peer-cell.lead { color: #0E7C6B; font-weight: 700; }
        .dt-peer-cell.lag { color: #C2543B; }
        .dt-peer-note { font-size: 11px; color: var(--faint); margin-top: 10px; line-height: 1.6; }

        /* Dynamic Evolution (banking-mode only) */
        .dt-evo-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .dt-evo-stage { padding: 18px 18px 16px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
        .dt-evo-stage.now { border-color: var(--dt-teal); background: var(--dt-teal-soft); }
        .dt-evo-k { font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; font-weight: 600; }
        .dt-evo-stage.now .dt-evo-k { color: var(--dt-teal); }
        .dt-evo-stage h3 { font-family: var(--disp); font-size: 15px; font-weight: 600; margin-bottom: 5px; }
        .dt-evo-stage p { font-size: 12px; color: var(--muted); line-height: 1.5; }
        .dt-evo-items { margin-top: 9px; display: flex; flex-direction: column; gap: 4px; }
        .dt-evo-item { font-size: 11px; color: var(--muted); display: flex; gap: 5px; }
        .dt-evo-item::before { content: '·'; color: var(--dt-teal); flex-shrink: 0; font-weight: 700; }

        @media (max-width: 900px) {
          .dt-ck-grid { grid-template-columns: repeat(4,1fr); }
          .dt-peers-grid { grid-template-columns: 1fr 1fr; }
          .dt-evo-grid { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 600px) {
          .dt-ck-grid { grid-template-columns: repeat(2,1fr); }
          .dt-peers-grid { grid-template-columns: 1fr; }
          .dt-evo-grid { grid-template-columns: 1fr; }
        }

        /* Animations */
        @keyframes dt-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .dt-twin-show { animation: dt-rise .5s ease; }

        /* Print */
        /* Board Brief overlay */
        .dt-brief-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(20,26,36,.7); backdrop-filter: blur(8px); display: flex; align-items: flex-start; justify-content: center; padding: 24px 16px; overflow-y: auto; }
        .dt-brief-overlay.hide { display: none; }
        .dt-brief { background: #fff; border-radius: 16px; max-width: 760px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,.25); position: relative; font-family: var(--sans); color: #1B2330; }
        .dt-brief-inner { padding: 36px 40px 32px; }
        .dt-brief-actions { display: flex; gap: 10px; align-items: center; padding: 14px 40px; border-top: 1px solid #E7E3DA; background: #F6F4EF; border-radius: 0 0 16px 16px; }
        .dt-brief-dl { font-family: var(--sans); font-size: 13.5px; font-weight: 600; color: #fff; background: #1B2330; border: none; border-radius: 9px; padding: 10px 20px; cursor: pointer; transition: .15s; }
        .dt-brief-dl:hover { background: var(--brand); }
        .dt-brief-close { font-family: var(--sans); font-size: 13px; font-weight: 500; color: var(--muted); background: transparent; border: 1px solid var(--line); border-radius: 9px; padding: 10px 16px; cursor: pointer; transition: .15s; }
        .dt-brief-close:hover { border-color: var(--ink); color: var(--ink); }
        .dt-brief-iphone { font-size: 10px; color: var(--faint); margin-left: auto; }
        /* Brief content */
        .bb-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid var(--brand); }
        .bb-title-block h1 { font-family: var(--disp); font-size: 22px; font-weight: 600; letter-spacing: -.01em; margin: 0 0 4px; }
        .bb-title-block .bb-sub { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; font-weight: 600; }
        .bb-meta { text-align: right; font-size: 11px; color: var(--muted); line-height: 1.7; }
        .bb-meta strong { color: var(--ink); }
        .bb-section { margin-bottom: 14px; }
        .bb-section-title { font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand); margin-bottom: 5px; }
        .bb-section p, .bb-section ul { font-size: 12px; line-height: 1.55; margin: 0; color: #2C3645; }
        .bb-section ul { padding-left: 16px; }
        .bb-section ul li { margin-bottom: 3px; }
        .bb-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
        .bb-metric { background: #F6F4EF; border-radius: 8px; padding: 10px 12px; }
        .bb-metric .bmk { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 3px; }
        .bb-metric .bmv { font-size: 16px; font-family: var(--disp); font-weight: 600; color: var(--ink); }
        .bb-pb-row { display: flex; align-items: center; gap: 10px; background: #F6F4EF; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
        .bb-pb-label { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
        .bb-pb-bar { flex: 1; height: 5px; background: #E7E3DA; border-radius: 3px; position: relative; }
        .bb-pb-fill { height: 100%; border-radius: 3px; transition: width .4s; }
        .bb-pb-val { font-size: 13px; font-weight: 700; white-space: nowrap; }
        .bb-pb-peer { font-size: 11px; color: var(--muted); white-space: nowrap; }
        .bb-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
        .bb-col-head { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 5px; }
        .bb-ewi-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .bb-ewi-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
        .bb-ewi-name { font-size: 11px; color: #2C3645; flex: 1; }
        .bb-ewi-st { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 10px; }
        .bb-ewi-st.safe { background: #d4f0e8; color: #1a6b4a; }
        .bb-ewi-st.watch { background: #fef3cd; color: #7a5c00; }
        .bb-ewi-st.alert { background: #fde8e4; color: #8b2a1a; }
        .bb-rec { background: linear-gradient(135deg, var(--brand), var(--brand-dark)); color: #fff; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
        .bb-rec .bb-rec-label { font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .85; margin-bottom: 5px; }
        .bb-rec p { font-size: 12.5px; line-height: 1.55; margin: 0; }
        .bb-council { background: #F6F4EF; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px; }
        .bb-council-row { display: flex; gap: 16px; align-items: flex-start; }
        .bb-council-votes { display: flex; gap: 6px; flex-wrap: wrap; }
        .bb-vote-chip { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
        .bb-vote-chip.proceed { background: #d4f0e8; color: #1a6b4a; }
        .bb-vote-chip.caution { background: #fef3cd; color: #7a5c00; }
        .bb-vote-chip.pause { background: #fde8e4; color: #8b2a1a; }
        .bb-disclaimer { font-size: 9px; color: var(--faint); border-top: 1px solid #E7E3DA; padding-top: 10px; line-height: 1.5; }
        /* Board Brief — new components */
        .bb-sq { font-size: 11.5px; color: var(--brand); font-style: italic; margin-top: 4px; line-height: 1.4; }
        .bb-section { margin-bottom: 14px; }
        .bb-peer-mini { display: flex; flex-direction: column; gap: 3px; }
        .bb-pm-row { display: flex; align-items: center; gap: 10px; padding: 4px 8px; border-radius: 5px; font-size: 11px; }
        .bb-pm-row.current { background: #fde8e4; }
        .bb-pm-row.implied { background: rgba(14,124,107,0.08); font-weight: 600; }
        .bb-pm-row.target { background: #d4f0e8; }
        .bb-pm-name { flex: 1; color: #2C3645; }
        .bb-pm-pb { font-weight: 700; color: var(--ink); min-width: 36px; text-align: right; }
        .bb-pm-roe { color: var(--muted); min-width: 40px; text-align: right; font-size: 10.5px; }
        /* Peer table 5-column grid */
        .dt-peers-grid5 { display: grid; grid-template-columns: 2fr 1fr 1fr 1.2fr 1.2fr; gap: 0; }
        .dt-peers-legend { display: flex; gap: 16px; margin: 10px 0 6px; flex-wrap: wrap; }
        .dt-pl-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); }
        .dt-pl-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
        .dt-pl-dot.lead { background: #0E7C6B; }
        .dt-pl-dot.lag { background: #D81E2C; }
        .dt-peers-insight { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
        .dt-pi-row { display: flex; gap: 10px; font-size: 11.5px; line-height: 1.5; color: #2C3645; }
        .dt-pi-label { font-weight: 700; color: var(--ink); white-space: nowrap; min-width: 130px; }
        /* Data Sources & Freshness panel */
        .dt-ds-bar { background: #F6F4EF; border-top: 1px solid #E7E3DA; border-bottom: 1px solid #E7E3DA; padding: 14px 0; }
        .dt-ds-inner { display: flex; gap: 0; align-items: flex-start; }
        .dt-ds-col { flex: 1; padding: 0 20px; }
        .dt-ds-col--narrow { flex: 0 0 160px; }
        .dt-ds-col--wide { flex: 1.4; }
        .dt-ds-divider { width: 1px; background: #E7E3DA; align-self: stretch; flex: none; }
        .dt-ds-label { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; }
        .dt-ds-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
        .dt-ds-list li { font-size: 11px; color: #2C3645; line-height: 1.4; padding-left: 10px; position: relative; }
        .dt-ds-list li::before { content: '\u2013'; position: absolute; left: 0; color: var(--muted); }
        .dt-ds-date { font-size: 14px; font-weight: 700; font-family: var(--disp); color: var(--ink); }
        .dt-ds-disclaimer { font-size: 11.5px; line-height: 1.6; color: #4A5568; display: flex; align-items: flex-start; gap: 7px; }
        .dt-ds-shield { font-size: 8px; color: #0E7C6B; flex: none; margin-top: 3px; }
        @media (max-width: 760px) {
          .dt-ds-inner { flex-direction: column; gap: 12px; }
          .dt-ds-divider { width: 100%; height: 1px; align-self: auto; }
          .dt-ds-col--narrow, .dt-ds-col--wide { flex: 1; }
        }

        /* Print — brief only */
        @media print {
          body * { visibility: hidden !important; }
          .dt-brief-overlay, .dt-brief-overlay * { visibility: visible !important; }
          .dt-brief-overlay { position: absolute !important; inset: 0 !important; background: #fff !important; backdrop-filter: none !important; display: block !important; padding: 0 !important; overflow: visible !important; }
          .dt-brief { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
          .dt-brief-inner { padding: 20px 26px !important; }
          .dt-brief-actions { display: none !important; }
          .dt-overlay, .dt-overlay * { visibility: hidden !important; }
          @page { size: A4; margin: 10mm; }
        }

        /* Responsive */
        @media (max-width: 880px) {
          .dt-ov, .dt-paths, .dt-road { grid-template-columns: 1fr; }
          .dt-sliders { grid-template-columns: 1fr; }
          .dt-scn-grid, .dt-ews { grid-template-columns: 1fr 1fr; }
          .dt-rec-cols { grid-template-columns: 1fr; }
          .dt-bcols { grid-template-columns: 1fr; }
          .dt-board { padding: 28px 24px; }
          .dt-wz-grid, .dt-wz-grid.three { grid-template-columns: 1fr 1fr; }
          .dt-bmetrics { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .dt-strip { grid-template-columns: 1fr 1fr; }
          .dt-scn-grid, .dt-ews, .dt-bmetrics { grid-template-columns: 1fr; }
          .dt-wz-grid, .dt-wz-grid.three { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <div className="dt-body">
        {/* Onboarding overlay — removed for executive experience */}

        {/* Brand bar */}
        <div className="dt-brandbar" />

        {/* Wizard */}
        {!showTwin && (
          <div className="dt-wizard">
            <div className="dt-wz-head">
              <span className="dt-wz-badge">● Decision Twin · 5 minutes</span>
              <h1>Explore <em>your</em> strategic future</h1>
              <p>{template.bankingMode
                ? "Banking figures are pre-filled from public disclosures. Override any field, or click Generate to begin immediately."
                : "Enter your company's headline numbers to begin. Three fields are enough — add more detail later to sharpen the picture."
              }</p>
            </div>

            <div className="dt-wz-card">
              <div className="dt-wz-sec">Company</div>
              <div className="dt-fld">
                <label>Company name</label>
                <div className="dt-ip name"><input type="text" placeholder={template.name} value={wName} onChange={e => setWName(e.target.value)} /></div>
              </div>
            </div>

            {template.bankingMode ? (
              <div className="dt-wz-card">
                <div className="dt-wz-sec">Banking headline figures</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
                  Pre-filled from public disclosures (KPMG YE25 · Warba Annual Report 2024). Override with more recent figures if available.
                </div>
                <div className="dt-wz-grid three">
                  <div className="dt-fld">
                    <label>Total Assets</label>
                    <div className="dt-ip"><span className="pre">KD</span><input type="number" placeholder={String(template.bankingDefaults?.totalAssets ?? '')} value={wRev} onChange={e => setWRev(e.target.value)} /><span className="post">M</span></div>
                  </div>
                  <div className="dt-fld">
                    <label>Net Profit</label>
                    <div className="dt-ip"><span className="pre">KD</span><input type="number" placeholder={String(template.bankingDefaults?.netProfit ?? '')} value={wEb} onChange={e => setWEb(e.target.value)} /><span className="post">M</span></div>
                  </div>
                  <div className="dt-fld">
                    <label>Return on Equity</label>
                    <div className="dt-ip"><input type="number" placeholder={String(template.bankingDefaults?.roe ?? '')} value={wUtil} onChange={e => setWUtil(e.target.value)} /><span className="post">%</span></div>
                  </div>
                  <div className="dt-fld">
                    <label>Cost-to-Income</label>
                    <div className="dt-ip"><input type="number" placeholder={String(template.bankingDefaults?.costToIncome ?? '')} value={wDig} onChange={e => setWDig(e.target.value)} /><span className="post">%</span></div>
                  </div>
                  <div className="dt-fld">
                    <label>NPL Ratio</label>
                    <div className="dt-ip"><input type="number" placeholder={String(template.bankingDefaults?.npl ?? '')} value={wFee} onChange={e => setWFee(e.target.value)} /><span className="post">%</span></div>
                  </div>
                  <div className="dt-fld">
                    <label>Capital Adequacy</label>
                    <div className="dt-ip"><input type="number" placeholder={String(template.bankingDefaults?.capitalAdequacy ?? '')} value={wArch} onChange={e => setWArch(e.target.value)} /><span className="post">%</span></div>
                  </div>
                </div>
                {template.bankingDefaults && (
                  <div className="dt-live" style={{ marginTop: 12 }}>
                    Market Cap <b>KD {template.bankingDefaults.marketCap.toLocaleString()}M</b> · P/B <b>{template.bankingDefaults.pbRatio}x</b> · Share Price <b>{template.bankingDefaults.sharePrice} fils</b> · YE25
                  </div>
                )}
              </div>
            ) : (
              <div className="dt-wz-card">
                <div className="dt-wz-sec">Headline financials</div>
                <div className="dt-wz-grid">
                  <div className="dt-fld">
                    <label>Annual Revenue</label>
                    <div className="dt-ip"><span className="pre">{cur}</span><input type="number" placeholder={String(template.defaults.rev)} value={wRev || String(template.defaults.rev)} onChange={e => setWRev(e.target.value)} /><span className="post">M</span></div>
                  </div>
                  <div className="dt-fld">
                    <label>EBITDA</label>
                    <div className="dt-ip"><span className="pre">{cur}</span><input type="number" placeholder={String(template.defaults.eb)} value={wEb || String(template.defaults.eb)} onChange={e => setWEb(e.target.value)} /><span className="post">M</span></div>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                  Pre-filled from FY2025 public disclosures. You may edit these figures to test alternative assumptions.
                </div>
                {impliedMargin && <div className="dt-live">Implied EBITDA margin <b>{impliedMargin}%</b></div>}
              </div>
            )}

            <button className="dt-adv-toggle" onClick={() => setShowAdvanced(v => !v)}>
              Advanced inputs <span style={{ fontWeight: 400, color: "var(--faint)" }}>— optional, sharpens the picture</span>
              <span style={{ float: "right", color: "var(--faint)", fontWeight: 700, fontSize: 16 }}>{showAdvanced ? "–" : "+"}</span>
            </button>

            {showAdvanced && (
              <>
                <div className="dt-wz-card">
                  <div className="dt-wz-sec">People</div>
                  <div className="dt-wz-grid three">
                    <div className="dt-fld"><label>Total employees</label><div className="dt-ip"><input type="number" value={wEmp} onChange={e => setWEmp(e.target.value)} /></div></div>
                    <div className="dt-fld"><label>Fee-earning employees</label><div className="dt-ip"><input type="number" value={wFee} onChange={e => setWFee(e.target.value)} /></div></div>
                    <div className="dt-fld"><label>Utilization rate</label><div className="dt-ip"><input type="number" value={wUtil} onChange={e => setWUtil(e.target.value)} /><span className="post">%</span></div></div>
                  </div>
                </div>

                <div className="dt-wz-card">
                  <div className="dt-wz-sec">Revenue by geography</div>
                  <div className="dt-wz-grid three">
                    <div className="dt-fld"><label>{template.geoLabels.ksa}</label><div className="dt-ip"><input type="number" value={wGeoKsa} onChange={e => setWGeoKsa(e.target.value)} /><span className="post">%</span></div></div>
                    <div className="dt-fld"><label>{template.geoLabels.uae}</label><div className="dt-ip"><input type="number" value={wGeoUae} onChange={e => setWGeoUae(e.target.value)} /><span className="post">%</span></div></div>
                    <div className="dt-fld"><label>{template.geoLabels.kw}</label><div className="dt-ip"><input type="number" value={wGeoKw} onChange={e => setWGeoKw(e.target.value)} /><span className="post">%</span></div></div>
                    <div className="dt-fld"><label>{template.geoLabels.other}</label><div className="dt-ip"><input type="number" value={wGeoOther} onChange={e => setWGeoOther(e.target.value)} /><span className="post">%</span></div></div>
                  </div>
                  <div className={`dt-mix-tot ${Math.abs(geoTotal - 100) < 0.5 ? "ok" : "off"}`}>Total <b>{geoTotal.toFixed(0)}%</b>{Math.abs(geoTotal - 100) < 0.5 ? " ✓" : " · will be normalized to 100%"}</div>
                </div>

                <div className="dt-wz-card">
                  <div className="dt-wz-sec">Revenue by service line</div>
                  <div className="dt-wz-grid three">
                    <div className="dt-fld"><label>Architecture</label><div className="dt-ip"><input type="number" value={wArch} onChange={e => setWArch(e.target.value)} /><span className="post">%</span></div></div>
                    <div className="dt-fld"><label>Engineering</label><div className="dt-ip"><input type="number" value={wEng} onChange={e => setWEng(e.target.value)} /><span className="post">%</span></div></div>
                    <div className="dt-fld"><label>Project Mgmt</label><div className="dt-ip"><input type="number" value={wPm} onChange={e => setWPm(e.target.value)} /><span className="post">%</span></div></div>
                    <div className="dt-fld"><label>Program Mgmt</label><div className="dt-ip"><input type="number" value={wPgm} onChange={e => setWPgm(e.target.value)} /><span className="post">%</span></div></div>
                    <div className="dt-fld"><label>Digital Advisory</label><div className="dt-ip"><input type="number" value={wDa} onChange={e => setWDa(e.target.value)} /><span className="post">%</span></div></div>
                    <div className="dt-fld"><label>Digital revenue <span className="opt">overall</span></label><div className="dt-ip"><input type="number" value={wDig} onChange={e => setWDig(e.target.value)} /><span className="post">%</span></div></div>
                  </div>
                  <div className={`dt-mix-tot ${Math.abs(svcTotal - 100) < 0.5 ? "ok" : "off"}`}>Total <b>{svcTotal.toFixed(0)}%</b>{Math.abs(svcTotal - 100) < 0.5 ? " ✓" : " · will be normalized to 100%"}</div>
                </div>
              </>
            )}

            <div className="dt-gen"><button onClick={validateAndGenerate}>Generate My Decision Twin →</button></div>
            {genErr && <div className="dt-gen-err">{genErr}</div>}
            <div className="dt-wz-note">No upload · no integration · manual entry only. Your numbers stay in this browser. The model is illustrative — built for ownership and exploration, to be refined with full data later.</div>
          </div>
        )}

        {/* Twin */}
        {showTwin && B && result && (
          <div className="dt-twin-show">
            <header className="dt-header">
              <div className="dt-wrap">
                <div className="dt-brand">
                  <div>
                    <h1>{B.name} <b>· Decision Twin</b></h1>
                    <div className="calib">Estimated from your inputs &amp; industry benchmarks — {cur}{cur === "KD" ? " " : ""}{B.R0.toFixed(0)}M revenue · {cur}{cur === "KD" ? " " : ""}{B.E0.toFixed(1)}M EBITDA · {B.M0.toFixed(1)}% margin</div>
                  </div>
                  <div className="dt-hbtns">
                    <button className="dt-hbtn" onClick={handleEdit}>‹ Edit data</button>
                    <button className="dt-hbtn" onClick={handleReset}>Reset</button>
                    <button className="dt-hbtn" onClick={handleShare}>Share ↗</button>
                    <button className="dt-hbtn" onClick={() => { setShowBrief(true); track("Board Brief Opened", { scenario: activeScn || "custom" }); }}>Board Brief ↓</button>
                    <button className="dt-hbtn primary" onClick={() => { setShowBoard(true); track("Board View Opened", { scenario: activeScn || "custom" }); }}>Board View</button>
                  </div>
                </div>
                <div className="dt-strip">
                  <div className="dt-metric">
                    <div className="k">Revenue</div>
                    <div className={`v dt-num${atBase ? "" : " range"}`}>{atBase ? fM(result.revenue, cur) : fMr(result.revenue, k * 0.6, cur)}</div>
                    <div className={`d ${BASE ? (result.revenue - BASE.revenue > BASE.revenue * 0.005 ? "dt-up" : result.revenue - BASE.revenue < -BASE.revenue * 0.005 ? "dt-dn" : "dt-flat") : "dt-flat"}`}>
                      {BASE && Math.abs(result.revenue - BASE.revenue) / BASE.revenue > 0.005 ? `≈ ${result.revenue > BASE.revenue ? "+" : "−"}${Math.abs((result.revenue - BASE.revenue) / BASE.revenue * 100).toFixed(0)}%` : "your baseline"}
                    </div>
                  </div>
                  <div className="dt-metric">
                    <div className="k">EBITDA</div>
                    <div className={`v dt-num${atBase ? "" : " range"}`}>{atBase ? fM(result.ebitda, cur) : fMr(result.ebitda, k * 0.8, cur)}</div>
                    <div className={`d ${BASE ? (result.ebitda - BASE.ebitda > BASE.ebitda * 0.005 ? "dt-up" : result.ebitda - BASE.ebitda < -BASE.ebitda * 0.005 ? "dt-dn" : "dt-flat") : "dt-flat"}`}>
                      {BASE && Math.abs(result.ebitda - BASE.ebitda) / BASE.ebitda > 0.005 ? `≈ ${result.ebitda > BASE.ebitda ? "+" : "−"}${Math.abs((result.ebitda - BASE.ebitda) / BASE.ebitda * 100).toFixed(0)}%` : "your baseline"}
                    </div>
                  </div>
                  <div className="dt-metric">
                    <div className="k">Enterprise Value</div>
                    <div className="v dt-num range">{fEVr(result.ev, k, cur)}</div>
                    <div className={`d ${BASE ? (result.ev - BASE.ev > BASE.ev * 0.005 ? "dt-up" : result.ev - BASE.ev < -BASE.ev * 0.005 ? "dt-dn" : "dt-flat") : "dt-flat"}`}>
                      {BASE && Math.abs(result.ev - BASE.ev) / BASE.ev > 0.005 ? `≈ ${result.ev > BASE.ev ? "+" : "−"}${Math.abs((result.ev - BASE.ev) / BASE.ev * 100).toFixed(0)}%` : "your baseline"}
                    </div>
                  </div>
                  <div className="dt-metric health">
                    <div className="k">Strategic Position</div>
                    <div className="v">
                      <span className="dt-hdot" style={{ background: positionOf(result.health).c }} />
                      <span style={{ color: positionOf(result.health).c }}>{positionOf(result.health).l}</span>
                    </div>
                    <div className={`d ${atBase ? "dt-flat" : BASE && result.health - BASE.health > 2 ? "dt-up" : BASE && result.health - BASE.health < -2 ? "dt-dn" : "dt-flat"}`}>
                      {atBase ? "your baseline" : BASE && Math.abs(result.health - BASE.health) >= 2 ? (result.health > BASE.health ? "↑ stronger" : "↓ weaker") : "≈ unchanged"}
                    </div>
                  </div>
                </div>
                {B.bankingMode && template.bankingDefaults && (() => {
                  // P/B rerating gauge: same formula as Executive Cockpit for consistency
                  // Gordon Growth Model + strategic premium — anchors baseline at market P/B ~1.4x
                  const bd = template.bankingDefaults;
                  const Ke = 0.12; const g = 0.04; const strategicPremium = 0.85;
                  // LIVE ROE: baseline ROE scaled by lever changes
                  const revenueGrowthFactor = (result.revenue - B.R0) / B.R0;
                  const digitalBonus = clamp((ST.digitalAdoption ?? 50) - 50, -20, 30) * 0.04;
                  const liveROE = clamp(bd.roe * (1 + revenueGrowthFactor * 0.5) + digitalBonus, 4, 28);
                  const gordonPBg = clamp((liveROE / 100 - g) / (Ke - g), 0.3, 4.2);
                  const premiumScaleG = clamp(1 - (liveROE - bd.roe) / 20, 0, 1);
                  const impliedPB = clamp(gordonPBg + strategicPremium * premiumScaleG, 0.5, 5.0);
                  const peerPB = 3.2; // Boubyan benchmark
                  const gapPct = ((peerPB - impliedPB) / peerPB * 100).toFixed(0);
                  const gaugeWidth = clamp((impliedPB / peerPB) * 100, 5, 100);
                  const gaugeColor = impliedPB >= peerPB * 0.9 ? "#0E7C6B" : impliedPB >= peerPB * 0.6 ? "#D4A017" : "#D81E2C";
                  return (
                    <div style={{ padding: "6px 0 4px", borderTop: "1px solid var(--line)", marginTop: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>P/B Rerating Gauge</span>
                        <div style={{ flex: 1, minWidth: 120, position: "relative", height: 6, background: "var(--line)", borderRadius: 3 }}>
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: gaugeWidth + "%", background: gaugeColor, borderRadius: 3, transition: "width 0.4s cubic-bezier(0.23,1,0.32,1)" }} />
                          {/* Boubyan benchmark marker */}
                          <div style={{ position: "absolute", left: "100%", top: -3, width: 2, height: 12, background: "#888", borderRadius: 1, transform: "translateX(-1px)" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: gaugeColor, fontVariantNumeric: "tabular-nums" }}>{impliedPB.toFixed(2)}x</span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>vs Boubyan {peerPB}x</span>
                        {impliedPB < peerPB * 0.95 && (
                          <span style={{ fontSize: 10, color: "var(--muted)", background: "var(--paper-dark,#ede9e0)", padding: "1px 6px", borderRadius: 10 }}>
                            {gapPct}% gap to close
                          </span>
                        )}
                        {impliedPB >= peerPB * 0.95 && (
                          <span style={{ fontSize: 10, color: "#0E7C6B", background: "#e6f4f1", padding: "1px 6px", borderRadius: 10 }}>Peer parity reached</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <div className="dt-confbar">
                  <span className={`dt-confchip ${B.conf.cls}`}><span className="cd" /><span>{B.conf.level}</span></span>
                  <span className="cnudge" style={{ fontSize: 11 }}>
                    {B.conf.cls === "high"
                      ? "Ranges are tight — you've described most of the business."
                      : <>Ranges reflect what you've shared. <b style={{ color: "var(--ink)", cursor: "pointer", textDecoration: "underline" }} onClick={handleEdit}>Add more detail</b> to narrow them.</>}
                  </span>
                </div>
              </div>
            </header>

            {/* 00 Executive Cockpit — banking mode only, full-width dark bar — ALL KPIs LIVE */}
            {B.bankingMode && template.bankingDefaults && (() => {
              const bd = template.bankingDefaults;
              // Gordon Growth Model: P/B = (ROE - g) / (Ke - g)
              // Ke = cost of equity ~12% for Kuwait Islamic bank; g = sustainable growth ~4%
              // At baseline ROE 8.46%: P/B = (0.0846 - 0.04) / (0.12 - 0.04) = 0.0446/0.08 = 0.558x
              // But market prices at 1.4x — reflecting option value on merger + mortgage law
              // We add a strategic premium: 0.85x for narrative/option value
              const Ke = 0.12; const g = 0.04; const strategicPremium = 0.85;
              // LIVE ROE: baseline ROE scaled by lever changes
              const revenueGrowthFactor = (result.revenue - B.R0) / B.R0;
              const digitalBonus = clamp((ST.digitalAdoption ?? 50) - 50, -20, 30) * 0.04;
              const liveROE = clamp(bd.roe * (1 + revenueGrowthFactor * 0.5) + digitalBonus, 4, 28);
              const gordonPB = clamp((liveROE / 100 - g) / (Ke - g), 0.3, 4.2);
              // Strategic premium scales down as ROE improves (less option value needed)
              const premiumScale = clamp(1 - (liveROE - bd.roe) / 20, 0, 1);
              const impliedPB = clamp(gordonPB + strategicPremium * premiumScale, 0.5, 5.0);
              const peerPB = 3.2; // Boubyan benchmark
              const gapPct = Math.max(0, ((peerPB - impliedPB) / peerPB * 100));
              const gapPctStr = gapPct.toFixed(0);
              // LIVE CTI: baseline CTI adjusted by cost inflation and digital adoption
              const ctiDigitalSaving = clamp((ST.digitalAdoption ?? 50) - 50, -20, 30) * 0.12;
              const ctiCostDrag = clamp((ST.costInfl - 5) * 0.3, -2, 6);
              const liveCTI = clamp(bd.costToIncome - ctiDigitalSaving + ctiCostDrag, 28, 70);
              // LIVE Strategic Health Score (already computed by engine)
              const healthScore = result.health;
              const councilConf = healthScore >= 65 ? "High" : healthScore >= 45 ? "Moderate" : "Low";
              const pbColor = impliedPB >= peerPB * 0.9 ? "#0E7C6B" : impliedPB >= peerPB * 0.6 ? "#D4A017" : "#D81E2C";
              const roeColor = liveROE >= 14 ? "#0E7C6B" : liveROE >= 10 ? "#D4A017" : "#D81E2C";
              const ctiColor = liveCTI <= 40 ? "#0E7C6B" : liveCTI <= 45 ? "#D4A017" : "#D81E2C";
              const kpis = [
                { k: "Current P/B", v: `${bd.pbRatio}x`, d: "Market · YE25", bar: (bd.pbRatio / peerPB) * 100, barColor: "#D81E2C", cls: "alert", live: false },
                { k: "Implied P/B", v: `${impliedPB.toFixed(2)}x`, d: "Under this scenario", bar: (impliedPB / peerPB) * 100, barColor: pbColor, cls: impliedPB >= peerPB * 0.9 ? "good" : impliedPB >= peerPB * 0.6 ? "highlight" : "alert", live: true },
                { k: "Gap to Boubyan", v: `${gapPctStr}%`, d: `Boubyan ${peerPB}x`, bar: 100 - gapPct, barColor: gapPct < 20 ? "#0E7C6B" : "#D4A017", cls: gapPct < 20 ? "good" : "highlight", live: true },
                { k: "ROE", v: `${liveROE.toFixed(1)}%`, d: "Live · scenario", bar: (liveROE / 20) * 100, barColor: roeColor, cls: liveROE >= 14 ? "good" : "highlight", live: true },
                { k: "Cost-to-Income", v: `${liveCTI.toFixed(1)}%`, d: "Live · scenario", bar: 100 - liveCTI, barColor: ctiColor, cls: liveCTI <= 40 ? "good" : "highlight", live: true },
                { k: "Capital Adequacy", v: `${bd.capitalAdequacy}%`, d: "CBK min 14%", bar: (bd.capitalAdequacy / 25) * 100, barColor: "#0E7C6B", cls: "good", live: false },
                { k: "Health Score", v: `${healthScore}/100`, d: councilConf + " confidence", bar: healthScore, barColor: healthScore >= 65 ? "#0E7C6B" : healthScore >= 45 ? "#D4A017" : "#D81E2C", cls: healthScore >= 65 ? "good" : healthScore >= 45 ? "highlight" : "alert", live: true },
              ];
              return (
                <section className="dt-cockpit">
                  <div className="dt-wrap">
                    <div className="dt-ck-head">
                      <span className="dt-ck-title">Executive Cockpit · Live</span>
                      <span className="dt-ck-ts">Scenario: {activeScnData?.name || "Custom"} · {B.conf.level} · KPIs update with every lever change</span>
                    </div>
                    <div className="dt-ck-grid">
                      {kpis.map((kpi, i) => (
                        <div key={i} className={`dt-ck-kpi ${kpi.cls}`}>
                          <div className="dt-ck-k">{kpi.k}{kpi.live && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7, letterSpacing: '0.05em' }}>LIVE</span>}</div>
                          <div className="dt-ck-v">{kpi.v}</div>
                          <div className="dt-ck-d">{kpi.d}</div>
                          <div className="dt-ck-bar"><i style={{ width: `${clamp(kpi.bar, 3, 100)}%`, background: kpi.barColor, transition: 'width 0.4s cubic-bezier(0.23,1,0.32,1)' }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* 00b Executive Cockpit — Telco mode (Zain) */}
            {B.telcoMode && template.telcoDefaults && (() => {
              const td = template.telcoDefaults;
              // LIVE EV/EBITDA: base multiple scaled by EBITDA growth from model
              const ebitdaGrowthFactor = (result.ebitda - B.E0) / Math.max(B.E0, 1);
              const liveEvEbitda = clamp(td.evEbitda * (1 + ebitdaGrowthFactor * 0.4) + (ST.pricing >= 60 ? 1.5 : ST.pricing >= 40 ? 0.5 : 0), 3, 14);
              const peerEvEbitda = td.peerEvEbitda; // e& benchmark 9x
              const gapPct = Math.max(0, ((peerEvEbitda - liveEvEbitda) / peerEvEbitda * 100));
              // LIVE EBITDA Margin: base + digital adoption improvement
              const digitalBonus = clamp((ST.daGrowth - 37) * 0.05, -3, 5);
              const costSaving = clamp((ST.ai - 18) * 0.03, -2, 4);
              const liveMargin = clamp(td.ebitdaMargin + digitalBonus + costSaving - (ST.costInfl - 5) * 0.15, 25, 48);
              // LIVE Digital Revenue %: scales with daGrowth and pricing sliders
              const liveDigital = clamp(td.digitalRevenuePct + (ST.daGrowth - 37) * 0.25 + (ST.pricing - 22) * 0.15, 10, 65);
              // LIVE Capex Efficiency: lower is better; AI reduces capex waste
              const liveCapex = clamp(td.capexRevenuePct - (ST.ai - 18) * 0.04, 14, 26);
              const healthScore = result.health;
              const councilConf = healthScore >= 65 ? "High" : healthScore >= 45 ? "Moderate" : "Low";
              const evColor = liveEvEbitda >= peerEvEbitda * 0.85 ? "#0E7C6B" : liveEvEbitda >= peerEvEbitda * 0.6 ? "#D4A017" : "#D81E2C";
              const kpis = [
                { k: "EV / EBITDA", v: `${td.evEbitda}x`, d: "Current · FY25", bar: (td.evEbitda / peerEvEbitda) * 100, barColor: "#D81E2C", cls: "alert", live: false },
                { k: "Implied EV/EBITDA", v: `${liveEvEbitda.toFixed(1)}x`, d: "Under this scenario", bar: (liveEvEbitda / peerEvEbitda) * 100, barColor: evColor, cls: liveEvEbitda >= peerEvEbitda * 0.85 ? "good" : "highlight", live: true },
                { k: "Gap to e&", v: `${gapPct.toFixed(0)}%`, d: `e& benchmark ${peerEvEbitda}x`, bar: 100 - gapPct, barColor: gapPct < 20 ? "#0E7C6B" : "#D4A017", cls: gapPct < 20 ? "good" : "highlight", live: true },
                { k: "EBITDA Margin", v: `${liveMargin.toFixed(1)}%`, d: "Live · scenario", bar: (liveMargin / 48) * 100, barColor: liveMargin >= 38 ? "#0E7C6B" : "#D4A017", cls: liveMargin >= 38 ? "good" : "highlight", live: true },
                { k: "Digital Revenue %", v: `${liveDigital.toFixed(0)}%`, d: "Live · scenario", bar: liveDigital, barColor: liveDigital >= 50 ? "#0E7C6B" : "#D4A017", cls: liveDigital >= 50 ? "good" : "highlight", live: true },
                { k: "Capex / Revenue", v: `${liveCapex.toFixed(1)}%`, d: "Live · scenario", bar: 100 - (liveCapex / 26) * 100, barColor: liveCapex <= 18 ? "#0E7C6B" : "#D4A017", cls: liveCapex <= 18 ? "good" : "highlight", live: true },
                { k: "Health Score", v: `${healthScore}/100`, d: councilConf + " confidence", bar: healthScore, barColor: healthScore >= 65 ? "#0E7C6B" : healthScore >= 45 ? "#D4A017" : "#D81E2C", cls: healthScore >= 65 ? "good" : healthScore >= 45 ? "highlight" : "alert", live: true },
              ];
              return (
                <section className="dt-cockpit">
                  <div className="dt-wrap">
                    <div className="dt-ck-head">
                      <span className="dt-ck-title">Executive Cockpit · Live</span>
                      <span className="dt-ck-ts">Scenario: {activeScnData?.name || "Custom"} · {B.conf.level} · KPIs update with every lever change</span>
                    </div>
                    <div className="dt-ck-grid">
                      {kpis.map((kpi, i) => (
                        <div key={i} className={`dt-ck-kpi ${kpi.cls}`}>
                          <div className="dt-ck-k">{kpi.k}{kpi.live && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7, letterSpacing: '0.05em' }}>LIVE</span>}</div>
                          <div className="dt-ck-v">{kpi.v}</div>
                          <div className="dt-ck-d">{kpi.d}</div>
                          <div className="dt-ck-bar"><i style={{ width: `${clamp(kpi.bar, 3, 100)}%`, background: kpi.barColor, transition: 'width 0.4s cubic-bezier(0.23,1,0.32,1)' }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* 00c Executive Cockpit — Engineering mode (KEO) */}
            {B.engineeringMode && template.engineeringDefaults && (() => {
              const ed = template.engineeringDefaults;
              // LIVE Operating Margin: base + AI productivity + pricing model shift
              const aiBonus = clamp((ST.ai - 18) * 0.08, -3, 8);
              const pricingBonus = clamp((ST.pricing - 22) * 0.06, -2, 6);
              const liveMargin = clamp(ed.ebitdaMargin + aiBonus + pricingBonus - (ST.costInfl - 5) * 0.2, 8, 32);
              // LIVE Digital Revenue %: scales with daGrowth
              const liveDigital = clamp(ed.digitalRevenuePct + (ST.daGrowth - 37) * 0.3, 2, 55);
              // LIVE Fixed Fee %: scales with pricing power
              const liveFixedFee = clamp(ed.fixedFeePct + (ST.pricing - 22) * 0.2, 5, 45);
              // LIVE Outcome %: scales with pricing and AI
              const liveOutcome = clamp(ed.outcomePct + (ST.pricing - 22) * 0.1 + (ST.ai - 18) * 0.05, 0, 30);
              // LIVE Revenue: from model
              const liveRevenue = result.revenue;
              // LIVE EBITDA: from model
              const liveEbitda = result.ebitda;
              const healthScore = result.health;
              const councilConf = healthScore >= 65 ? "High" : healthScore >= 45 ? "Moderate" : "Low";
              const kpis = [
                { k: "Revenue", v: `${cur}${cur === "KD" ? " " : ""}${liveRevenue.toFixed(0)}M`, d: "Live · scenario", bar: clamp((liveRevenue / 400) * 100, 5, 100), barColor: liveRevenue >= 300 ? "#0E7C6B" : "#D4A017", cls: "highlight", live: true },
                { k: "EBITDA", v: `${cur}${cur === "KD" ? " " : ""}${liveEbitda.toFixed(0)}M`, d: "Live · scenario", bar: clamp((liveEbitda / 80) * 100, 5, 100), barColor: liveEbitda >= 50 ? "#0E7C6B" : "#D4A017", cls: liveEbitda >= 50 ? "good" : "highlight", live: true },
                { k: "Operating Margin", v: `${liveMargin.toFixed(1)}%`, d: "Live · scenario", bar: (liveMargin / 32) * 100, barColor: liveMargin >= 20 ? "#0E7C6B" : liveMargin >= 14 ? "#D4A017" : "#D81E2C", cls: liveMargin >= 20 ? "good" : "highlight", live: true },
                { k: "Digital Revenue %", v: `${liveDigital.toFixed(0)}%`, d: "Live · scenario", bar: liveDigital, barColor: liveDigital >= 30 ? "#0E7C6B" : "#D4A017", cls: liveDigital >= 30 ? "good" : "highlight", live: true },
                { k: "Fixed Fee %", v: `${liveFixedFee.toFixed(0)}%`, d: "Live · scenario", bar: liveFixedFee, barColor: liveFixedFee >= 30 ? "#0E7C6B" : "#D4A017", cls: liveFixedFee >= 30 ? "good" : "highlight", live: true },
                { k: "Outcome-Based %", v: `${liveOutcome.toFixed(0)}%`, d: "Live · scenario", bar: liveOutcome * 2, barColor: liveOutcome >= 10 ? "#0E7C6B" : "#D4A017", cls: liveOutcome >= 10 ? "good" : "highlight", live: true },
                { k: "Health Score", v: `${healthScore}/100`, d: councilConf + " confidence", bar: healthScore, barColor: healthScore >= 65 ? "#0E7C6B" : healthScore >= 45 ? "#D4A017" : "#D81E2C", cls: healthScore >= 65 ? "good" : healthScore >= 45 ? "highlight" : "alert", live: true },
              ];
              return (
                <section className="dt-cockpit">
                  <div className="dt-wrap">
                    <div className="dt-ck-head">
                      <span className="dt-ck-title">Executive Cockpit · Live</span>
                      <span className="dt-ck-ts">Scenario: {activeScnData?.name || "Custom"} · {B.conf.level} · KPIs update with every lever change</span>
                    </div>
                    <div className="dt-ck-grid">
                      {kpis.map((kpi, i) => (
                        <div key={i} className={`dt-ck-kpi ${kpi.cls}`}>
                          <div className="dt-ck-k">{kpi.k}{kpi.live && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7, letterSpacing: '0.05em' }}>LIVE</span>}</div>
                          <div className="dt-ck-v">{kpi.v}</div>
                          <div className="dt-ck-d">{kpi.d}</div>
                          <div className="dt-ck-bar"><i style={{ width: `${clamp(kpi.bar, 3, 100)}%`, background: kpi.barColor, transition: 'width 0.4s cubic-bezier(0.23,1,0.32,1)' }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* Data Sources & Freshness panel — always visible, immediately below cockpit */}
            {template.dataSources && (
              <div className="dt-ds-bar">
                <div className="dt-wrap">
                  <div className="dt-ds-inner">
                    <div className="dt-ds-col">
                      <div className="dt-ds-label">DATA SOURCES</div>
                      <ul className="dt-ds-list">
                        {template.dataSources.sources.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="dt-ds-divider" />
                    <div className="dt-ds-col dt-ds-col--narrow">
                      <div className="dt-ds-label">LAST UPDATED</div>
                      <div className="dt-ds-date">{template.dataSources.lastUpdated}</div>
                    </div>
                    <div className="dt-ds-divider" />
                    <div className="dt-ds-col dt-ds-col--wide">
                      <div className="dt-ds-disclaimer">
                        <span className="dt-ds-shield">&#9679;</span>
                        {template.dataSources.disclaimer}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="dt-wrap">
              {/* 01 Overview */}
              <section className="dt-section">
                <div className="dt-sec-head"><span className="dt-sec-n">01</span><div>
                  <h2>{B.bankingMode ? "Why does Warba trade at 1.4x P/B?" : B.telcoMode ? "How does Zain transition from a telecom to a digital infrastructure multiple?" : B.engineeringMode ? "How does KEO capture AI productivity gains instead of giving them away?" : "Where you stand today"}</h2>
                  <p>{B.bankingMode ? "The starting point for answering the central question: how does Warba close the valuation gap with leading GCC Islamic banks?" : B.telcoMode ? "The starting point for answering the central question: how does Zain transition from 5.1x EV/EBITDA (telecom) to 8–10x EV/EBITDA (digital infrastructure)?" : B.engineeringMode ? "The starting point for answering the central question: how does KEO capture AI productivity gains instead of giving them away through time-and-materials contracts?" : "Estimated from your inputs and industry benchmarks — the starting point before any change."}</p>
                </div></div>
                <div className="dt-ov">
                  <div className="dt-card lead">
                    <span className="tag">In plain terms</span>
                    <p dangerouslySetInnerHTML={{ __html: template.overviewText }} />
                  </div>
                  <div className="dt-card dt-gauge">
                    <div className="gl">Strategic Position</div>
                    <div className="dt-gauge gband" style={{ color: positionOf(result.health).c }}>{positionOf(result.health).l}</div>
                    <div className="dt-gtrack">
                      <div className="dt-gzone" style={{ left: `${gaugeLeft}%`, width: `${2 * gaugeHalfW}%` }} />
                    </div>
                    <div className="dt-gscale"><span>Higher risk</span><span>Stable</span><span>Stronger</span></div>
                    <div className="dt-gnote">Indicative position · {B.conf.level.toLowerCase()}</div>
                  </div>
                </div>
              </section>

              {/* 02 What-If */}
              <section className="dt-section">
                <div className="dt-sec-head"><span className="dt-sec-n">02</span><div><h2>Explore your future</h2><p>Move any lever. Every number above updates instantly — measured against your own baseline.</p></div></div>
                <div className="dt-card">
                  <div className="dt-sliders">
                    {(() => {
                      const so = template.sliderOverrides || {};
                      return [
                        { key: "ai" as const, name: so.aiName || "AI Adoption", min: 0, max: 100, step: 1, ends: [so.aiLow || "None", so.aiHigh || "Fully adopted"], fmt: so.aiFmt || ((v: number) => `${v}%`) },
                        { key: "pricing" as const, name: so.pricingName || "Pricing Power", min: 0, max: 100, step: 1, ends: [so.pricingLow || "By the hour", so.pricingHigh || "By the outcome"], fmt: so.pricingFmt || ((v: number) => v < 25 ? "Hourly" : v < 60 ? "Mixed" : "Outcome") },
                        { key: "share" as const, name: so.shareName || "Market Share", min: 1, max: 20, step: 0.5, ends: [so.shareLow || "1%", so.shareHigh || "20%"], fmt: so.shareFmt || ((v: number) => `${v}%`) },
                        { key: "growth" as const, name: so.growthName || "Revenue Growth", min: -5, max: 15, step: 0.5, ends: [so.growthLow || "−5%", so.growthHigh || "15%"], fmt: so.growthFmt || ((v: number) => `${v > 0 ? "+" : ""}${v}%`) },
                        { key: "costInfl" as const, name: so.costInflName || "Cost Inflation", min: 0, max: 15, step: 0.5, ends: [so.costInflLow || "0%", so.costInflHigh || "15%"], fmt: so.costInflFmt || ((v: number) => `${v}%`) },
                        { key: "daGrowth" as const, name: so.daGrowthName || "Digital Advisory Growth", min: 0, max: 100, step: 1, ends: [so.daGrowthLow || "Current", so.daGrowthHigh || "Scaled"], fmt: so.daGrowthFmt || ((v: number) => `${v}%`) },
                        { key: "gcc" as const, name: so.gccName || "GCC Expansion", min: 0, max: 100, step: 1, ends: [so.gccLow || "Today", so.gccHigh || "Aggressive"], fmt: so.gccFmt || ((v: number) => `${v}%`) },
                      ];
                    })().map(sl => (
                      <div key={sl.key} className="dt-sld">
                        <div className="st"><span className="sn">{sl.name}</span><span className="sv">{sl.fmt(ST[sl.key])}</span></div>
                        <input type="range" className="dt-range" min={sl.min} max={sl.max} step={sl.step} value={ST[sl.key]}
                          onChange={e => handleSlider(sl.key, parseFloat(e.target.value))} />
                        <div className="se"><span>{sl.ends[0]}</span><span>{sl.ends[1]}</span></div>
                      </div>
                    ))}
                  </div>
                  <div className="dt-hint">These are the forces that shape the business. Drag to see how each one changes your revenue, profit, value, and overall strategic health.</div>
                </div>
              </section>

              {/* 03 Scenarios */}
              <section className="dt-section">
                <div className="dt-sec-head"><span className="dt-sec-n">03</span><div>
                  <h2>{B.bankingMode ? "Which pathway closes the valuation gap?" : "Six possible futures"}</h2>
                  <p>{B.bankingMode ? "Six strategic pathways — each answers: how does Warba close the gap to Boubyan's 3.2x P/B? One click sets every lever and shows the implied P/B." : "One click sets every lever — and rewrites the implications and recommendation below."}</p>
                </div></div>
                <div className="dt-scn-grid">
                  {Object.entries(template.scenarios).map(([key, scn]) => {
                    const ev = scenarioEVs[key];
                    const pos = ev ? positionOf(ev.health) : { l: "—", c: "var(--faint)" };
                    return (
                      <button key={key} className={`dt-scn${scn.base ? " base" : ""}${activeScn === key ? " active" : ""}`}
                        onClick={() => handleScenario(key)}>
                        <div className="sname">{scn.name}</div>
                        <div className="stag">{scn.tag}</div>
                        <div className="sev">≈ EV {ev ? fEV(ev.ev, cur) : "—"} · {pos.l}</div>
                        {B.bankingMode && template.bankingDefaults && ev && (() => {
                  const bd2 = template.bankingDefaults;
                  // Gordon Growth Model for scenario card P/B preview
                  const Ke2 = 0.12; const g2 = 0.04; const sp2 = 0.85;
                  // Estimate scenario ROE from health score proxy
                  const scenROE = clamp(bd2.roe * (0.5 + ev.health / 100), 4, 28);
                  const gordonPB2 = clamp((scenROE / 100 - g2) / (Ke2 - g2), 0.3, 4.2);
                  const premScale2 = clamp(1 - (scenROE - bd2.roe) / 20, 0, 1);
                  const impliedPB = clamp(gordonPB2 + sp2 * premScale2, 0.5, 5.0);
                  const peerPB = 3.2;
                          const pbColor = impliedPB >= peerPB * 0.9 ? "#0E7C6B" : impliedPB >= peerPB * 0.6 ? "#D4A017" : "#D81E2C";
                          return (
                            <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                              <span>Indicative range</span>
                              <span style={{ color: pbColor, fontWeight: 700 }}>· P/B ≈ {impliedPB.toFixed(1)}x</span>
                              <span style={{ color: "#888" }}>/ Boubyan 3.2x</span>
                            </div>
                          );
                        })()}
                        {!B.bankingMode && <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>Indicative range</div>}
                        {B.bankingMode && scn.acts?.[0] && (
                          <div style={{ fontSize: 10.5, color: 'var(--dt-teal)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line2)', lineHeight: 1.4, fontWeight: 500 }}>
                            → {scn.acts[0]}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 04 Pathways */}
              <section className="dt-section">
                <div className="dt-sec-head"><span className="dt-sec-n">04</span><div>
                  <h2>{B.bankingMode ? "What must management do next?" : "Growth and failure pathways"}</h2>
                  <p>{B.bankingMode ? "The pathways that accelerate the P/B rerating — and the traps that lock Warba at 1.4x. Status updates with every lever change." : "The paths that open — and the traps that activate — based on your current lever settings."}</p>
                </div></div>
                <div className="dt-paths">
                  <div className="dt-card dt-pcol grow">
                    <h3>Growth pathways</h3>
                    <div className="psub">Activated by your current settings</div>
                    {template.growthPaths.map((p, i) => (
                      <div key={i} className={`dt-pitem${p.live(ST) ? " live" : ""}`}>
                        <span className="dt-picon" />
                        <div className="dt-ptext"><div className="pt">{p.t}</div><div className="pd">{p.d}</div></div>
                        <span className="pflag">In play</span>
                      </div>
                    ))}
                  </div>
                  <div className="dt-card dt-pcol fail">
                    <h3>Failure pathways</h3>
                    <div className="psub">Active risks under current settings</div>
                    {template.failPaths.map((p, i) => (
                      <div key={i} className={`dt-pitem${p.live(ST) ? " live" : ""}`}>
                        <span className="dt-picon" />
                        <div className="dt-ptext"><div className="pt">{p.t}</div><div className="pd">{p.d}</div></div>
                        <span className="pflag">Active risk</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 05 EWI */}
              <section className="dt-section">
                <div className="dt-sec-head"><span className="dt-sec-n">05</span><div>
                  <h2>{B.bankingMode ? "Early warning: is the strategy failing?" : "Early warning indicators"}</h2>
                  <p>{B.bankingMode ? "Six signals that tell the Chairman whether the valuation rerating strategy is on track or failing. Status updates with every lever change." : "Six signals to watch. Status updates as you move the levers."}</p>
                </div></div>
                <div className="dt-ews">
                  {indicators.map((ind, i) => (
                    <div key={i} className="dt-ind">
                      <div className="it"><span className="iname">{ind.n}</span><span className={`dt-pill ${ind.st}`}>{ind.st}</span></div>
                      <div className="idesc">{ind.d[ind.st as keyof typeof ind.d]}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 05b Peer Benchmarking — banking mode only, 5 banks + Capital Adequacy */}
              {B.bankingMode && (
                <section className="dt-section">
                  <div className="dt-sec-head"><span className="dt-sec-n">05b</span><div><h2>Peer benchmarking</h2><p>Where does Warba stand against leading GCC Islamic banks — and which gaps can management realistically close? Source: public disclosures, KPMG YE25, Bloomberg.</p></div></div>
                  <div className="dt-peers-wrap">
                    <div className="dt-peers-grid5">
                      <div className="dt-peer-cell hdr">Bank</div>
                      <div className="dt-peer-cell hdr">P/B Ratio</div>
                      <div className="dt-peer-cell hdr">ROE</div>
                      <div className="dt-peer-cell hdr">Cost-to-Income</div>
                      <div className="dt-peer-cell hdr">Capital Adequacy</div>
                      {/* Warba */}
                      <div className="dt-peer-cell warba">Warba Bank (Kuwait)</div>
                      <div className="dt-peer-cell warba lag">1.4x</div>
                      <div className="dt-peer-cell warba lag">8.5%</div>
                      <div className="dt-peer-cell warba">43.1%</div>
                      <div className="dt-peer-cell warba lead">18.2%</div>
                      {/* Boubyan */}
                      <div className="dt-peer-cell">Boubyan Bank (Kuwait)</div>
                      <div className="dt-peer-cell lead">3.2x</div>
                      <div className="dt-peer-cell lead">14.2%</div>
                      <div className="dt-peer-cell">42.0%</div>
                      <div className="dt-peer-cell">16.8%</div>
                      {/* KFH */}
                      <div className="dt-peer-cell">Kuwait Finance House (Kuwait)</div>
                      <div className="dt-peer-cell lead">2.1x</div>
                      <div className="dt-peer-cell">10.8%</div>
                      <div className="dt-peer-cell">46.2%</div>
                      <div className="dt-peer-cell">19.1%</div>
                      {/* Al Rajhi */}
                      <div className="dt-peer-cell">Al Rajhi Bank (Saudi Arabia)</div>
                      <div className="dt-peer-cell lead">4.8x</div>
                      <div className="dt-peer-cell lead">22.1%</div>
                      <div className="dt-peer-cell lead">31.0%</div>
                      <div className="dt-peer-cell">20.4%</div>
                      {/* Emirates Islamic */}
                      <div className="dt-peer-cell">Emirates Islamic (UAE)</div>
                      <div className="dt-peer-cell">2.1x</div>
                      <div className="dt-peer-cell">11.3%</div>
                      <div className="dt-peer-cell lag">48.0%</div>
                      <div className="dt-peer-cell">17.5%</div>
                    </div>
                  </div>
                  <div className="dt-peers-legend">
                    <span className="dt-pl-item"><span className="dt-pl-dot lead" />Warba leads</span>
                    <span className="dt-pl-item"><span className="dt-pl-dot lag" />Warba lags</span>
                    <span className="dt-pl-item"><span className="dt-pl-dot" style={{ background: 'var(--faint)' }} />Comparable</span>
                  </div>
                  <div className="dt-peers-insight">
                    <div className="dt-pi-row"><span className="dt-pi-label">Warba leads on:</span><span>Capital Adequacy (18.2% vs peer avg 18.5%) — well above CBK minimum. Strongest NPL ratio in the Kuwait peer set at 1.3%.</span></div>
                    <div className="dt-pi-row"><span className="dt-pi-label">Warba lags on:</span><span>P/B (1.4x vs Boubyan 3.2x, Al Rajhi 4.8x) — the gap is narrative, not fundamentals. ROE 8.5% vs Boubyan 14.2% — closeable through digital efficiency and balance sheet growth.</span></div>
                    <div className="dt-pi-row"><span className="dt-pi-label">Realistically closeable:</span><span>Cost-to-Income (43.1% → &lt;40% target) and ROE (8.5% → 12%+) are achievable within 3 years through the digital platform pathway. P/B rerating follows ROE improvement with a 12–18 month lag.</span></div>
                  </div>
                  <div className="dt-peer-note">Sources: KPMG Kuwait Listed Banks YE25 · Bloomberg · company annual reports 2024/25 · CBK regulatory disclosures. KFH Capital Adequacy from KFH Q3 2025 disclosure.</div>
                </section>
              )}

              {/* 05c Peer Benchmarking — Telco mode (Zain) */}
              {B.telcoMode && (
                <section className="dt-section">
                  <div className="dt-sec-head"><span className="dt-sec-n">05b</span><div><h2>Peer benchmarking</h2><p>Where does Zain stand against leading GCC and global telcos — and which gaps can management realistically close? Source: public disclosures, company reports FY2025.</p></div></div>
                  <div className="dt-peers-wrap">
                    <div className="dt-peers-grid5">
                      <div className="dt-peer-cell hdr">Company</div>
                      <div className="dt-peer-cell hdr">EV/EBITDA</div>
                      <div className="dt-peer-cell hdr">EBITDA Margin</div>
                      <div className="dt-peer-cell hdr">Digital Rev %</div>
                      <div className="dt-peer-cell hdr">ROE</div>
                      {/* Zain */}
                      <div className="dt-peer-cell warba">Zain Group (Kuwait)</div>
                      <div className="dt-peer-cell warba lag">5.1x</div>
                      <div className="dt-peer-cell warba">34.1%</div>
                      <div className="dt-peer-cell warba lag">37%</div>
                      <div className="dt-peer-cell warba lead">15.7%</div>
                      {/* e& */}
                      <div className="dt-peer-cell">e& (UAE)</div>
                      <div className="dt-peer-cell lead">9.0x</div>
                      <div className="dt-peer-cell lead">38.2%</div>
                      <div className="dt-peer-cell lead">52%</div>
                      <div className="dt-peer-cell">12.4%</div>
                      {/* STC */}
                      <div className="dt-peer-cell">STC (Saudi Arabia)</div>
                      <div className="dt-peer-cell lead">7.8x</div>
                      <div className="dt-peer-cell">35.1%</div>
                      <div className="dt-peer-cell">44%</div>
                      <div className="dt-peer-cell">18.2%</div>
                      {/* Ooredoo */}
                      <div className="dt-peer-cell">Ooredoo (Qatar)</div>
                      <div className="dt-peer-cell">5.4x</div>
                      <div className="dt-peer-cell">31.8%</div>
                      <div className="dt-peer-cell">28%</div>
                      <div className="dt-peer-cell">9.1%</div>
                      {/* Turkcell */}
                      <div className="dt-peer-cell">Turkcell (Turkey)</div>
                      <div className="dt-peer-cell">5.8x</div>
                      <div className="dt-peer-cell">32.5%</div>
                      <div className="dt-peer-cell">41%</div>
                      <div className="dt-peer-cell">14.3%</div>
                    </div>
                  </div>
                  <div className="dt-peers-legend">
                    <span className="dt-pl-item"><span className="dt-pl-dot lead" />Zain leads</span>
                    <span className="dt-pl-item"><span className="dt-pl-dot lag" />Zain lags</span>
                    <span className="dt-pl-item"><span className="dt-pl-dot" style={{ background: 'var(--faint)' }} />Comparable</span>
                  </div>
                  <div className="dt-peers-insight">
                    <div className="dt-pi-row"><span className="dt-pi-label">Zain leads on:</span><span>ROE (15.7% vs peer avg 13.5%) and revenue growth (+14% YoY vs sector avg +6%). Net income +103% in FY2025 — a 13-year high.</span></div>
                    <div className="dt-pi-row"><span className="dt-pi-label">Zain lags on:</span><span>EV/EBITDA (5.1x vs e& 9.0x, STC 7.8x) — the gap is narrative and composition, not fundamentals. Digital Revenue % (37% vs e& 52%) — the primary driver of the multiple gap.</span></div>
                    <div className="dt-pi-row"><span className="dt-pi-label">Realistically closeable:</span><span>Digital Revenue % (37% → 50%+) is achievable within 3 years through ZainTECH scaling and ZainCash expansion. EV/EBITDA rerating to 7–8x follows digital revenue mix improvement with an 18–24 month lag.</span></div>
                  </div>
                  <div className="dt-peer-note">Sources: Company FY2025 annual reports · Bloomberg · Zain FY2025 Press Release (Feb 2026) · Yahoo Finance ZAIN.KW (Jun 2026). Digital Revenue % estimates from public investor presentations.</div>
                </section>
              )}

              {/* 05d Peer Benchmarking — Engineering mode (KEO) */}
              {B.engineeringMode && (
                <section className="dt-section">
                  <div className="dt-sec-head"><span className="dt-sec-n">05b</span><div><h2>Peer benchmarking</h2><p>Where does KEO stand against leading engineering, consulting and digital advisory firms — and which gaps can management realistically close? Source: public disclosures, industry benchmarks.</p></div></div>
                  <div className="dt-peers-wrap">
                    <div className="dt-peers-grid5">
                      <div className="dt-peer-cell hdr">Company</div>
                      <div className="dt-peer-cell hdr">EBITDA Margin</div>
                      <div className="dt-peer-cell hdr">Digital Rev %</div>
                      <div className="dt-peer-cell hdr">Fixed Fee %</div>
                      <div className="dt-peer-cell hdr">Rev / Head ($K)</div>
                      {/* KEO */}
                      <div className="dt-peer-cell warba">KEO (GCC)</div>
                      <div className="dt-peer-cell warba">14.3%</div>
                      <div className="dt-peer-cell warba lag">6%</div>
                      <div className="dt-peer-cell warba lag">12%</div>
                      <div className="dt-peer-cell warba lag">$88K</div>
                      {/* WSP */}
                      <div className="dt-peer-cell">WSP Global (Canada)</div>
                      <div className="dt-peer-cell lead">16.8%</div>
                      <div className="dt-peer-cell">18%</div>
                      <div className="dt-peer-cell">28%</div>
                      <div className="dt-peer-cell">$115K</div>
                      {/* Mott MacDonald */}
                      <div className="dt-peer-cell">Mott MacDonald (UK)</div>
                      <div className="dt-peer-cell">13.5%</div>
                      <div className="dt-peer-cell">22%</div>
                      <div className="dt-peer-cell">25%</div>
                      <div className="dt-peer-cell">$98K</div>
                      {/* Arcadis */}
                      <div className="dt-peer-cell">Arcadis (Netherlands)</div>
                      <div className="dt-peer-cell lead">17.2%</div>
                      <div className="dt-peer-cell lead">31%</div>
                      <div className="dt-peer-cell lead">35%</div>
                      <div className="dt-peer-cell lead">$128K</div>
                      {/* Jacobs */}
                      <div className="dt-peer-cell">Jacobs (USA)</div>
                      <div className="dt-peer-cell lead">18.1%</div>
                      <div className="dt-peer-cell lead">38%</div>
                      <div className="dt-peer-cell lead">42%</div>
                      <div className="dt-peer-cell lead">$142K</div>
                    </div>
                  </div>
                  <div className="dt-peers-legend">
                    <span className="dt-pl-item"><span className="dt-pl-dot lead" />KEO leads</span>
                    <span className="dt-pl-item"><span className="dt-pl-dot lag" />KEO lags</span>
                    <span className="dt-pl-item"><span className="dt-pl-dot" style={{ background: 'var(--faint)' }} />Comparable</span>
                  </div>
                  <div className="dt-peers-insight">
                    <div className="dt-pi-row"><span className="dt-pi-label">KEO leads on:</span><span>GCC market presence and regional relationships — a structural advantage that global peers cannot replicate quickly. EBITDA margin (14.3%) is competitive with Mott MacDonald.</span></div>
                    <div className="dt-pi-row"><span className="dt-pi-label">KEO lags on:</span><span>Digital Revenue % (6% vs Arcadis 31%, Jacobs 38%) — the primary driver of margin and valuation gap. Fixed Fee % (12% vs peer avg 33%) — time-and-materials contracts give away AI productivity gains to clients.</span></div>
                    <div className="dt-pi-row"><span className="dt-pi-label">Realistically closeable:</span><span>Digital Revenue % (6% → 25%+) and Fixed Fee % (12% → 30%+) are achievable within 3 years through AI-enabled service delivery and contract model transition. Revenue per head ($88K → $120K+) follows as AI multiplies output per consultant.</span></div>
                  </div>
                  <div className="dt-peer-note">Sources: WSP Global FY2024 Annual Report · Arcadis FY2024 Annual Report · Jacobs FY2024 Annual Report · Mott MacDonald public disclosures. KEO figures are model estimates (privately held). Digital Revenue % and Fixed Fee % are estimates from public investor presentations and industry benchmarks.</div>
                </section>
              )}

              {/* 06 Recommendation */}
              {recData && (
                <section className="dt-section">
                  <div className="dt-sec-head"><span className="dt-sec-n">06</span><div><h2>Model signal</h2><p>Synthesised from your settings and the scenario in play. Not professional advice.</p></div></div>
                  <div className="dt-card dt-rec">
                    <div className="dt-rec-top">
                      <div className="dt-rec-main">
                        <div className="dt-rec-label">Recommendation</div>
                        <div className="dt-rec-text">{recData.rec}</div>
                      </div>
                      <div className="dt-conf">
                        <div className="cl">Model confidence</div>
                        <div className="cv">{B.conf.level}</div>
                        <div className="dt-cbar"><i style={{ width: `${confPct}%` }} /></div>
                      </div>
                    </div>
                    <div className="dt-rec-cols">
                      <div className="assum"><h4>Key assumptions</h4><ul>{recData.assum.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
                      <div className="risks"><h4>Key risks</h4><ul>{recData.risks.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                      <div className="acts"><h4>Actions</h4><ul>{recData.acts.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
                    </div>
                  </div>
                </section>
              )}

              {/* 07 Roadmap / Dynamic Evolution */}
              {B.bankingMode ? (
                <section className="dt-section">
                  <div className="dt-sec-head"><span className="dt-sec-n">07</span><div><h2>How this twin evolves</h2><p>Four stages of data depth — each stage sharpens the P/B rerating signal.</p></div></div>
                  <div className="dt-evo-grid">
                    <div className="dt-evo-stage now">
                      <div className="dt-evo-k">Today · Active</div>
                      <h3>Public Disclosures</h3>
                      <p>Annual reports, KPMG YE25, CBK data, Bloomberg market prices. Zero integration required.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">KPMG YE25 banking data</div>
                        <div className="dt-evo-item">Warba Annual Report 2024</div>
                        <div className="dt-evo-item">Bloomberg P/B &amp; market cap</div>
                        <div className="dt-evo-item">CBK regulatory disclosures</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Next · Quarterly</div>
                      <h3>Quarterly Disclosures</h3>
                      <p>Quarterly earnings releases and investor presentations update the model automatically.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Q1–Q4 earnings releases</div>
                        <div className="dt-evo-item">Investor day presentations</div>
                        <div className="dt-evo-item">Peer bank quarterly data</div>
                        <div className="dt-evo-item">Real-time P/B tracking</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Future · Outcome Ledger</div>
                      <h3>Decision Tracking</h3>
                      <p>Every decision made in this twin is logged against actual outcomes — the model learns from reality.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Outcome Ledger OL-003</div>
                        <div className="dt-evo-item">Scenario accuracy tracking</div>
                        <div className="dt-evo-item">Confidence calibration</div>
                        <div className="dt-evo-item">Board decision audit trail</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Enterprise · Live Feeds</div>
                      <h3>Live Financial Data</h3>
                      <p>Core banking system feeds update the twin in real time. The model reflects the business as it happens.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Core banking integration</div>
                        <div className="dt-evo-item">Live deposit &amp; financing data</div>
                        <div className="dt-evo-item">Real-time EWI alerts</div>
                        <div className="dt-evo-item">Board dashboard live feed</div>
                      </div>
                    </div>
                  </div>
                  <div className="dt-roadnote">Outcome Ledger entry OL-003 · Decision: What closes the 1.4x → 3.0x P/B gap? · Review dates: Dec 2026 · Jun 2027 · Dec 2027</div>
                </section>
              ) : B.telcoMode ? (
                <section className="dt-section">
                  <div className="dt-sec-head"><span className="dt-sec-n">07</span><div><h2>How this twin evolves</h2><p>Four stages of data depth — each stage sharpens the EV/EBITDA rerating signal for Zain.</p></div></div>
                  <div className="dt-evo-grid">
                    <div className="dt-evo-stage now">
                      <div className="dt-evo-k">Today · Active</div>
                      <h3>Public Disclosures</h3>
                      <p>Zain FY2025 Press Release, Yahoo Finance, Bloomberg, company annual reports. Zero integration required.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Zain FY2025 Press Release</div>
                        <div className="dt-evo-item">Yahoo Finance ZAIN.KW</div>
                        <div className="dt-evo-item">Peer EV/EBITDA multiples</div>
                        <div className="dt-evo-item">ZainTECH public disclosures</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Next · Quarterly</div>
                      <h3>Quarterly Earnings</h3>
                      <p>Quarterly earnings releases and investor presentations update the model automatically.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Q1–Q4 earnings releases</div>
                        <div className="dt-evo-item">ZainTECH revenue tracking</div>
                        <div className="dt-evo-item">Digital revenue % by quarter</div>
                        <div className="dt-evo-item">Real-time EV/EBITDA tracking</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Future · Outcome Ledger</div>
                      <h3>Decision Tracking</h3>
                      <p>Every decision made in this twin is logged against actual outcomes — the model learns from reality.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Outcome Ledger OL-002</div>
                        <div className="dt-evo-item">Scenario accuracy tracking</div>
                        <div className="dt-evo-item">ZainTECH scaling milestones</div>
                        <div className="dt-evo-item">EV/EBITDA rerating audit trail</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Enterprise · Live Feeds</div>
                      <h3>Live Market Data</h3>
                      <p>Live Bloomberg feeds update the twin in real time. The model reflects the business as it happens.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Live Bloomberg EV/EBITDA</div>
                        <div className="dt-evo-item">Real-time peer comparisons</div>
                        <div className="dt-evo-item">Live EWI alerts</div>
                        <div className="dt-evo-item">Board dashboard live feed</div>
                      </div>
                    </div>
                  </div>
                  <div className="dt-roadnote">Outcome Ledger entry OL-002 · Decision: How does Zain transition from 5.1x to 8–10x EV/EBITDA? · Review dates: Dec 2026 · Dec 2027 · Dec 2028</div>
                </section>
              ) : B.engineeringMode ? (
                <section className="dt-section">
                  <div className="dt-sec-head"><span className="dt-sec-n">07</span><div><h2>How this twin evolves</h2><p>Four stages of data depth — each stage sharpens the AI value capture signal for KEO.</p></div></div>
                  <div className="dt-evo-grid">
                    <div className="dt-evo-stage now">
                      <div className="dt-evo-k">Today · Active</div>
                      <h3>Public Benchmarks</h3>
                      <p>GCC engineering sector benchmarks, peer annual reports, industry data. Zero integration required.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Peer firm annual reports</div>
                        <div className="dt-evo-item">GCC engineering sector data</div>
                        <div className="dt-evo-item">AI productivity benchmarks</div>
                        <div className="dt-evo-item">Contract model comparisons</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Next · Project Data</div>
                      <h3>Project-Level Depth</h3>
                      <p>Project pipeline, utilization rates, and contract mix data update the model automatically.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Project pipeline by type</div>
                        <div className="dt-evo-item">Utilization by service line</div>
                        <div className="dt-evo-item">Fixed fee vs T&amp;M split</div>
                        <div className="dt-evo-item">AI tool adoption by team</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Future · Outcome Ledger</div>
                      <h3>Decision Tracking</h3>
                      <p>Every decision made in this twin is logged against actual outcomes — the model learns from reality.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Outcome Ledger OL-001</div>
                        <div className="dt-evo-item">AI productivity tracking</div>
                        <div className="dt-evo-item">Contract model transition</div>
                        <div className="dt-evo-item">Margin improvement audit trail</div>
                      </div>
                    </div>
                    <div className="dt-evo-stage">
                      <div className="dt-evo-k">Enterprise · Live Feeds</div>
                      <h3>Live Project Data</h3>
                      <p>ERP and project management system feeds update the twin in real time.</p>
                      <div className="dt-evo-items">
                        <div className="dt-evo-item">Live project utilization</div>
                        <div className="dt-evo-item">Real-time margin by project</div>
                        <div className="dt-evo-item">AI adoption rate tracking</div>
                        <div className="dt-evo-item">Board dashboard live feed</div>
                      </div>
                    </div>
                  </div>
                  <div className="dt-roadnote">Outcome Ledger entry OL-001 · Decision: How does KEO capture AI productivity gains instead of giving them away? · Review dates: Jun 2026 · Dec 2026 · Jun 2027</div>
                </section>
              ) : (
                <section className="dt-section">
                  <div className="dt-sec-head"><span className="dt-sec-n">07</span><div><h2>The path forward</h2><p>Three stages of evolution — from today's model to a full digital twin.</p></div></div>
                  <div className="dt-road">
                    <div className="dt-card dt-rstage now">
                      <div className="rk">Now · Decision Twin</div>
                      <h3>Strategic clarity</h3>
                      <p>Public data, industry benchmarks, and your headline numbers. Useful immediately. No integration required.</p>
                    </div>
                    <div className="dt-card dt-rstage">
                      <div className="rk">Next · Operating Twin</div>
                      <h3>Operational depth</h3>
                      <p>Connect project data, utilization, and pipeline. The model updates automatically and becomes more accurate over time.</p>
                    </div>
                    <div className="dt-card dt-rstage">
                      <div className="rk">Future · Digital Twin</div>
                      <h3>Full fidelity</h3>
                      <p>Live ERP and financial data. The twin reflects the business in real time. Decisions are tested before they are made.</p>
                    </div>
                  </div>
                  <div className="dt-roadnote">The Outcome Ledger tracks every decision made in the twin against actual results — closing the loop between model and reality.</div>
                </section>
              )}
            </div>

            <footer className="dt-footer">
              <div className="dt-wrap">
                Decision Twin · Built by AgenThink · {new Date().getFullYear()}<br />
                This is an exploratory model. Numbers are indicative ranges, not forecasts. Not financial advice.
              </div>
            </footer>
          </div>
        )}

        {/* Board overlay */}
        {showBoard && B && result && recData && (
          <div className={`dt-overlay${showBoard ? " show" : ""}`} onClick={e => { if ((e.target as HTMLElement).classList.contains("dt-overlay")) setShowBoard(false); }}>
            <div className="dt-board">
              <button className="dt-bclose" onClick={() => setShowBoard(false)}>✕ Close</button>
              <div className="dt-bhead">
                <div>
                  <div className="bk">Decision Twin · Board View</div>
                  <h2>{activeScnData?.name || "Custom Exploration"}</h2>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="blogo">{B.name} · Decision Twin</div>
                  <div>
                <button className="dt-bpdf" onClick={() => { track("PDF Exported", { scenario: activeScn || "custom" }); window.print(); }}>Export PDF</button>
                <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4, textAlign: 'right' }}>iPhone: tap Print → Options → Save to Files</div>
              </div>
                </div>
              </div>
              <div className="dt-bmetrics">
                <div className="bm"><div className="bmk">Revenue</div><div className="bmv">{atBase ? fM(result.revenue, cur) : fMr(result.revenue, k * 0.6, cur)}</div></div>
                <div className="bm"><div className="bmk">EBITDA</div><div className="bmv">{atBase ? fM(result.ebitda, cur) : fMr(result.ebitda, k * 0.8, cur)}</div></div>
                <div className="bm"><div className="bmk">Enterprise Value</div><div className="bmv">{fEVr(result.ev, k, cur)}</div></div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Strategic Position:</span>
                <span style={{ fontFamily: "var(--disp)", fontSize: 18, fontWeight: 600, color: positionOf(result.health).c }}>{positionOf(result.health).l}</span>
                <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{B.conf.level} · indicative ranges</span>
              </div>
              <div className="dt-bcols">
                <div className="opp"><h3>Opportunities</h3><ul>{(recData.opp || recData.acts).map((o, i) => <li key={i}>{o}</li>)}</ul></div>
                <div className="rsk"><h3>Key risks</h3><ul>{recData.rsk?.map((r, i) => <li key={i}>{r}</li>) || recData.risks.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
              </div>
              <div className="dt-brec">
                <div className="brk">Model signal</div>
                <p>{recData.rec}</p>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>This is a model signal, not professional advice. Numbers are indicative ranges based on public data and industry benchmarks, not audited figures.</div>
            </div>
          </div>
        )}

        {/* Board Brief overlay — 10-section Chairman-grade brief */}
        {showBrief && B && result && recData && (() => {
          const scnName = activeScnData?.name || "Custom Exploration";
          const scnTag = activeScnData?.tag || "custom lever settings";
          const pos = positionOf(result.health);
          const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
          const confLabel = B.conf.level;
          const isBanking = B.bankingMode && template.bankingDefaults;
          // P/B calculations
          const bd = template.bankingDefaults;
          const bookEquity = isBanking ? bd!.marketCap / bd!.pbRatio : 0;
          const evKD = isBanking ? result.ev * 0.307 : 0;
          const impliedPB = isBanking ? clamp(evKD / bookEquity, 0.5, 5.0) : 0;
          const peerPB = 3.2;
          const pbGaugeW = isBanking ? clamp((impliedPB / peerPB) * 100, 5, 100) : 0;
          const pbColor = impliedPB >= peerPB * 0.9 ? "#0E7C6B" : impliedPB >= peerPB * 0.6 ? "#D4A017" : "#C2543B";
          const gapPct = isBanking ? Math.max(0, (peerPB - impliedPB) / peerPB * 100).toFixed(0) : "0";
          // Live ROE + CTI (same formula as cockpit)
          const revenueGrowthFactor = (result.revenue - B.R0) / B.R0;
          const digitalBonus = clamp((ST.digitalAdoption ?? 50) - 50, -20, 30) * 0.04;
          const liveROE = isBanking ? clamp(bd!.roe * (1 + revenueGrowthFactor * 0.5) + digitalBonus, 4, 28) : 0;
          const ctiDigitalSaving = clamp((ST.digitalAdoption ?? 50) - 50, -20, 30) * 0.12;
          const ctiCostDrag = clamp((ST.costInfl - 5) * 0.3, -2, 6);
          const liveCTI = isBanking ? clamp(bd!.costToIncome - ctiDigitalSaving + ctiCostDrag, 28, 70) : 0;
          // Council votes
          const proceed = result.health >= 65 ? 6 : result.health >= 45 ? 4 : 2;
          const caution = result.health >= 65 ? 3 : result.health >= 45 ? 4 : 4;
          const pause = 10 - proceed - caution;
          const councilVerdict = proceed >= 6 ? "Proceed" : proceed >= 4 ? "Proceed with Caution" : "Pause and Reassess";
          // Top success and failure pathway
          const topSuccessPath = recData.opp?.[0] || recData.acts?.[0] || "Pursue digital platform positioning.";
          const topFailurePath = recData.rsk?.[0] || recData.risks?.[0] || "Inaction on digital transformation.";
          // Critical assumptions (top 3)
          const criticalAssum = (recData.assum || []).slice(0, 3);
          // EWI (top 3 most critical)
          const topEWI = indicators.slice(0, 3);
          // Final recommendation
          const finalRec = recData.rec;
          return (
            <div className="dt-brief-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("dt-brief-overlay")) setShowBrief(false); }}>
              <div className="dt-brief">
                <div className="dt-brief-inner">

                  {/* HEADER */}
                  <div className="bb-header">
                    <div className="bb-title-block">
                      <div className="bb-sub">Strategic Decision Brief · Confidential</div>
                      <h1>{B.name}</h1>
                      {isBanking && <div className="bb-sq">How does Warba close the valuation gap with leading GCC Islamic banks?</div>}
                      {B.telcoMode && <div className="bb-sq">How does Zain transition from a telecom valuation multiple to a digital infrastructure valuation multiple?</div>}
                      {B.engineeringMode && <div className="bb-sq">How does KEO capture AI productivity gains instead of giving them away through time-and-materials contracts?</div>}
                    </div>
                    <div className="bb-meta">
                      <div><strong>Date:</strong> {today}</div>
                      <div><strong>Scenario:</strong> {scnName}</div>
                      <div><strong>Confidence:</strong> {confLabel}</div>
                      <div><strong>Ref:</strong> {isBanking ? "OL-003" : "DT-001"}</div>
                    </div>
                  </div>

                  {/* 01 — EXECUTIVE SUMMARY */}
                  <div className="bb-section">
                    <div className="bb-section-title">01 — Executive Summary</div>
                    {isBanking ? (
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#2C3645', margin: 0 }}>
                        Warba Bank has undergone a fundamental transformation in 12 months: net profit +121%, share price +51%, cost-to-income from 57.7% to 43.1%, NPL at 1.3%. The market has not yet repriced this. Warba trades at <strong>1.4x P/B</strong>. Boubyan Bank — the closest comparable, same market, same regulatory environment — trades at <strong>3.2x P/B</strong>. Under the "{scnName}" scenario, the model implies a P/B of <strong style={{ color: pbColor }}>{impliedPB.toFixed(2)}x</strong> — a {gapPct}% gap to Boubyan remains. The valuation gap is not a fundamentals gap. It is a narrative gap. The Council of 10 votes {proceed} Proceed · {caution} Caution · {pause} Pause.
                      </p>
                    ) : B.telcoMode && template.telcoDefaults ? (() => {
                      const td2 = template.telcoDefaults;
                      const egf = (result.ebitda - B.E0) / Math.max(B.E0, 1);
                      const lev = clamp(td2.evEbitda * (1 + egf * 0.4) + (ST.pricing >= 60 ? 1.5 : ST.pricing >= 40 ? 0.5 : 0), 3, 14);
                      const gapEv = Math.max(0, ((td2.peerEvEbitda - lev) / td2.peerEvEbitda * 100)).toFixed(0);
                      const levColor = lev >= td2.peerEvEbitda * 0.85 ? '#0E7C6B' : lev >= td2.peerEvEbitda * 0.6 ? '#D4A017' : '#C2543B';
                      return (
                        <p style={{ fontSize: 12, lineHeight: 1.6, color: '#2C3645', margin: 0 }}>
                          Zain Group delivered a 13-year record net income in FY2025: net profit +103%, revenue +14%, ROE 15.7%. The market has not yet repriced this. Zain trades at <strong>{td2.evEbitda}x EV/EBITDA</strong>. e& — the closest digital infrastructure comparable in the GCC — trades at <strong>{td2.peerEvEbitda}x EV/EBITDA</strong>. Under the "{scnName}" scenario, the model implies an EV/EBITDA of <strong style={{ color: levColor }}>{lev.toFixed(1)}x</strong> — a {gapEv}% gap to e& remains. The multiple gap is not a fundamentals gap. It is a digital revenue composition gap. The Council of 10 votes {proceed} Proceed · {caution} Caution · {pause} Pause.
                        </p>
                      );
                    })() : B.engineeringMode && template.engineeringDefaults ? (() => {
                      const ed2 = template.engineeringDefaults;
                      const ab = clamp((ST.ai - 18) * 0.08, -3, 8);
                      const pb2 = clamp((ST.pricing - 22) * 0.06, -2, 6);
                      const lm = clamp(ed2.ebitdaMargin + ab + pb2 - (ST.costInfl - 5) * 0.2, 8, 32);
                      const lf = clamp(ed2.fixedFeePct + (ST.pricing - 22) * 0.2, 5, 45);
                      const marginCol = lm >= 20 ? '#0E7C6B' : lm >= 14 ? '#D4A017' : '#C2543B';
                      return (
                        <p style={{ fontSize: 12, lineHeight: 1.6, color: '#2C3645', margin: 0 }}>
                          KEO is a leading GCC engineering and design consultancy with strong regional relationships and a growing digital practice. The core strategic risk is structural: time-and-materials contracts pass AI productivity gains directly to clients. Under the "{scnName}" scenario, the model implies an operating margin of <strong style={{ color: marginCol }}>{lm.toFixed(1)}%</strong> and a fixed-fee mix of <strong>{lf.toFixed(0)}%</strong>. Jacobs — the leading digital engineering peer — operates at 18.1% margin with 42% fixed-fee contracts. The margin gap is not a capability gap. It is a contract model gap. The Council of 10 votes {proceed} Proceed · {caution} Caution · {pause} Pause.
                        </p>
                      );
                    })() : (
                      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#2C3645', margin: 0 }}>
                        {B.name} is currently {pos.l.toLowerCase()}. {activeScnData?.rec?.split(".")[0] || "The model reflects current lever settings"}. The model confidence is {confLabel.toLowerCase()} — numbers are indicative ranges based on public data and industry benchmarks. The Council of 10 votes {proceed} Proceed · {caution} Caution · {pause} Pause.
                      </p>
                    )}
                  </div>

                  {/* 02 — CURRENT STRATEGIC POSITION */}
                  <div className="bb-section">
                    <div className="bb-section-title">02 — Current Strategic Position</div>
                    <div className="bb-metrics">
                      {isBanking ? (
                        <>
                          <div className="bb-metric"><div className="bmk">Total Assets</div><div className="bmv">KD {bd!.totalAssets.toLocaleString()}M</div></div>
                          <div className="bb-metric"><div className="bmk">Net Profit</div><div className="bmv">KD {bd!.netProfit.toFixed(1)}M</div></div>
                          <div className="bb-metric"><div className="bmk">ROE (Live)</div><div className="bmv" style={{ color: liveROE >= 12 ? '#0E7C6B' : '#D4A017' }}>{liveROE.toFixed(1)}%</div></div>
                          <div className="bb-metric"><div className="bmk">Cost-to-Income (Live)</div><div className="bmv" style={{ color: liveCTI <= 42 ? '#0E7C6B' : '#D4A017' }}>{liveCTI.toFixed(1)}%</div></div>
                          <div className="bb-metric"><div className="bmk">Capital Adequacy</div><div className="bmv" style={{ color: '#0E7C6B' }}>{bd!.capitalAdequacy}%</div></div>
                          <div className="bb-metric"><div className="bmk">Current P/B</div><div className="bmv" style={{ color: '#D81E2C' }}>{bd!.pbRatio}x</div></div>
                        </>
                      ) : (
                        <>
                          <div className="bb-metric"><div className="bmk">Revenue</div><div className="bmv">{fM(result.revenue, cur)}</div></div>
                          <div className="bb-metric"><div className="bmk">EBITDA</div><div className="bmv">{fM(result.ebitda, cur)}</div></div>
                          <div className="bb-metric"><div className="bmk">Enterprise Value</div><div className="bmv">{fEVr(result.ev, k, cur)}</div></div>
                          <div className="bb-metric"><div className="bmk">Strategic Position</div><div className="bmv" style={{ color: pos.c }}>{pos.l}</div></div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 03 — P/B VS PEER BENCHMARKS (banking only) */}
                  {isBanking && (
                    <div className="bb-section">
                      <div className="bb-section-title">03 — P/B vs Peer Benchmarks</div>
                      <div className="bb-pb-row" style={{ marginBottom: 10 }}>
                        <span className="bb-pb-label">Implied P/B</span>
                        <div className="bb-pb-bar"><div className="bb-pb-fill" style={{ width: pbGaugeW + "%", background: pbColor, transition: 'width 0.4s ease' }} /></div>
                        <span className="bb-pb-val" style={{ color: pbColor }}>{impliedPB.toFixed(2)}x</span>
                        <span className="bb-pb-peer">Boubyan {peerPB}x</span>
                        <span style={{ fontSize: 10, color: 'var(--faint)' }}>{gapPct}% gap</span>
                      </div>
                      <div className="bb-peer-mini">
                        {[
                          { name: 'Warba (today)', pb: '1.4x', roe: '8.5%', highlight: true },
                          { name: `Warba (${scnName})`, pb: impliedPB.toFixed(1) + 'x', roe: liveROE.toFixed(1) + '%', implied: true },
                          { name: 'KFH (Kuwait)', pb: '2.1x', roe: '10.8%' },
                          { name: 'Boubyan (Kuwait)', pb: '3.2x', roe: '14.2%', target: true },
                          { name: 'Emirates Islamic', pb: '2.1x', roe: '11.3%' },
                          { name: 'Al Rajhi (Saudi)', pb: '4.8x', roe: '22.1%' },
                        ].map((row, i) => (
                          <div key={i} className={`bb-pm-row${row.highlight ? ' current' : row.implied ? ' implied' : row.target ? ' target' : ''}`}>
                            <span className="bb-pm-name">{row.name}</span>
                            <span className="bb-pm-pb">{row.pb}</span>
                            <span className="bb-pm-roe">{row.roe}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 03 — PEER BENCHMARK TABLE (telco mode) */}
                  {!isBanking && B.telcoMode && (() => {
                    const td = template.telcoDefaults;
                    if (!td) return null;
                    const ebitdaGrowthFactor = (result.ebitda - B.E0) / Math.max(B.E0, 1);
                    const liveEvEbitda = clamp(td.evEbitda * (1 + ebitdaGrowthFactor * 0.4) + (ST.pricing >= 60 ? 1.5 : ST.pricing >= 40 ? 0.5 : 0), 3, 14);
                    const peerEvEbitda = td.peerEvEbitda;
                    const gapEvPct = Math.max(0, ((peerEvEbitda - liveEvEbitda) / peerEvEbitda * 100)).toFixed(0);
                    const evColor2 = liveEvEbitda >= peerEvEbitda * 0.85 ? '#0E7C6B' : liveEvEbitda >= peerEvEbitda * 0.6 ? '#D4A017' : '#C2543B';
                    const evGaugeW = clamp((liveEvEbitda / peerEvEbitda) * 100, 5, 100);
                    return (
                      <div className="bb-section">
                        <div className="bb-section-title">03 — EV/EBITDA vs Peer Benchmarks</div>
                        <div className="bb-sq" style={{ marginBottom: 10 }}>How does Zain transition from a telecom valuation multiple to a digital infrastructure valuation multiple?</div>
                        <div className="bb-pb-row" style={{ marginBottom: 10 }}>
                          <span className="bb-pb-label">Implied EV/EBITDA</span>
                          <div className="bb-pb-bar"><div className="bb-pb-fill" style={{ width: evGaugeW + '%', background: evColor2, transition: 'width 0.4s ease' }} /></div>
                          <span className="bb-pb-val" style={{ color: evColor2 }}>{liveEvEbitda.toFixed(1)}x</span>
                          <span className="bb-pb-peer">e& {peerEvEbitda}x</span>
                          <span style={{ fontSize: 10, color: 'var(--faint)' }}>{gapEvPct}% gap</span>
                        </div>
                        <div className="bb-peer-mini">
                          {[
                            { name: 'Zain (today)', ev: `${td.evEbitda}x`, dig: `${td.digitalRevenuePct}%`, highlight: true },
                            { name: `Zain (${scnName})`, ev: `${liveEvEbitda.toFixed(1)}x`, dig: `${clamp(td.digitalRevenuePct + (ST.daGrowth - 37) * 0.25 + (ST.pricing - 22) * 0.15, 10, 65).toFixed(0)}%`, implied: true },
                            { name: 'Ooredoo (Qatar)', ev: '5.4x', dig: '28%' },
                            { name: 'STC (Saudi Arabia)', ev: '7.8x', dig: '44%' },
                            { name: 'e& (UAE)', ev: '9.0x', dig: '52%', target: true },
                          ].map((row, i) => (
                            <div key={i} className={`bb-pm-row${row.highlight ? ' current' : row.implied ? ' implied' : row.target ? ' target' : ''}`}>
                              <span className="bb-pm-name">{row.name}</span>
                              <span className="bb-pm-pb">{row.ev}</span>
                              <span className="bb-pm-roe">{row.dig} digital</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 03 — PEER BENCHMARK TABLE (engineering mode) */}
                  {!isBanking && B.engineeringMode && (() => {
                    const ed = template.engineeringDefaults;
                    if (!ed) return null;
                    const aiBonus2 = clamp((ST.ai - 18) * 0.08, -3, 8);
                    const pricingBonus2 = clamp((ST.pricing - 22) * 0.06, -2, 6);
                    const liveMarginBrief = clamp(ed.ebitdaMargin + aiBonus2 + pricingBonus2 - (ST.costInfl - 5) * 0.2, 8, 32);
                    const liveFixedFeeBrief = clamp(ed.fixedFeePct + (ST.pricing - 22) * 0.2, 5, 45);
                    const liveDigitalBrief = clamp(ed.digitalRevenuePct + (ST.daGrowth - 37) * 0.3, 2, 55);
                    const marginColor = liveMarginBrief >= 20 ? '#0E7C6B' : liveMarginBrief >= 14 ? '#D4A017' : '#C2543B';
                    const marginGaugeW = clamp((liveMarginBrief / 32) * 100, 5, 100);
                    return (
                      <div className="bb-section">
                        <div className="bb-section-title">03 — Margin vs Peer Benchmarks</div>
                        <div className="bb-sq" style={{ marginBottom: 10 }}>How does KEO capture AI productivity gains instead of giving them away through time-and-materials contracts?</div>
                        <div className="bb-pb-row" style={{ marginBottom: 10 }}>
                          <span className="bb-pb-label">Operating Margin</span>
                          <div className="bb-pb-bar"><div className="bb-pb-fill" style={{ width: marginGaugeW + '%', background: marginColor, transition: 'width 0.4s ease' }} /></div>
                          <span className="bb-pb-val" style={{ color: marginColor }}>{liveMarginBrief.toFixed(1)}%</span>
                          <span className="bb-pb-peer">Jacobs 18.1%</span>
                          <span style={{ fontSize: 10, color: 'var(--faint)' }}>Target: 20%+</span>
                        </div>
                        <div className="bb-peer-mini">
                          {[
                            { name: 'KEO (today)', pb: `${ed.ebitdaMargin}%`, roe: `${ed.fixedFeePct}% fixed`, highlight: true },
                            { name: `KEO (${scnName})`, pb: `${liveMarginBrief.toFixed(1)}%`, roe: `${liveFixedFeeBrief.toFixed(0)}% fixed`, implied: true },
                            { name: 'Mott MacDonald', pb: '13.5%', roe: '25% fixed' },
                            { name: 'Arcadis', pb: '17.2%', roe: '35% fixed' },
                            { name: 'Jacobs', pb: '18.1%', roe: '42% fixed', target: true },
                          ].map((row, i) => (
                            <div key={i} className={`bb-pm-row${row.highlight ? ' current' : row.implied ? ' implied' : row.target ? ' target' : ''}`}>
                              <span className="bb-pm-name">{row.name}</span>
                              <span className="bb-pm-pb">{row.pb}</span>
                              <span className="bb-pm-roe">{row.roe}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>Digital Revenue: {liveDigitalBrief.toFixed(0)}% under this scenario (baseline {ed.digitalRevenuePct}%)</div>
                      </div>
                    );
                  })()}

                  {/* 03 — STRATEGIC CONTEXT (generic fallback) */}
                  {!isBanking && !B.telcoMode && !B.engineeringMode && (
                    <div className="bb-section">
                      <div className="bb-section-title">03 — Strategic Context</div>
                      <p style={{ fontSize: 12, lineHeight: 1.5, color: '#2C3645', margin: 0 }}>{activeScnData?.rec || 'Model reflects current lever settings.'}</p>
                    </div>
                  )}

                  {/* 05 — COUNCIL VERDICT */}
                  <div className="bb-council">
                    <div className="bb-section-title" style={{ marginBottom: 8 }}>04 — Council Verdict</div>
                    <div className="bb-council-row">
                      <div style={{ flex: 1 }}>
                        <div className="bb-council-votes" style={{ marginBottom: 6 }}>
                          {Array.from({ length: proceed }).map((_, i) => <span key={`p${i}`} className="bb-vote-chip proceed">Proceed</span>)}
                          {Array.from({ length: caution }).map((_, i) => <span key={`c${i}`} className="bb-vote-chip caution">Caution</span>)}
                          {Array.from({ length: pause }).map((_, i) => <span key={`x${i}`} className="bb-vote-chip pause">Pause</span>)}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Verdict: {councilVerdict}</div>
                        <div style={{ fontSize: 11, color: '#2C3645' }}>Supporting: {recData.assum?.[0] || 'Model assumptions hold'}</div>
                        <div style={{ fontSize: 11, color: '#2C3645' }}>Concern: {recData.risks?.[0] || recData.rsk?.[0] || 'Execution risk remains'}</div>
                      </div>
                    </div>
                  </div>

                  {/* 06+07 — SUCCESS + FAILURE PATHWAYS */}
                  <div className="bb-cols">
                    <div>
                      <div className="bb-col-head">05 — Top Success Pathway</div>
                      <p style={{ fontSize: 12, lineHeight: 1.5, color: '#2C3645', margin: 0 }}>{topSuccessPath}</p>
                      {isBanking && recData.opp?.slice(1, 3).map((o, i) => (
                        <p key={i} style={{ fontSize: 11, lineHeight: 1.4, color: '#4A5568', margin: '4px 0 0' }}>{o}</p>
                      ))}
                    </div>
                    <div>
                      <div className="bb-col-head">06 — Top Failure Pathway</div>
                      <p style={{ fontSize: 12, lineHeight: 1.5, color: '#2C3645', margin: 0 }}>{topFailurePath}</p>
                      {isBanking && recData.rsk?.slice(1, 3).map((r, i) => (
                        <p key={i} style={{ fontSize: 11, lineHeight: 1.4, color: '#4A5568', margin: '4px 0 0' }}>{r}</p>
                      ))}
                    </div>
                  </div>

                  {/* 08+09 — ASSUMPTIONS + EWI */}
                  <div className="bb-cols">
                    <div>
                      <div className="bb-col-head">07 — Three Critical Assumptions</div>
                      <ol style={{ fontSize: 11, lineHeight: 1.5, color: '#2C3645', paddingLeft: 16, margin: 0 }}>
                        {criticalAssum.map((a, i) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}
                      </ol>
                    </div>
                    <div>
                      <div className="bb-col-head">08 — Three Early Warning Indicators</div>
                      {topEWI.map((ind, i) => (
                        <div key={i} className="bb-ewi-row">
                          <div className="bb-ewi-dot" style={{ background: ind.st === 'safe' ? '#2E9E6B' : ind.st === 'watch' ? '#C8922A' : '#C2543B' }} />
                          <span className="bb-ewi-name">{ind.n}</span>
                          <span className={`bb-ewi-st ${ind.st}`}>{ind.st}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 09 — FINAL RECOMMENDATION */}
                  <div className="bb-rec">
                    <div className="bb-rec-label">09 — Final Recommendation</div>
                    <p style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>{finalRec}</p>
                    {isBanking && (
                      <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(14,124,107,0.06)', borderLeft: '3px solid #0E7C6B', borderRadius: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0E7C6B', marginBottom: 3 }}>Outcome Ledger OL-003</div>
                        <div style={{ fontSize: 11, color: '#2C3645', lineHeight: 1.4 }}>Decision: What closes the 1.4x → 3.0x P/B gap? · Review dates: Dec 2026 · Jun 2027 · Dec 2027</div>
                      </div>
                    )}
                    {B.telcoMode && (
                      <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(14,124,107,0.06)', borderLeft: '3px solid #0E7C6B', borderRadius: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0E7C6B', marginBottom: 3 }}>Outcome Ledger OL-002</div>
                        <div style={{ fontSize: 11, color: '#2C3645', lineHeight: 1.4 }}>Decision: How does Zain transition from 5.1x to 8–10x EV/EBITDA? · Review dates: Dec 2026 · Dec 2027 · Dec 2028</div>
                      </div>
                    )}
                    {B.engineeringMode && (
                      <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(14,124,107,0.06)', borderLeft: '3px solid #0E7C6B', borderRadius: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0E7C6B', marginBottom: 3 }}>Outcome Ledger OL-001</div>
                        <div style={{ fontSize: 11, color: '#2C3645', lineHeight: 1.4 }}>Decision: How does KEO capture AI productivity gains instead of giving them away? · Review dates: Jun 2026 · Dec 2026 · Jun 2027</div>
                      </div>
                    )}
                  </div>

                  <div className="bb-disclaimer">
                    This brief was generated by the {B.name} Decision Twin on {today} under the “{scnName}” scenario ({scnTag}). Numbers are indicative ranges based on public data and industry benchmarks — not audited figures. This is a model signal, not professional financial advice. Confidence: {confLabel}.
                  </div>
                </div>
                <div className="dt-brief-actions">
                  <button className="dt-brief-dl" onClick={() => { track("Board Brief Downloaded", { scenario: activeScn || "custom" }); window.print(); }}>Download PDF</button>
                  <button className="dt-brief-close" onClick={() => setShowBrief(false)}>Close</button>
                  <span className="dt-brief-iphone">iPhone: tap Print → Options → Save to Files</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Share modal */}
        {showShare && (
          <div className="dt-share-modal" onClick={e => { if ((e.target as HTMLElement).classList.contains("dt-share-modal")) setShowShare(false); }}>
            <div className="dt-share-card">
              <button className="dt-bclose" onClick={() => setShowShare(false)}>✕</button>
              <h3>Share this scenario</h3>
              <p>Anyone with this link will see your exact lever settings and scenario — nothing else leaves your browser.</p>
              <div className="dt-share-url">{shareUrl}</div>
              <button className="dt-share-copy" onClick={copyShare}>Copy link</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
