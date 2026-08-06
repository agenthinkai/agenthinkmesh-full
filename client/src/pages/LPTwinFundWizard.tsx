/**
 * LPTwinFundWizard.tsx — 8-Step Fund Setup Wizard
 * CapTwin Enterprise Module — WP3
 *
 * Steps:
 *  1. Fund Identity
 *  2. Economics
 *  3. Investment Proposition
 *  4. Risk and Liquidity
 *  5. GP Credibility
 *  6. Institutional Requirements
 *  7. Evidence Review
 *  8. Confirm and Create
 *
 * Features:
 * - Save draft at any step (uses updateFund if fundId exists, createFund otherwise)
 * - Resume later (fundId in URL param)
 * - Validation errors shown clearly
 * - Optional fields labelled
 * - Missing evidence labelled
 * - No fabricated defaults
 * - Review screen before submission
 * - Returns real fund ID on success
 */

import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ArrowRight, FlaskConical, Save, CheckCircle2,
  AlertTriangle, Info, Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ── Constants ─────────────────────────────────────────────────────────────────

const STRATEGIES = [
  "Private Equity", "Venture Capital", "Private Credit", "Real Estate",
  "Infrastructure", "Hedge Fund", "Fund of Funds", "Growth Equity",
];

const ASSET_CLASSES = [
  "Buyout", "Growth", "Venture", "Credit", "Real Assets",
  "Infrastructure", "Multi-Asset", "Special Situations",
];

const GEOGRAPHIES = [
  "Global", "North America", "Europe", "Asia Pacific", "Middle East & Africa",
  "Latin America", "GCC", "Southeast Asia", "Pan-European",
];

const DOMICILES = [
  "Cayman Islands", "Delaware (US)", "Luxembourg", "Jersey", "Guernsey",
  "Ireland", "Singapore", "UAE (ADGM)", "UAE (DIFC)", "BVI",
];

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SGD", "JPY", "CHF"];

const STEP_LABELS = [
  "Fund Identity",
  "Economics",
  "Investment Proposition",
  "Risk & Liquidity",
  "GP Credibility",
  "Institutional Requirements",
  "Evidence Review",
  "Confirm & Create",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface FundDraft {
  // Step 1
  fundName: string;
  gpName: string;
  strategy: string;
  assetClass: string;
  geography: string;
  domicile: string;
  currency: string;
  targetFundSizeM: string;
  // Step 2
  managementFeePct: string;
  carryPct: string;
  hurdleRatePct: string;
  preferredReturnPct: string;
  // Step 3
  investmentThesis: string;
  targetSectors: string;
  valueCreationApproach: string;
  competitiveAdvantage: string;
  // Step 4
  fundTerm: string;
  investmentPeriod: string;
  liquidityProvisions: string;
  riskFactors: string;
  // Step 5
  trackRecordYrs: string;
  priorFundIRR: string;
  priorFundMOIC: string;
  vintageYear: string;
  fundNumber: string;
  teamStability: string;
  // Step 6
  minTicketM: string;
  maxTicketM: string;
  shariaCompliant: boolean;
  esgPolicy: string;
  reportingFrequency: string;
  auditFirm: string;
  // Step 7 — evidence flags (set automatically)
  evidenceStatus: string;
}

const EMPTY_DRAFT: FundDraft = {
  fundName: "", gpName: "", strategy: "", assetClass: "", geography: "",
  domicile: "", currency: "USD", targetFundSizeM: "",
  managementFeePct: "", carryPct: "", hurdleRatePct: "", preferredReturnPct: "",
  investmentThesis: "", targetSectors: "", valueCreationApproach: "", competitiveAdvantage: "",
  fundTerm: "", investmentPeriod: "", liquidityProvisions: "", riskFactors: "",
  trackRecordYrs: "", priorFundIRR: "", priorFundMOIC: "", vintageYear: "", fundNumber: "", teamStability: "",
  minTicketM: "", maxTicketM: "", shariaCompliant: false, esgPolicy: "", reportingFrequency: "", auditFirm: "",
  evidenceStatus: "draft",
};

// ── Validation ────────────────────────────────────────────────────────────────

function validateStep(step: number, draft: FundDraft): string[] {
  const errors: string[] = [];
  if (step === 0) {
    if (!draft.fundName.trim()) errors.push("Fund name is required");
    if (!draft.gpName.trim()) errors.push("GP / Manager name is required");
    if (!draft.strategy) errors.push("Strategy is required");
    if (!draft.targetFundSizeM || Number(draft.targetFundSizeM) <= 0) errors.push("Target fund size must be a positive number");
  }
  if (step === 1) {
    if (!draft.managementFeePct || Number(draft.managementFeePct) < 0 || Number(draft.managementFeePct) > 5)
      errors.push("Management fee must be between 0% and 5%");
    if (!draft.carryPct || Number(draft.carryPct) < 0 || Number(draft.carryPct) > 40)
      errors.push("Carry must be between 0% and 40%");
  }
  if (step === 4) {
    if (!draft.trackRecordYrs || Number(draft.trackRecordYrs) < 0)
      errors.push("Track record years must be 0 or greater");
    if (!draft.priorFundIRR) errors.push("Prior fund IRR is required");
  }
  return errors;
}

function computeEvidenceGaps(draft: FundDraft): string[] {
  const gaps: string[] = [];
  if (!draft.investmentThesis.trim()) gaps.push("Investment thesis not provided");
  if (!draft.valueCreationApproach.trim()) gaps.push("Value creation approach not provided");
  if (!draft.competitiveAdvantage.trim()) gaps.push("Competitive advantage not described");
  if (!draft.riskFactors.trim()) gaps.push("Risk factors not documented");
  if (!draft.priorFundMOIC) gaps.push("Prior fund MOIC not provided");
  if (!draft.teamStability.trim()) gaps.push("Team stability not described");
  if (!draft.esgPolicy.trim()) gaps.push("ESG policy not provided");
  if (!draft.auditFirm.trim()) gaps.push("Audit firm not specified");
  return gaps;
}

// ── Field components ──────────────────────────────────────────────────────────

function FieldGroup({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        {required && <span className="text-destructive">*</span>}
        {!required && <Badge variant="outline" className="text-xs py-0 h-4">Optional</Badge>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Step components ───────────────────────────────────────────────────────────

function Step1({ draft, set }: { draft: FundDraft; set: (k: keyof FundDraft, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldGroup label="Fund Name" required>
          <Input placeholder="e.g. Horizon Capital Fund III" value={draft.fundName} onChange={(e) => set("fundName", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="GP / Manager Name" required>
          <Input placeholder="e.g. Horizon Capital Partners" value={draft.gpName} onChange={(e) => set("gpName", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Strategy" required>
          <Select value={draft.strategy} onValueChange={(v) => set("strategy", v)}>
            <SelectTrigger><SelectValue placeholder="Select strategy" /></SelectTrigger>
            <SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Asset Class">
          <Select value={draft.assetClass} onValueChange={(v) => set("assetClass", v)}>
            <SelectTrigger><SelectValue placeholder="Select asset class" /></SelectTrigger>
            <SelectContent>{ASSET_CLASSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Geography">
          <Select value={draft.geography} onValueChange={(v) => set("geography", v)}>
            <SelectTrigger><SelectValue placeholder="Select geography" /></SelectTrigger>
            <SelectContent>{GEOGRAPHIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Domicile">
          <Select value={draft.domicile} onValueChange={(v) => set("domicile", v)}>
            <SelectTrigger><SelectValue placeholder="Select domicile" /></SelectTrigger>
            <SelectContent>{DOMICILES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Currency" required>
          <Select value={draft.currency} onValueChange={(v) => set("currency", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Target Fund Size (M)" required hint="Enter the target raise in millions of the selected currency">
          <Input type="number" min={1} placeholder="e.g. 300" value={draft.targetFundSizeM} onChange={(e) => set("targetFundSizeM", e.target.value)} />
        </FieldGroup>
      </div>
    </div>
  );
}

function Step2({ draft, set }: { draft: FundDraft; set: (k: keyof FundDraft, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FieldGroup label="Management Fee (%)" required hint="Annual, on committed capital">
          <Input type="number" step="0.25" min={0} max={5} placeholder="2.0" value={draft.managementFeePct} onChange={(e) => set("managementFeePct", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Carry (%)" required>
          <Input type="number" step={1} min={0} max={40} placeholder="20" value={draft.carryPct} onChange={(e) => set("carryPct", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Hurdle Rate (%)">
          <Input type="number" step={1} min={0} max={30} placeholder="8" value={draft.hurdleRatePct} onChange={(e) => set("hurdleRatePct", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Preferred Return (%)">
          <Input type="number" step={1} min={0} max={30} placeholder="8" value={draft.preferredReturnPct} onChange={(e) => set("preferredReturnPct", e.target.value)} />
        </FieldGroup>
      </div>
    </div>
  );
}

function Step3({ draft, set }: { draft: FundDraft; set: (k: keyof FundDraft, v: string) => void }) {
  return (
    <div className="space-y-4">
      <FieldGroup label="Investment Thesis" hint="Describe the core investment rationale in 2–4 sentences">
        <Textarea rows={3} placeholder="e.g. We target mid-market buyouts in defensive consumer sectors with proven management teams…" value={draft.investmentThesis} onChange={(e) => set("investmentThesis", e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Target Sectors">
        <Input placeholder="e.g. Healthcare, Technology, Consumer Staples" value={draft.targetSectors} onChange={(e) => set("targetSectors", e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Value Creation Approach">
        <Textarea rows={2} placeholder="e.g. Operational improvement, buy-and-build, management alignment…" value={draft.valueCreationApproach} onChange={(e) => set("valueCreationApproach", e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Competitive Advantage">
        <Textarea rows={2} placeholder="e.g. Proprietary deal flow from 20-year regional network, sector-specialist operating partners…" value={draft.competitiveAdvantage} onChange={(e) => set("competitiveAdvantage", e.target.value)} />
      </FieldGroup>
    </div>
  );
}

function Step4({ draft, set }: { draft: FundDraft; set: (k: keyof FundDraft, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Fund Term (years)">
          <Input type="number" min={1} max={20} placeholder="10" value={draft.fundTerm} onChange={(e) => set("fundTerm", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Investment Period (years)">
          <Input type="number" min={1} max={10} placeholder="5" value={draft.investmentPeriod} onChange={(e) => set("investmentPeriod", e.target.value)} />
        </FieldGroup>
      </div>
      <FieldGroup label="Liquidity Provisions">
        <Textarea rows={2} placeholder="e.g. No secondary market; distributions upon exit. LP transfer with GP consent." value={draft.liquidityProvisions} onChange={(e) => set("liquidityProvisions", e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Key Risk Factors">
        <Textarea rows={3} placeholder="e.g. Concentration risk in mid-market buyouts; currency risk on European investments; GP key-man risk…" value={draft.riskFactors} onChange={(e) => set("riskFactors", e.target.value)} />
      </FieldGroup>
    </div>
  );
}

function Step5({ draft, set }: { draft: FundDraft; set: (k: keyof FundDraft, v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <FieldGroup label="GP Track Record (years)" required>
          <Input type="number" min={0} max={50} placeholder="e.g. 8" value={draft.trackRecordYrs} onChange={(e) => set("trackRecordYrs", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Prior Fund Net IRR (%)" required>
          <Input type="number" step="0.1" placeholder="e.g. 18.5" value={draft.priorFundIRR} onChange={(e) => set("priorFundIRR", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Prior Fund MOIC">
          <Input type="number" step="0.1" min={0} placeholder="e.g. 2.4" value={draft.priorFundMOIC} onChange={(e) => set("priorFundMOIC", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Prior Fund Vintage Year">
          <Input type="number" min={1990} max={2030} placeholder="e.g. 2018" value={draft.vintageYear} onChange={(e) => set("vintageYear", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Fund Number (e.g. III = 3)">
          <Input type="number" min={1} placeholder="e.g. 3" value={draft.fundNumber} onChange={(e) => set("fundNumber", e.target.value)} />
        </FieldGroup>
      </div>
      <FieldGroup label="Team Stability">
        <Textarea rows={2} placeholder="e.g. Core investment team of 6 partners with average 12-year tenure. No departures in last 5 years." value={draft.teamStability} onChange={(e) => set("teamStability", e.target.value)} />
      </FieldGroup>
    </div>
  );
}

function Step6({ draft, set, setB }: {
  draft: FundDraft;
  set: (k: keyof FundDraft, v: string) => void;
  setB: (k: keyof FundDraft, v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Minimum Ticket (USD M)">
          <Input type="number" min={0} placeholder="e.g. 10" value={draft.minTicketM} onChange={(e) => set("minTicketM", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Maximum Ticket (USD M)">
          <Input type="number" min={0} placeholder="e.g. 50" value={draft.maxTicketM} onChange={(e) => set("maxTicketM", e.target.value)} />
        </FieldGroup>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
        <Checkbox
          id="sharia"
          checked={draft.shariaCompliant}
          onCheckedChange={(v) => setB("shariaCompliant", !!v)}
        />
        <label htmlFor="sharia" className="text-sm cursor-pointer">
          Sharia-compliant fund structure
        </label>
      </div>
      <FieldGroup label="ESG Policy">
        <Textarea rows={2} placeholder="e.g. Signatory to UN PRI. ESG integrated into due diligence. Annual ESG reporting to LPs." value={draft.esgPolicy} onChange={(e) => set("esgPolicy", e.target.value)} />
      </FieldGroup>
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="Reporting Frequency">
          <Select value={draft.reportingFrequency} onValueChange={(v) => set("reportingFrequency", v)}>
            <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
            <SelectContent>
              {["Monthly", "Quarterly", "Semi-Annual", "Annual"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Audit Firm">
          <Input placeholder="e.g. Deloitte, PwC, KPMG, EY" value={draft.auditFirm} onChange={(e) => set("auditFirm", e.target.value)} />
        </FieldGroup>
      </div>
    </div>
  );
}

function Step7({ draft }: { draft: FundDraft }) {
  const gaps = computeEvidenceGaps(draft);
  const completedFields = 8 - gaps.length;
  const completionPct = Math.round((completedFields / 8) * 100);

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Evidence Completeness</p>
          <span className="text-sm font-mono font-semibold">{completionPct}%</span>
        </div>
        <Progress value={completionPct} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">
          {gaps.length === 0
            ? "All evidence fields are complete. This fund profile will score well against institutional LP requirements."
            : `${gaps.length} evidence gap${gaps.length > 1 ? "s" : ""} identified. You can still create the fund and complete these later.`}
        </p>
      </div>

      {gaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> Missing Evidence
          </p>
          <ul className="space-y-1.5">
            {gaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-muted-foreground">{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gaps.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Evidence complete. This fund profile is ready for simulation.
        </div>
      )}

      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Evidence gaps reduce fit scores against institutional LPs with strict due diligence requirements.
          Complete all fields before running simulations for the most accurate results.
        </span>
      </div>
    </div>
  );
}

function Step8({ draft }: { draft: FundDraft }) {
  const gaps = computeEvidenceGaps(draft);

  const sections = [
    {
      title: "Fund Identity",
      fields: [
        { label: "Fund Name", value: draft.fundName },
        { label: "GP Name", value: draft.gpName },
        { label: "Strategy", value: draft.strategy },
        { label: "Asset Class", value: draft.assetClass || "—" },
        { label: "Geography", value: draft.geography || "—" },
        { label: "Domicile", value: draft.domicile || "—" },
        { label: "Currency", value: draft.currency },
        { label: "Target Size", value: draft.targetFundSizeM ? `${draft.currency} ${Number(draft.targetFundSizeM).toLocaleString()}M` : "—" },
      ],
    },
    {
      title: "Economics",
      fields: [
        { label: "Management Fee", value: draft.managementFeePct ? `${draft.managementFeePct}%` : "—" },
        { label: "Carry", value: draft.carryPct ? `${draft.carryPct}%` : "—" },
        { label: "Hurdle Rate", value: draft.hurdleRatePct ? `${draft.hurdleRatePct}%` : "—" },
        { label: "Preferred Return", value: draft.preferredReturnPct ? `${draft.preferredReturnPct}%` : "—" },
      ],
    },
    {
      title: "GP Credibility",
      fields: [
        { label: "Track Record", value: draft.trackRecordYrs ? `${draft.trackRecordYrs} years` : "—" },
        { label: "Prior Fund IRR", value: draft.priorFundIRR ? `${draft.priorFundIRR}%` : "—" },
        { label: "Prior Fund MOIC", value: draft.priorFundMOIC ? `${draft.priorFundMOIC}x` : "—" },
        { label: "Vintage Year", value: draft.vintageYear || "—" },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{section.title}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {section.fields.map((f) => (
              <div key={f.label}>
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {gaps.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {gaps.length} evidence gap{gaps.length > 1 ? "s" : ""} will be recorded. The fund will be created with status <strong>draft</strong>.
            You can complete the missing fields by editing the fund later.
          </span>
        </div>
      )}

      <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Creating this fund will save a persistent record to your organisation. The fund ID will be returned and
          you will be redirected to run a simulation.
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LPTwinFundWizard() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const existingFundId = params.get("fundId") ? Number(params.get("fundId")) : null;

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FundDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedFundId, setSavedFundId] = useState<number | null>(existingFundId);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // If resuming an existing fund, load it
  const { data: existingFundData } = trpc.lpTwin.getFund.useQuery(
    { fundId: existingFundId! },
    { enabled: !!existingFundId }
  );

  useEffect(() => {
    if (existingFundData?.fund) {
      const f = existingFundData.fund;
      const econ = f.economicsJson ? JSON.parse(f.economicsJson) : {};
      const track = f.trackRecordJson ? JSON.parse(f.trackRecordJson) : {};
      const prop = f.investmentPropositionJson ? JSON.parse(f.investmentPropositionJson) : {};
      const risk = f.riskLiquidityJson ? JSON.parse(f.riskLiquidityJson) : {};
      const inst = f.institutionalRequirementsJson ? JSON.parse(f.institutionalRequirementsJson) : {};
      setDraft({
        fundName: f.fundName,
        gpName: f.gpName,
        strategy: f.strategy,
        assetClass: f.assetClass ?? "",
        geography: f.geography ?? "",
        domicile: f.domicile ?? "",
        currency: f.currency ?? "USD",
        targetFundSizeM: String(f.targetFundSizeM),
        managementFeePct: String(econ.managementFeePct ?? ""),
        carryPct: String(econ.carryPct ?? ""),
        hurdleRatePct: String(econ.hurdleRatePct ?? ""),
        preferredReturnPct: String(econ.preferredReturnPct ?? ""),
        investmentThesis: prop.investmentThesis ?? "",
        targetSectors: prop.targetSectors ?? "",
        valueCreationApproach: prop.valueCreationApproach ?? "",
        competitiveAdvantage: prop.competitiveAdvantage ?? "",
        fundTerm: String(risk.fundTerm ?? ""),
        investmentPeriod: String(risk.investmentPeriod ?? ""),
        liquidityProvisions: risk.liquidityProvisions ?? "",
        riskFactors: risk.riskFactors ?? "",
        trackRecordYrs: String(track.trackRecordYrs ?? ""),
        priorFundIRR: String(track.priorFundIRR ?? ""),
        priorFundMOIC: String(track.priorFundMOIC ?? ""),
        vintageYear: String(track.vintageYear ?? ""),
        fundNumber: String(track.fundNumber ?? ""),
        teamStability: track.teamStability ?? "",
        minTicketM: String(inst.minTicketM ?? ""),
        maxTicketM: String(inst.maxTicketM ?? ""),
        shariaCompliant: inst.shariaCompliant ?? false,
        esgPolicy: inst.esgPolicy ?? "",
        reportingFrequency: inst.reportingFrequency ?? "",
        auditFirm: inst.auditFirm ?? "",
        evidenceStatus: f.evidenceStatus ?? "draft",
      });
      setSavedFundId(f.id);
    }
  }, [existingFundData]);

  const createFundMutation = trpc.lpTwin.createFund.useMutation();
  const updateFundMutation = trpc.lpTwin.updateFund.useMutation();

  function setField(k: keyof FundDraft, v: string) {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors([]);
  }

  function setBoolField(k: keyof FundDraft, v: boolean) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function buildPayload() {
    const gaps = computeEvidenceGaps(draft);
    return {
      fundName: draft.fundName,
      gpName: draft.gpName,
      strategy: draft.strategy,
      assetClass: draft.assetClass || undefined,
      geography: draft.geography || undefined,
      domicile: draft.domicile || undefined,
      currency: draft.currency,
      targetFundSizeM: Number(draft.targetFundSizeM),
      economics: {
        managementFeePct: Number(draft.managementFeePct),
        carryPct: Number(draft.carryPct),
        hurdleRatePct: draft.hurdleRatePct ? Number(draft.hurdleRatePct) : undefined,
        preferredReturnPct: draft.preferredReturnPct ? Number(draft.preferredReturnPct) : undefined,
      },
      investmentProposition: {
        investmentThesis: draft.investmentThesis,
        targetSectors: draft.targetSectors,
        valueCreationApproach: draft.valueCreationApproach,
        competitiveAdvantage: draft.competitiveAdvantage,
      },
      riskLiquidity: {
        fundTerm: draft.fundTerm ? Number(draft.fundTerm) : undefined,
        investmentPeriod: draft.investmentPeriod ? Number(draft.investmentPeriod) : undefined,
        liquidityProvisions: draft.liquidityProvisions,
        riskFactors: draft.riskFactors,
      },
      trackRecord: {
        trackRecordYrs: Number(draft.trackRecordYrs),
        priorFundIRR: Number(draft.priorFundIRR),
        priorFundMOIC: draft.priorFundMOIC ? Number(draft.priorFundMOIC) : undefined,
        vintageYear: draft.vintageYear ? Number(draft.vintageYear) : undefined,
        fundNumber: draft.fundNumber ? Number(draft.fundNumber) : undefined,
        teamStability: draft.teamStability,
      },
      institutionalRequirements: {
        minTicketM: draft.minTicketM ? Number(draft.minTicketM) : undefined,
        maxTicketM: draft.maxTicketM ? Number(draft.maxTicketM) : undefined,
        shariaCompliant: draft.shariaCompliant,
        esgPolicy: draft.esgPolicy,
        reportingFrequency: draft.reportingFrequency,
        auditFirm: draft.auditFirm,
      },
      evidenceStatus: gaps.length === 0 ? "complete" as const : "draft" as const,
    };
  }

  async function handleSaveDraft() {
    // Only validate step 0 and 1 minimums for draft save
    const errs: string[] = [];
    if (!draft.fundName.trim()) errs.push("Fund name is required to save a draft");
    if (!draft.gpName.trim()) errs.push("GP name is required to save a draft");
    if (errs.length > 0) { setErrors(errs); return; }

    setIsSaving(true);
    try {
      if (savedFundId) {
        const payload = buildPayload();
        await updateFundMutation.mutateAsync({ fundId: savedFundId, ...payload });
        toast.success("Draft saved");
      } else if (draft.strategy && draft.targetFundSizeM && draft.managementFeePct && draft.carryPct && draft.trackRecordYrs && draft.priorFundIRR) {
        const result = await createFundMutation.mutateAsync(buildPayload());
        setSavedFundId(result.fundId);
        toast.success("Draft saved", { description: `Fund ID: ${result.fundId}` });
      } else {
        toast("Draft saved locally — complete required fields to persist to database");
      }
    } catch (err: unknown) {
      toast.error("Save failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsSaving(false);
    }
  }

  function handleNext() {
    const errs = validateStep(step, draft);
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setStep((s) => Math.min(s + 1, 7));
  }

  function handleBack() {
    setErrors([]);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleCreate() {
    const errs = [
      ...validateStep(0, draft),
      ...validateStep(1, draft),
      ...validateStep(4, draft),
    ];
    if (errs.length > 0) { setErrors(errs); return; }

    setIsCreating(true);
    try {
      let fundId = savedFundId;
      if (fundId) {
        await updateFundMutation.mutateAsync({ fundId, ...buildPayload() });
      } else {
        const result = await createFundMutation.mutateAsync(buildPayload());
        fundId = result.fundId;
      }
      toast.success("Fund created", { description: `Fund ID: ${fundId}` });
      navigate(`/captwin/lp-twin/new?fundId=${fundId}&step=session`);
    } catch (err: unknown) {
      toast.error("Creation failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsCreating(false);
    }
  }

  const progressPct = Math.round(((step + 1) / 8) * 100);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-background/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/captwin/lp-twin")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              <h1 className="text-base font-bold">
                {existingFundId ? "Edit Fund Profile" : "New Fund Profile"}
              </h1>
            </div>
            {savedFundId && (
              <Badge variant="outline" className="text-xs font-mono">ID {savedFundId}</Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Draft
          </Button>
        </div>
        {/* Progress bar */}
        <div className="max-w-3xl mx-auto px-6 pb-3">
          <div className="flex items-center gap-3">
            <Progress value={progressPct} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Step {step + 1} of 8 — {STEP_LABELS[step]}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Step label */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold">{STEP_LABELS[step]}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {step === 0 && "Basic information about the fund being tested."}
            {step === 1 && "Fee structure and economics. These are scored against LP fee tolerance thresholds."}
            {step === 2 && "Describe the investment thesis and strategy. Optional but improves simulation quality."}
            {step === 3 && "Fund term, liquidity, and risk factors. Optional but improves simulation quality."}
            {step === 4 && "GP track record and team credibility. Required fields are used to score LP fit."}
            {step === 5 && "Institutional requirements and compliance. Optional but required for some LP archetypes."}
            {step === 6 && "Review evidence completeness before creating the fund."}
            {step === 7 && "Review all details before creating the fund profile."}
          </p>
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="mb-5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {e}
              </p>
            ))}
          </div>
        )}

        {/* Step content */}
        {step === 0 && <Step1 draft={draft} set={setField} />}
        {step === 1 && <Step2 draft={draft} set={setField} />}
        {step === 2 && <Step3 draft={draft} set={setField} />}
        {step === 3 && <Step4 draft={draft} set={setField} />}
        {step === 4 && <Step5 draft={draft} set={setField} />}
        {step === 5 && <Step6 draft={draft} set={setField} setB={setBoolField} />}
        {step === 6 && <Step7 draft={draft} />}
        {step === 7 && <Step8 draft={draft} />}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button variant="outline" onClick={handleBack} disabled={step === 0} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < 7 ? (
            <Button onClick={handleNext} className="gap-1">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={isCreating} className="gap-1.5">
              {isCreating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Create Fund Profile</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
