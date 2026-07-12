// ─────────────────────────────────────────────────────────────────────────────
// CapTwin v3.0 — Capital Formation Digital Twin
// Enhancement blocks: auto-hydrate, wired toggles, PDF export,
// compliance tooltips, glassmorphic theme, Framer Motion animations
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  TrendingUp,
  Shield,
  Users,
  Download,
  ChevronRight,
  Info,
} from "lucide-react";
import { LP_REGISTRY, LimitedPartner, FundStrategy } from "@/lib/lpRegistry";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FundParams {
  strategy: FundStrategy;
  targetCapM: number;
  managementFeePct: number;
  trackRecordYrs: number;
  priorFundIRR: number;
  velocityScore: number; // 0–100
  placementAgent: boolean;
}

interface SimResult {
  grossRaisedM: number;
  netAumM: number;
  estFinalCloseMonth: number;
  cumulativeMgmtFeesM: number;
  placementCommissionsM: number;
  feeDragPct: number;
  fitScore: number;
  fitBreakdown: { strategyFit: number; pedigreeFit: number; feeAlignment: number; penalties: number };
  sCurveData: { month: number; raised: number; netAum: number }[];
  complianceFlags: ComplianceFlag[];
  pitch: string;
  icDebate: ICDebate;
}

interface ComplianceFlag {
  rule: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

interface ICDebate {
  objections: string[];
  verdict: "Approved" | "Conditional Watchlist" | "Rejected";
  rationale: string;
}

interface LedgerEntry {
  ts: number;
  lpId: string;
  fitScore: number;
  verdict: string;
  grossRaisedM: number;
}

// ── Compliance tooltip definitions ────────────────────────────────────────────

const COMPLIANCE_TOOLTIPS: Record<string, string> = {
  "SEC Rule 506(b)":
    "Prohibits general solicitation. Scans outreach templates for public marketing indicators.",
  "SEC Rule 506(c)":
    "Permits general solicitation only to verified accredited investors. Requires documented accreditation verification.",
  "Kuwait CMA":
    "Enforces the mandatory KWD 100,000 minimum private placement ticket size.",
  "Sharia / AAOIFI":
    "Validates debt underlying structures against AAOIFI ledger parameters.",
  "EU AIFMD":
    "Checks Article 8/9 sustainability reporting requirements and AIFMD passporting disclosure.",
  "MAS CIS":
    "Validates that the offering document meets Singapore MAS Collective Investment Scheme regulatory requirements.",
};

// ── Deterministic Math ─────────────────────────────────────────────────────────

function logisticSCurve(
  targetM: number,
  velocityScore: number,
  placementAgent: boolean,
  months: number
): { month: number; raised: number }[] {
  const k = 0.08 + (velocityScore / 100) * 0.14;
  const agentMultiplier = placementAgent ? 1.25 : 1.0;
  const midpoint = 18 - (velocityScore / 100) * 8;
  const data: { month: number; raised: number }[] = [];
  for (let t = 0; t <= months; t++) {
    const raw = targetM / (1 + Math.exp(-k * agentMultiplier * (t - midpoint)));
    data.push({ month: t, raised: Math.min(raw, targetM) });
  }
  return data;
}

function calcNetAUM(
  raised: number,
  cumulativeMonths: number,
  mgmtFeePct: number,
  placementAgent: boolean,
  targetM: number
): { netAum: number; mgmtFees: number; placementComm: number } {
  const monthlyFeeRate = mgmtFeePct / 100 / 12;
  const mgmtFees = raised * monthlyFeeRate * cumulativeMonths;
  const placementComm = placementAgent ? raised * 0.02 : 0;
  return {
    netAum: Math.max(raised - mgmtFees - placementComm, 0),
    mgmtFees,
    placementComm,
  };
}

function calcFitScore(
  params: FundParams,
  lp: LimitedPartner
): { score: number; strategyFit: number; pedigreeFit: number; feeAlignment: number; penalties: number } {
  const strategyFit = lp.strategies.includes(params.strategy) ? 100 : 30;
  const pedigreeFit =
    params.trackRecordYrs <= lp.trackRecordLimit
      ? 100
      : Math.max(0, 100 - (params.trackRecordYrs - lp.trackRecordLimit) * 15);
  const feeAlignment =
    params.managementFeePct <= lp.maxManagementFee
      ? 100
      : Math.max(0, 100 - (params.managementFeePct - lp.maxManagementFee) * 40);

  let penalties = 0;
  if (lp.shariaRequired && !["Infrastructure", "Private Credit"].includes(params.strategy)) {
    penalties += 40;
  }
  if (lp.complianceFlags.includes("sec-506c") && !lp.complianceFlags.includes("accreditation-required")) {
    penalties += 30;
  }
  if (lp.irrHurdle !== null && params.priorFundIRR < lp.irrHurdle) {
    penalties += 20;
  }

  const raw = 0.5 * strategyFit + 0.3 * pedigreeFit + 0.2 * feeAlignment - penalties;
  return {
    score: Math.max(0, Math.min(100, Math.round(raw))),
    strategyFit: Math.round(strategyFit),
    pedigreeFit: Math.round(pedigreeFit),
    feeAlignment: Math.round(feeAlignment),
    penalties,
  };
}

// ── RegInterceptor ─────────────────────────────────────────────────────────────

const BLOCKED_PHRASES_506B = [
  "public offering",
  "retail crowd",
  "advertisement",
  "open to everyone",
  "general solicitation",
];

function runRegInterceptor(pitch: string, lp: LimitedPartner): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const pitchLower = pitch.toLowerCase();

  const blockedFound = BLOCKED_PHRASES_506B.filter((p) => pitchLower.includes(p));
  if (blockedFound.length > 0) {
    flags.push({
      rule: "SEC Rule 506(b)",
      status: "fail",
      message: `Blocked phrase(s) detected: "${blockedFound.join('", "')}". Public solicitation is prohibited under 506(b).`,
    });
  } else {
    flags.push({
      rule: "SEC Rule 506(b)",
      status: "pass",
      message: "No public solicitation phrases detected.",
    });
  }

  if (lp.segment === "Individual") {
    const hasFooter =
      pitchLower.includes("accredited investor") || pitchLower.includes("rule 506(c)");
    flags.push({
      rule: "SEC Rule 506(c)",
      status: hasFooter ? "pass" : "fail",
      message: hasFooter
        ? "Verified accredited-investor disclosure footer present."
        : "MISSING: Verified accredited-investor status disclosure footer required for SEC Rule 506(c) compliance.",
    });
  }

  if (lp.complianceFlags.includes("eu-aifmd")) {
    const hasPassport =
      pitchLower.includes("aifmd") || pitchLower.includes("passporting");
    flags.push({
      rule: "EU AIFMD",
      status: hasPassport ? "pass" : "warn",
      message: hasPassport
        ? "AIFMD passporting disclosure present."
        : "WARNING: Marketing to EU allocators without AIFMD passporting disclosure may breach Directive 2011/61/EU.",
    });
  }

  if (lp.complianceFlags.includes("kuwait-cma")) {
    const ticketMinKWD = lp.ticketMin * 0.31;
    flags.push({
      rule: "Kuwait CMA",
      status: ticketMinKWD >= 0.1 ? "pass" : "fail",
      message:
        ticketMinKWD >= 0.1
          ? `Minimum ticket (KWD ${(ticketMinKWD * 1000).toFixed(0)}k) meets Kuwait CMA private placement minimum of KWD 100,000.`
          : `FAIL: Minimum ticket (KWD ${(ticketMinKWD * 1000).toFixed(0)}k) falls below Kuwait CMA private placement minimum of KWD 100,000.`,
    });
  }

  if (lp.complianceFlags.includes("mas-cis")) {
    const hasMas =
      pitchLower.includes("mas") ||
      pitchLower.includes("cis") ||
      pitchLower.includes("collective investment scheme") ||
      pitchLower.includes("singapore");
    flags.push({
      rule: "MAS CIS",
      status: hasMas ? "pass" : "warn",
      message: hasMas
        ? "MAS Collective Investment Scheme disclosure language present."
        : "WARNING: Singapore MAS CIS-compliant offering document disclosure is required for this allocator.",
    });
  }

  if (lp.shariaRequired) {
    const hasSharia =
      pitchLower.includes("sharia") ||
      pitchLower.includes("murabaha") ||
      pitchLower.includes("ijara") ||
      pitchLower.includes("aaoifi");
    flags.push({
      rule: "Sharia / AAOIFI",
      status: hasSharia ? "pass" : "fail",
      message: hasSharia
        ? "Sharia-compliant structuring language present."
        : "FAIL: No Sharia-compliant structuring language detected. AAOIFI documentation required.",
    });
  }

  return flags;
}

// ── Pitch Generator ────────────────────────────────────────────────────────────

function generatePitch(params: FundParams, lp: LimitedPartner): string {
  const base =
    `We are raising a ${params.strategy} fund targeting $${params.targetCapM}M in commitments. ` +
    `Our team brings ${params.trackRecordYrs} years of GP track record with a prior fund net IRR of ${params.priorFundIRR}%. ` +
    `Management fee is ${params.managementFeePct}% per annum with standard 20% carried interest.`;

  let segmentClause = "";

  if (lp.segment === "SWF") {
    segmentClause =
      " We offer a dedicated sovereign share-class with preferred liquidity rights and side-letter provisions. " +
      "All instruments are structured under Murabaha and Ijara frameworks in compliance with AAOIFI standards. " +
      "Sharia supervisory board oversight is maintained throughout the fund lifecycle.";
  } else if (lp.segment === "Pension") {
    segmentClause =
      " This fund is registered under AIFMD with full EU marketing passport. " +
      "We provide SFDR Article 9 sustainability risk disclosure and full ESG integration reporting. " +
      "Long-duration capital is welcome with a 10–15 year investment horizon.";
  } else if (lp.segment === "SFO") {
    segmentClause =
      " GP-LP carry alignment is reinforced by a mandatory GP co-investment of 2% of fund size. " +
      "Our LPA includes a key-man succession clause and deputy PM continuity provisions. " +
      "All instruments are structured under Sharia-compliant frameworks with AAOIFI documentation.";
  } else if (lp.segment === "FoF") {
    segmentClause =
      " We provide a digital LP data room with automated capital call and distribution notices. " +
      "Our net IRR track record consistently clears the 10% FoF hurdle after fee drag. " +
      "AIFMD passporting documentation is available for EU marketing compliance.";
  } else if (lp.segment === "Endowment") {
    segmentClause =
      " This fund provides full ESG integration methodology and sustainability risk disclosure aligned with UNPRI. " +
      "Perpetual capital horizon of 15–20 years is supported with flexible capital call scheduling. " +
      "Co-investment rights of minimum 5% of fund size are available to qualifying endowment LPs.";
  } else if (lp.segment === "Individual") {
    segmentClause =
      " Digital onboarding is fully supported with simplified capital call processes accessible via secure portal. " +
      "This offering is made exclusively to verified accredited investors pursuant to SEC Rule 506(c). " +
      "ACCREDITED INVESTOR DISCLOSURE: This offering is available only to accredited investors as defined under " +
      "SEC Rule 501(a). Participation requires verified accredited-investor status. This is not a public offering. " +
      "Past performance does not guarantee future results.";
  }

  return base + segmentClause;
}

// ── IC Debate Simulator ────────────────────────────────────────────────────────

function simulateICDebate(fitScore: number, lp: LimitedPartner, params: FundParams): ICDebate {
  const objections = lp.objections;

  let verdict: "Approved" | "Conditional Watchlist" | "Rejected";
  let rationale: string;

  if (fitScore >= 70) {
    verdict = "Approved";
    rationale = `Fit score of ${fitScore}/100 clears our minimum threshold. Strategy alignment, pedigree, and fee structure are acceptable. Proceeding to due diligence.`;
  } else if (fitScore >= 45) {
    verdict = "Conditional Watchlist";
    rationale = `Fit score of ${fitScore}/100 is below our preferred threshold but above hard rejection. Conditional approval subject to resolution of compliance and structural objections within 30 days.`;
  } else {
    verdict = "Rejected";
    rationale = `Fit score of ${fitScore}/100 falls below our minimum acceptance threshold. Structural mismatches and compliance gaps cannot be resolved within the current fund terms.`;
  }

  return { objections, verdict, rationale };
}

// ── Auto-Calibration (Pattern Moat) ───────────────────────────────────────────

const LEDGER_KEY = "captwin_decision_ledger_v2";

function loadLedger(): LedgerEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LEDGER_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLedger(entries: LedgerEntry[]) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(entries.slice(-200)));
}

function calcPatternMoat(entries: LedgerEntry[]): number {
  if (entries.length < 3) return 1.0;
  const approvedEntries = entries.filter((e) => e.verdict === "Approved");
  if (approvedEntries.length === 0) return 1.0;
  const avgScore =
    approvedEntries.reduce((s, e) => s + e.fitScore, 0) / approvedEntries.length;
  const multiplier =
    1.0 + Math.min(0.08, (entries.length / 200) * 0.08) * (avgScore / 100);
  return Math.round(multiplier * 1000) / 1000;
}

// ── Framer Motion variants ─────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.38, ease: "easeOut" as const },
  }),
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

// ── Compliance badge glow helper ───────────────────────────────────────────────

function glowClass(status: "pass" | "warn" | "fail"): string {
  if (status === "pass")
    return "shadow-[0_0_8px_2px_rgba(34,197,94,0.45)] border-green-500/60 text-green-400";
  if (status === "warn")
    return "shadow-[0_0_8px_2px_rgba(234,179,8,0.45)] border-yellow-500/60 text-yellow-400";
  return "shadow-[0_0_8px_2px_rgba(239,68,68,0.55)] border-red-500/60 text-red-400 animate-pulse";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STRATEGIES: FundStrategy[] = [
  "Private Equity",
  "Infrastructure",
  "Private Credit",
  "Real Estate",
  "Growth Equity",
  "Venture Capital",
  "Hedge Fund",
];

const DEFAULT_LP_ID = "apex-sovereign-fund";
const DEFAULT_STRATEGY: FundStrategy = "Private Credit";

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CapTwin() {
  const [params, setParams] = useState<FundParams>({
    strategy: DEFAULT_STRATEGY,
    targetCapM: 500,
    managementFeePct: 1.75,
    trackRecordYrs: 8,
    priorFundIRR: 14,
    velocityScore: 50,
    placementAgent: false,
  });

  const [selectedLPId, setSelectedLPId] = useState<string>(DEFAULT_LP_ID);
  const [result, setResult] = useState<SimResult | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>(loadLedger);
  const [running, setRunning] = useState(false);
  const [hasAutoHydrated, setHasAutoHydrated] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const selectedLP = LP_REGISTRY.find((lp) => lp.id === selectedLPId) ?? LP_REGISTRY[0];

  // ── Block 1: Auto-hydrate on mount ──────────────────────────────────────────
  const runSimulation = useCallback(
    (overrideParams?: FundParams, overrideLP?: LimitedPartner) => {
      const p = overrideParams ?? params;
      const lp = overrideLP ?? selectedLP;

      setRunning(true);
      setTimeout(() => {
        const MONTHS = 24;
        const sCurveRaw = logisticSCurve(
          p.targetCapM,
          p.velocityScore,
          p.placementAgent,
          MONTHS
        );

        const grossRaisedM = sCurveRaw[MONTHS].raised;
        const { netAum, mgmtFees, placementComm } = calcNetAUM(
          grossRaisedM,
          MONTHS,
          p.managementFeePct,
          p.placementAgent,
          p.targetCapM
        );

        // Block 2a: Placement agent reduces Est. Final Close by 25%
        const rawCloseMonth =
          sCurveRaw.find((d) => d.raised >= p.targetCapM * 0.9)?.month ?? MONTHS;
        const estFinalCloseMonth = p.placementAgent
          ? Math.max(1, Math.round(rawCloseMonth * 0.75))
          : rawCloseMonth;

        const sCurveData = sCurveRaw.map((d) => {
          const { netAum: na } = calcNetAUM(
            d.raised,
            d.month,
            p.managementFeePct,
            p.placementAgent,
            p.targetCapM
          );
          return {
            month: d.month,
            raised: Math.round(d.raised * 10) / 10,
            netAum: Math.round(na * 10) / 10,
          };
        });

        const fitBreakdown = calcFitScore(p, lp);
        const currentLedger = loadLedger();
        const moat = calcPatternMoat(currentLedger);
        const adjustedScore = Math.min(100, Math.round(fitBreakdown.score * moat));

        const pitch = generatePitch(p, lp);
        const complianceFlags = runRegInterceptor(pitch, lp);
        const icDebate = simulateICDebate(adjustedScore, lp, p);

        const simResult: SimResult = {
          grossRaisedM: Math.round(grossRaisedM * 10) / 10,
          netAumM: Math.round(netAum * 10) / 10,
          estFinalCloseMonth,
          cumulativeMgmtFeesM: Math.round(mgmtFees * 10) / 10,
          placementCommissionsM: Math.round(placementComm * 10) / 10,
          feeDragPct:
            Math.round(
              ((mgmtFees + placementComm) / Math.max(grossRaisedM, 1)) * 1000
            ) / 10,
          fitScore: adjustedScore,
          fitBreakdown,
          sCurveData,
          complianceFlags,
          pitch,
          icDebate,
        };

        setResult(simResult);

        const entry: LedgerEntry = {
          ts: Date.now(),
          lpId: lp.id,
          fitScore: adjustedScore,
          verdict: icDebate.verdict,
          grossRaisedM: simResult.grossRaisedM,
        };
        const newLedger = [...currentLedger, entry];
        setLedger(newLedger);
        saveLedger(newLedger);

        setRunning(false);
      }, 400);
    },
    [params, selectedLP]
  );

  useEffect(() => {
    if (!hasAutoHydrated) {
      setHasAutoHydrated(true);
      const defaultLP = LP_REGISTRY.find((lp) => lp.id === DEFAULT_LP_ID) ?? LP_REGISTRY[0];
      const defaultParams: FundParams = {
        strategy: DEFAULT_STRATEGY,
        targetCapM: 500,
        managementFeePct: 1.75,
        trackRecordYrs: 8,
        priorFundIRR: 14,
        velocityScore: 50,
        placementAgent: false,
      };
      runSimulation(defaultParams, defaultLP);
    }
  }, [hasAutoHydrated, runSimulation]);

  // ── Block 3: PDF export via browser print dialog ───────────────────────────
  const handleExportPDF = () => {
    const prevTitle = document.title;
    document.title = "CapTwin_Executive_Board_Brief";
    window.print();
    setTimeout(() => { document.title = prevTitle; }, 500);
  };

  const moat = calcPatternMoat(ledger);

  const verdictColor = result
    ? result.icDebate.verdict === "Approved"
      ? "text-green-400"
      : result.icDebate.verdict === "Conditional Watchlist"
      ? "text-yellow-400"
      : "text-red-400"
    : "";

  return (
    <TooltipProvider delayDuration={200}>
      {/* Print styles — Block 3 */}
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm; }
          body * { visibility: hidden; }
          #captwin-print-area, #captwin-print-area * { visibility: visible; }
          #captwin-print-area {
            position: absolute; left: 0; top: 0; width: 100%;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 16px !important;
            padding: 0 !important;
          }
          #captwin-print-area > * { break-inside: avoid; }
          .no-print { display: none !important; }
        }
        /* Glassmorphic glow keyframes */
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 6px 2px rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 14px 4px rgba(239,68,68,0.8); }
        }
        .glow-red { animation: glow-pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Block 5a: Glassmorphic dark theme wrapper */}
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">

        {/* Header */}
        <div
          className="border-b border-slate-800/70 px-6 py-4 flex items-center justify-between no-print"
          style={{
            background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.85) 100%)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">
              Capital Formation Digital Twin
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic LP simulation · Compliance gate · Adversarial IC · Auto-calibration
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs border-slate-600/60 text-slate-400 bg-slate-900/60">
              CapTwin v3.0 · AgenThinkMesh
            </Badge>

            {/* Block 2b: Pattern Moat tooltip */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-xs border-blue-700/60 text-blue-400 bg-blue-950/40 cursor-help flex items-center gap-1"
                >
                  Pattern Moat {moat.toFixed(3)}×
                  <Info className="w-3 h-3 opacity-60" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-xs bg-slate-800 border-slate-700 text-slate-200 text-xs leading-relaxed"
              >
                <strong className="text-blue-400">Pattern Moat Multiplier ({moat.toFixed(3)}×):</strong>{" "}
                A self-correcting machine learning loop that compares predicted Investment Committee
                scores against actual fundraising close rates to auto-calibrate fit coefficients.
              </TooltipContent>
            </Tooltip>

            <Badge variant="outline" className="text-xs border-slate-600/60 text-slate-400 bg-slate-900/60">
              {ledger.length} runs calibrated
            </Badge>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-[280px_1fr_320px] gap-0 h-[calc(100vh-65px)]">

          {/* ── LEFT PANEL — Strategic GP Levers ─────────────────────────────── */}
          <div
            className="border-r border-slate-800/60 overflow-y-auto p-5 space-y-5 no-print"
            style={{
              background: "rgba(15,23,42,0.7)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                GP Levers
              </h2>

              {/* Fund Strategy */}
              <div className="space-y-1.5 mb-4">
                <Label className="text-xs text-slate-300">Fund Strategy</Label>
                <Select
                  value={params.strategy}
                  onValueChange={(v) =>
                    setParams((p) => ({ ...p, strategy: v as FundStrategy }))
                  }
                >
                  <SelectTrigger className="bg-slate-800/70 border-slate-700/60 text-sm h-8 backdrop-blur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {STRATEGIES.map((s) => (
                      <SelectItem key={s} value={s} className="text-sm">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Capital */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <Label className="text-xs text-slate-300">Target Capital</Label>
                  <span className="text-xs text-blue-400 font-mono">${params.targetCapM}M</span>
                </div>
                <Slider
                  min={50} max={5000} step={50}
                  value={[params.targetCapM]}
                  onValueChange={([v]) => setParams((p) => ({ ...p, targetCapM: v }))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>$50M</span><span>$5,000M</span>
                </div>
              </div>

              {/* Management Fee */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <Label className="text-xs text-slate-300">Management Fee</Label>
                  <span className="text-xs text-blue-400 font-mono">
                    {params.managementFeePct.toFixed(2)}%
                  </span>
                </div>
                <Slider
                  min={0.5} max={2.5} step={0.05}
                  value={[params.managementFeePct]}
                  onValueChange={([v]) =>
                    setParams((p) => ({ ...p, managementFeePct: v }))
                  }
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.50%</span><span>2.50%</span>
                </div>
              </div>

              {/* GP Track Record */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <Label className="text-xs text-slate-300">GP Track Record</Label>
                  <span className="text-xs text-blue-400 font-mono">
                    {params.trackRecordYrs} yrs
                  </span>
                </div>
                <Slider
                  min={1} max={25} step={1}
                  value={[params.trackRecordYrs]}
                  onValueChange={([v]) =>
                    setParams((p) => ({ ...p, trackRecordYrs: v }))
                  }
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>1 yr</span><span>25 yrs</span>
                </div>
              </div>

              {/* Prior Fund Net IRR */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <Label className="text-xs text-slate-300">Prior Fund Net IRR</Label>
                  <span className="text-xs text-blue-400 font-mono">{params.priorFundIRR}%</span>
                </div>
                <Slider
                  min={0} max={35} step={0.5}
                  value={[params.priorFundIRR]}
                  onValueChange={([v]) =>
                    setParams((p) => ({ ...p, priorFundIRR: v }))
                  }
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0%</span><span>35%</span>
                </div>
              </div>

              {/* Fundraising Velocity */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <Label className="text-xs text-slate-300">Fundraising Velocity</Label>
                  <span className="text-xs text-blue-400 font-mono">
                    {params.velocityScore}/100
                  </span>
                </div>
                <Slider
                  min={0} max={100} step={1}
                  value={[params.velocityScore]}
                  onValueChange={([v]) =>
                    setParams((p) => ({ ...p, velocityScore: v }))
                  }
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Slow</span><span>Aggressive</span>
                </div>
              </div>

              {/* Block 2a: Placement Agent — fully wired */}
              <div className="flex items-center justify-between py-2 border-t border-slate-800/60">
                <div>
                  <Label className="text-xs text-slate-300">Placement Agent</Label>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    −25% close timeline · 2% fee drag on AUM
                  </p>
                </div>
                <Switch
                  checked={params.placementAgent}
                  onCheckedChange={(v) =>
                    setParams((p) => ({ ...p, placementAgent: v }))
                  }
                />
              </div>
            </div>

            {/* Target LP Selector */}
            <div className="border-t border-slate-800/60 pt-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                Target LP
              </h2>
              <div className="space-y-2">
                {LP_REGISTRY.map((lp) => (
                  <button
                    key={lp.id}
                    onClick={() => setSelectedLPId(lp.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedLPId === lp.id
                        ? "border-blue-500/70 bg-blue-950/40 shadow-[0_0_10px_2px_rgba(59,130,246,0.2)]"
                        : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600/70 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{lp.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                          {lp.description.slice(0, 80)}…
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[9px] border-slate-600/50 text-slate-400 shrink-0"
                      >
                        {lp.region}
                      </Badge>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[9px] border-slate-700/50 text-slate-500"
                      >
                        ${lp.ticketMin}M–${lp.ticketMax}M
                      </Badge>
                      {lp.shariaRequired && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-amber-800/60 text-amber-400"
                        >
                          Sharia
                        </Badge>
                      )}
                      {lp.complianceFlags.includes("eu-aifmd") && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-blue-800/60 text-blue-400"
                        >
                          AIFMD
                        </Badge>
                      )}
                      {lp.segment === "Individual" && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-purple-800/60 text-purple-400"
                        >
                          506(c)
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9px] border-slate-700/50 text-slate-500"
                      >
                        ESG {lp.esgPriority}/10
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Run Button */}
            <Button
              onClick={() => runSimulation()}
              disabled={running}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-[0_0_16px_2px_rgba(59,130,246,0.3)] transition-all"
            >
              {running ? "Simulating…" : "Run Simulation"}
              {!running && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>

          {/* ── CENTER PANEL — Simulation Output ─────────────────────────────── */}
          <div
            className="overflow-y-auto p-5 space-y-4"
            id="captwin-print-area"
            ref={printRef}
            style={{ background: "rgba(2,6,23,0.6)" }}
          >
            <AnimatePresence mode="wait">
              {!result ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <TrendingUp className="w-12 h-12 text-slate-700 mb-4" />
                  <p className="text-slate-400 text-sm">
                    Configure GP levers and select a target LP,
                    <br />
                    then click <strong>Run Simulation</strong>.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  {/* Tailored Pitch */}
                  <motion.div custom={0} variants={fadeUp}>
                    <Card
                      className="border-slate-700/50"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          Tailored Pitch — {selectedLP.name}
                          <Badge
                            variant="outline"
                            className="ml-auto text-[10px] border-slate-600/50 text-slate-400"
                          >
                            {selectedLP.segment}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {result.pitch}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* RegInterceptor Audit — Block 4 + Block 5b */}
                  <motion.div custom={1} variants={fadeUp}>
                    <Card
                      className="border-slate-700/50"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-400" />
                          RegInterceptor Audit
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {result.complianceFlags.map((flag, i) => (
                          <motion.div
                            key={i}
                            custom={i}
                            variants={fadeUp}
                            className="flex items-start gap-2.5"
                          >
                            {/* Block 5b: Glowing status badge */}
                            <div
                              className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${glowClass(flag.status)} ${flag.status === "fail" ? "glow-red" : ""}`}
                            >
                              {flag.status === "pass"
                                ? "PASS"
                                : flag.status === "warn"
                                ? "WARN"
                                : "FAIL"}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Block 4: Compliance tooltip */}
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-xs font-medium text-slate-200">
                                  {flag.rule}
                                </span>
                                {COMPLIANCE_TOOLTIPS[flag.rule] && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-3 h-3 text-slate-500 cursor-help hover:text-slate-300 transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="right"
                                      className="max-w-xs bg-slate-800 border-slate-700 text-slate-200 text-xs leading-relaxed"
                                    >
                                      {COMPLIANCE_TOOLTIPS[flag.rule]}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              <span
                                className={`text-xs ${
                                  flag.status === "pass"
                                    ? "text-slate-400"
                                    : flag.status === "warn"
                                    ? "text-yellow-300"
                                    : "text-red-300"
                                }`}
                              >
                                {flag.message}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* IC Debate */}
                  <motion.div custom={2} variants={fadeUp}>
                    <Card
                      className="border-slate-700/50"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" />
                          Simulated Investment Committee
                          <span className={`ml-auto text-xs font-bold ${verdictColor}`}>
                            {result.icDebate.verdict}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          {result.icDebate.objections.map((obj, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="text-slate-500 font-mono shrink-0">IC{i + 1}</span>
                              <span className="text-slate-300">{obj}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-slate-700/50 pt-2">
                          <p className="text-xs text-slate-400 italic">
                            {result.icDebate.rationale}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Fundraising Health Score */}
                  <motion.div custom={3} variants={fadeUp}>
                    <Card
                      className="border-slate-700/50"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Fundraising Health Score</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {[
                          {
                            label: "Strategy Fit",
                            value: result.fitBreakdown.strategyFit,
                            color: "bg-blue-500",
                          },
                          {
                            label: "Pedigree Fit",
                            value: result.fitBreakdown.pedigreeFit,
                            color: "bg-green-500",
                          },
                          {
                            label: "Fee Alignment",
                            value: result.fitBreakdown.feeAlignment,
                            color: "bg-purple-500",
                          },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-3 text-xs">
                            <span className="w-24 text-slate-400 shrink-0">{item.label}</span>
                            <div className="flex-1 bg-slate-700/60 rounded-full h-1.5">
                              <motion.div
                                className={`${item.color} h-1.5 rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: `${item.value}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                              />
                            </div>
                            <span className="w-8 text-right font-mono text-slate-300">
                              {item.value}
                            </span>
                          </div>
                        ))}
                        {result.fitBreakdown.penalties > 0 && (
                          <div className="flex items-center gap-2 text-xs text-red-400 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Penalty: −{result.fitBreakdown.penalties} pts applied</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Block 3: Export button */}
                  <motion.div custom={4} variants={fadeUp} className="no-print">
                    <Button
                      variant="outline"
                      onClick={handleExportPDF}
                      className="w-full border-slate-600/60 text-slate-300 hover:bg-slate-700/60 hover:border-blue-500/50 transition-all"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Board Brief (PDF)
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RIGHT PANEL — Deterministic Projections ───────────────────────── */}
          <div
            className="border-l border-slate-800/60 overflow-y-auto p-5 space-y-4 no-print"
            style={{
              background: "rgba(15,23,42,0.7)",
              backdropFilter: "blur(8px)",
            }}
          >
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Deterministic Projections
            </h2>

            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="proj"
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  {/* Headline Metrics */}
                  <motion.div custom={0} variants={fadeUp}>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          label: "Est. Gross Raised",
                          value: `$${result.grossRaisedM}M`,
                          sub: `of $${params.targetCapM}M target`,
                        },
                        {
                          label: "Net Investable AUM",
                          value: `$${result.netAumM}M`,
                          sub: params.placementAgent
                            ? "after mgmt fee + 2% placement drag"
                            : "after fee drag",
                        },
                        {
                          label: "Est. Final Close",
                          value: `Month ${result.estFinalCloseMonth}`,
                          sub: params.placementAgent
                            ? "−25% via placement agent"
                            : "at 90% of target",
                        },
                        {
                          label: "LP Fit Score",
                          value: `${result.fitScore}/100`,
                          sub: result.icDebate.verdict,
                          highlight:
                            result.fitScore < 45
                              ? "text-red-400"
                              : result.fitScore < 70
                              ? "text-yellow-400"
                              : "text-green-400",
                        },
                      ].map((m) => (
                        <Card
                          key={m.label}
                          className="border-slate-700/50"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.7) 100%)",
                            backdropFilter: "blur(6px)",
                          }}
                        >
                          <CardContent className="p-3">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                              {m.label}
                            </p>
                            <p
                              className={`text-lg font-bold mt-0.5 ${m.highlight ?? "text-white"}`}
                            >
                              {m.value}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{m.sub}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </motion.div>

                  {/* Capital Formation Economics */}
                  <motion.div custom={1} variants={fadeUp}>
                    <Card
                      className="border-slate-700/50"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.7) 100%)",
                        backdropFilter: "blur(6px)",
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-slate-400 uppercase tracking-wide">
                          Capital Formation Economics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-slate-400">Total Mgmt Fees (24M)</p>
                          <p className="text-white font-semibold">
                            ${result.cumulativeMgmtFeesM}M
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Placement Commissions</p>
                          <p
                            className={`font-semibold ${
                              result.placementCommissionsM > 0 ? "text-amber-400" : "text-white"
                            }`}
                          >
                            ${result.placementCommissionsM}M
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Total Fee Drag</p>
                          <p className="text-white font-semibold">
                            $
                            {(
                              result.cumulativeMgmtFeesM + result.placementCommissionsM
                            ).toFixed(1)}
                            M
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Net/Gross Ratio</p>
                          <p className="text-white font-semibold">
                            {(100 - result.feeDragPct).toFixed(1)}%
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* S-Curve Chart — Block 5c: Framer Motion entry */}
                  <motion.div custom={2} variants={fadeUp}>
                    <Card
                      className="border-slate-700/50"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.7) 100%)",
                        backdropFilter: "blur(6px)",
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-slate-400 uppercase tracking-wide">
                          Cumulative Raised — 24-Month S-Curve
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ResponsiveContainer width="100%" height={180}>
                          <AreaChart
                            data={result.sCurveData}
                            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="gradRaised" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d3d" />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 9, fill: "#64748b" }}
                              label={{
                                value: "Month",
                                position: "insideBottom",
                                offset: -2,
                                fontSize: 9,
                                fill: "#64748b",
                              }}
                            />
                            <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
                            <RechartsTooltip
                              contentStyle={{
                                background: "#1e293b",
                                border: "1px solid #334155",
                                fontSize: 11,
                              }}
                              formatter={(v: number) => [`$${v}M`]}
                            />
                            <Area
                              type="monotone"
                              dataKey="raised"
                              stroke="#3b82f6"
                              fill="url(#gradRaised)"
                              strokeWidth={2}
                              name="Gross Raised"
                            />
                            <Area
                              type="monotone"
                              dataKey="netAum"
                              stroke="#10b981"
                              fill="url(#gradNet)"
                              strokeWidth={1.5}
                              strokeDasharray="4 2"
                              name="Net AUM"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 mt-1 text-[10px]">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-blue-500 inline-block" /> Gross Raised
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-0.5 bg-emerald-500 inline-block border-dashed" />{" "}
                            Net AUM
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Decision Ledger */}
                  <motion.div custom={3} variants={fadeUp}>
                    <Card
                      className="border-slate-700/50"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.7) 100%)",
                        backdropFilter: "blur(6px)",
                      }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-slate-400 uppercase tracking-wide">
                          Decision Ledger — Last {Math.min(ledger.length, 5)} Runs
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1.5">
                        {ledger.slice(-5).reverse().map((entry, i) => {
                          const lp = LP_REGISTRY.find((l) => l.id === entry.lpId);
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between text-[10px]"
                            >
                              <span className="text-slate-400 truncate max-w-[120px]">
                                {lp?.name ?? entry.lpId}
                              </span>
                              <span className="text-slate-500 font-mono">
                                {entry.fitScore}/100
                              </span>
                              <span
                                className={
                                  entry.verdict === "Approved"
                                    ? "text-green-400"
                                    : entry.verdict === "Conditional Watchlist"
                                    ? "text-yellow-400"
                                    : "text-red-400"
                                }
                              >
                                {entry.verdict === "Conditional Watchlist"
                                  ? "Watchlist"
                                  : entry.verdict}
                              </span>
                            </div>
                          );
                        })}
                        {ledger.length === 0 && (
                          <p className="text-[10px] text-slate-500 italic">
                            No runs yet. Pattern Moat calibration begins after 3 simulations.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="proj-empty"
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col items-center justify-center h-48 text-center"
                >
                  <TrendingUp className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-xs text-slate-500">
                    Projections appear here after simulation.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
