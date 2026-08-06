import { useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SegmentScenarioResult {
  segmentId: string;
  segmentName: string;
  baseFitScore: number;
  scenarioFitScore: number;
  scoreDelta: number;
  baseCategory: string;
  scenarioCategory: string;
  objectionsAdded: Array<{ category: string; statement: string; severity: string }>;
  objectionsResolved: Array<{ category: string; statement: string; severity: string }>;
  objectionsAddedCount: number;
  objectionsResolvedCount: number;
  eligibilityChanged: boolean;
  baseEligible: boolean;
  scenarioEligible: boolean;
}

interface TermImpact {
  field: string;
  label: string;
  baseValue: unknown;
  proposedValue: unknown;
  avgFitDelta: number;
  segmentsHelped: string[];
  segmentsHarmed: string[];
  objectionsResolved: string[];
  newObjections: string[];
  commercialTradeOff: string;
  governanceConsequence: string;
  evidenceRequired: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fitCategoryColor(cat: string): string {
  if (cat === "Strong Fit") return "text-emerald-400";
  if (cat === "Conditional Fit") return "text-yellow-400";
  if (cat === "Weak Fit") return "text-orange-400";
  return "text-red-400";
}

function deltaColor(delta: number): string {
  if (delta > 3) return "text-emerald-400";
  if (delta < -3) return "text-red-400";
  return "text-slate-400";
}

function ScoreBadge({ score, category }: { score: number; category: string }) {
  const bg = category === "Strong Fit" ? "bg-emerald-900/40 border-emerald-700" :
    category === "Conditional Fit" ? "bg-yellow-900/40 border-yellow-700" :
    category === "Weak Fit" ? "bg-orange-900/40 border-orange-700" :
    "bg-red-900/40 border-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${bg}`}>
      <span className={fitCategoryColor(category)}>{score}</span>
      <span className="text-slate-500">/100</span>
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LPTwinLaboratory() {
  const [, params] = useRoute("/captwin/lp-twin/fund/:fundId/laboratory");
  const [, navigate] = useLocation();
  const fundId = params?.fundId ? parseInt(params.fundId, 10) : null;

  // Fund data
  const { data: fundData } = trpc.lpTwin.getFund.useQuery(
    { fundId: fundId! },
    { enabled: !!fundId }
  );

  // Proposed terms state
  const [proposedTerms, setProposedTerms] = useState<Record<string, number | boolean | string>>({});
  const [scenarioName, setScenarioName] = useState("");
  const [previewResult, setPreviewResult] = useState<{
    segmentResults: SegmentScenarioResult[];
    termImpacts: TermImpact[];
    avgScoreDelta: number;
    disclaimer: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"laboratory" | "sequence" | "stress" | "sensitivity">("laboratory");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState("balanced");
  const [selectedTemplate, setSelectedTemplate] = useState("diversified_global");
  const [stressConditions, setStressConditions] = useState<string[]>([]);
  const [sensitivityField, setSensitivityField] = useState("managementFeePct");
  const [sensitivityMin, setSensitivityMin] = useState(0.5);
  const [sensitivityMax, setSensitivityMax] = useState(3.0);

  // Mutations
  const previewMutation = trpc.lpTwinScenario.previewScenario.useMutation({
    onSuccess: (data) => {
      setPreviewResult(data);
      toast.success(`Preview complete — avg delta: ${data.avgScoreDelta > 0 ? "+" : ""}${data.avgScoreDelta} pts`);
    },
    onError: (e) => toast.error(`Preview failed: ${e.message}`),
  });

  const createMutation = trpc.lpTwinScenario.createScenario.useMutation({
    onSuccess: (data) => {
      toast.success("Scenario saved");
      setSaveDialogOpen(false);
      navigate(`/captwin/lp-twin/scenario/${data.scenarioId}`);
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const sequenceMutation = trpc.lpTwinScenario.generateSequence.useMutation({
    onError: (e) => toast.error(`Sequence failed: ${e.message}`),
  });

  const stressMutation = trpc.lpTwinScenario.runMarketStress.useMutation({
    onError: (e) => toast.error(`Stress test failed: ${e.message}`),
  });

  const sensitivityMutation = trpc.lpTwinScenario.runSensitivity.useMutation({
    onError: (e) => toast.error(`Sensitivity failed: ${e.message}`),
  });

  const fund = fundData?.fund;
  if (!fundId || !fund) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading fund data…</div>
      </div>
    );
  }

  const economics = fund.economicsJson ? JSON.parse(fund.economicsJson) : {};
  const trackRecord = fund.trackRecordJson ? JSON.parse(fund.trackRecordJson) : {};

  const handlePreview = () => {
    if (Object.keys(proposedTerms).length === 0) {
      toast.info("Adjust at least one term to preview the scenario");
      return;
    }
    previewMutation.mutate({ fundId, proposedTerms });
  };

  const handleSave = () => {
    if (!scenarioName.trim()) {
      toast.error("Enter a scenario name");
      return;
    }
    createMutation.mutate({
      fundId,
      scenarioName: scenarioName.trim(),
      scenarioType: "term_change",
      proposedTerms,
    });
  };

  const handleGenerateSequence = () => {
    sequenceMutation.mutate({
      fundId,
      objective: selectedObjective as "balanced",
      template: selectedTemplate as "diversified_global",
    });
  };

  const handleStressTest = () => {
    if (stressConditions.length === 0) {
      toast.info("Select at least one market stress condition");
      return;
    }
    stressMutation.mutate({ fundId, conditions: stressConditions });
  };

  const handleSensitivity = () => {
    sensitivityMutation.mutate({
      fundId,
      field: sensitivityField,
      minValue: sensitivityMin,
      maxValue: sensitivityMax,
      steps: 8,
    });
  };

  const updateTerm = useCallback((field: string, value: number | boolean | string) => {
    setProposedTerms((prev) => ({ ...prev, [field]: value }));
  }, []);

  const STRESS_OPTIONS = [
    { id: "higher_interest_rates", label: "Higher Interest Rates" },
    { id: "lower_public_market_valuations", label: "Lower Public Market Valuations" },
    { id: "reduced_distributions", label: "Reduced Distributions" },
    { id: "slower_exits", label: "Slower Exits" },
    { id: "increased_lp_liquidity_pressure", label: "Increased LP Liquidity Pressure" },
    { id: "stronger_demand_for_yield", label: "Stronger Demand for Yield" },
    { id: "higher_currency_volatility", label: "Higher Currency Volatility" },
    { id: "increased_coinvestment_preference", label: "Increased Co-Investment Preference" },
    { id: "lower_tolerance_first_time_managers", label: "Lower Tolerance for First-Time Managers" },
    { id: "increased_sharia_allocation", label: "Increased Sharia Allocation" },
    { id: "increased_esg_scrutiny", label: "Increased ESG Scrutiny" },
    { id: "longer_ic_cycles", label: "Longer IC Cycles" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/captwin/lp-twin/fund/${fundId}`)}
              className="text-slate-400 hover:text-slate-200 text-sm"
            >
              ← {fund.fundName}
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 font-medium">Fund-Term Laboratory</span>
            <Badge variant="outline" className="text-xs border-blue-700 text-blue-400">v1</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="border-blue-700 text-blue-400 hover:bg-blue-900/30"
            >
              {previewMutation.isPending ? "Computing…" : "Preview Changes"}
            </Button>
            <Button
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
              disabled={Object.keys(proposedTerms).length === 0}
              className="bg-blue-700 hover:bg-blue-600"
            >
              Save Scenario
            </Button>
          </div>
        </div>
        {/* Disclaimer */}
        <div className="mt-2 text-xs text-amber-500/80 bg-amber-900/10 border border-amber-800/30 rounded px-3 py-1.5">
          <strong>Evidence-based synthetic simulations only.</strong> Scenarios test defined assumptions rather than predict markets. Improved synthetic LP fit does not guarantee investment. Fund-term changes may have adverse GP economics or legal consequences.
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-6">
        <div className="flex gap-1">
          {(["laboratory", "sequence", "stress", "sensitivity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "laboratory" ? "Term Laboratory" :
               tab === "sequence" ? "Fundraising Sequence" :
               tab === "stress" ? "Market Stress" : "Sensitivity Analysis"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-[calc(100vh-160px)]">
        {/* Left Panel — Controls */}
        <div className="w-80 border-r border-slate-800 overflow-y-auto bg-slate-900/30 p-4 space-y-5">
          {activeTab === "laboratory" && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Fund Economics</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-xs text-slate-300">Management Fee</Label>
                      <span className="text-xs font-mono text-blue-400">{(proposedTerms.managementFeePct as number ?? economics.managementFeePct ?? 1.75).toFixed(2)}%</span>
                    </div>
                    <Slider
                      min={0.5} max={3} step={0.05}
                      value={[proposedTerms.managementFeePct as number ?? economics.managementFeePct ?? 1.75]}
                      onValueChange={([v]) => updateTerm("managementFeePct", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5"><span>0.5%</span><span>3%</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-xs text-slate-300">Carried Interest</Label>
                      <span className="text-xs font-mono text-blue-400">{(proposedTerms.carryPct as number ?? economics.carryPct ?? 20).toFixed(0)}%</span>
                    </div>
                    <Slider
                      min={10} max={30} step={1}
                      value={[proposedTerms.carryPct as number ?? economics.carryPct ?? 20]}
                      onValueChange={([v]) => updateTerm("carryPct", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5"><span>10%</span><span>30%</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-xs text-slate-300">Preferred Return</Label>
                      <span className="text-xs font-mono text-blue-400">{(proposedTerms.hurdleRatePct as number ?? economics.hurdleRatePct ?? 8).toFixed(0)}%</span>
                    </div>
                    <Slider
                      min={0} max={15} step={0.5}
                      value={[proposedTerms.hurdleRatePct as number ?? economics.hurdleRatePct ?? 8]}
                      onValueChange={([v]) => updateTerm("hurdleRatePct", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5"><span>0%</span><span>15%</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-xs text-slate-300">GP Commitment</Label>
                      <span className="text-xs font-mono text-blue-400">{(proposedTerms.gpCommitmentPct as number ?? economics.gpCommitmentPct ?? 1).toFixed(1)}%</span>
                    </div>
                    <Slider
                      min={0} max={10} step={0.5}
                      value={[proposedTerms.gpCommitmentPct as number ?? economics.gpCommitmentPct ?? 1]}
                      onValueChange={([v]) => updateTerm("gpCommitmentPct", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5"><span>0%</span><span>10%</span></div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Fund Structure</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-xs text-slate-300">Target Size ($M)</Label>
                      <span className="text-xs font-mono text-blue-400">${(proposedTerms.targetFundSizeM as number ?? Number(fund.targetFundSizeM) ?? 300).toFixed(0)}M</span>
                    </div>
                    <Slider
                      min={25} max={5000} step={25}
                      value={[proposedTerms.targetFundSizeM as number ?? Number(fund.targetFundSizeM) ?? 300]}
                      onValueChange={([v]) => updateTerm("targetFundSizeM", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5"><span>$25M</span><span>$5B</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-xs text-slate-300">Fund Term (years)</Label>
                      <span className="text-xs font-mono text-blue-400">{(proposedTerms.fundTermYrs as number ?? 10)} yrs</span>
                    </div>
                    <Slider
                      min={5} max={15} step={1}
                      value={[proposedTerms.fundTermYrs as number ?? 10]}
                      onValueChange={([v]) => updateTerm("fundTermYrs", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5"><span>5 yrs</span><span>15 yrs</span></div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <Label className="text-xs text-slate-300">Min LP Commitment ($M)</Label>
                      <span className="text-xs font-mono text-blue-400">${(proposedTerms.minLpCommitmentM as number ?? 5).toFixed(0)}M</span>
                    </div>
                    <Slider
                      min={0.5} max={50} step={0.5}
                      value={[proposedTerms.minLpCommitmentM as number ?? 5]}
                      onValueChange={([v]) => updateTerm("minLpCommitmentM", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-0.5"><span>$0.5M</span><span>$50M</span></div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Institutional Positioning</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-slate-300">Sharia Compliant</Label>
                    <button
                      onClick={() => updateTerm("shariaCompliant", !(proposedTerms.shariaCompliant as boolean ?? false))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${proposedTerms.shariaCompliant ? "bg-blue-600" : "bg-slate-700"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${proposedTerms.shariaCompliant ? "translate-x-4" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300 mb-1 block">ESG Framework</Label>
                    <Select
                      value={proposedTerms.esgFramework as string ?? ""}
                      onValueChange={(v) => updateTerm("esgFramework", v)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select ESG framework" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="SFDR Article 6">SFDR Article 6</SelectItem>
                        <SelectItem value="SFDR Article 8">SFDR Article 8</SelectItem>
                        <SelectItem value="SFDR Article 9">SFDR Article 9</SelectItem>
                        <SelectItem value="UN PRI">UN PRI</SelectItem>
                        <SelectItem value="TCFD">TCFD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-300 mb-1 block">Co-Investment Rights</Label>
                    <Select
                      value={proposedTerms.coInvestmentRights as string ?? ""}
                      onValueChange={(v) => updateTerm("coInvestmentRights", v)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select co-investment rights" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="Preferred">Preferred (pro-rata)</SelectItem>
                        <SelectItem value="Required">Required (anchor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {Object.keys(proposedTerms).length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-slate-500 mb-2">Changed terms ({Object.keys(proposedTerms).length})</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(proposedTerms).map((k) => (
                      <span key={k} className="text-xs bg-blue-900/30 border border-blue-800/50 text-blue-300 px-2 py-0.5 rounded">
                        {k}
                        <button onClick={() => setProposedTerms((p) => { const n = { ...p }; delete n[k]; return n; })} className="ml-1 text-blue-500 hover:text-blue-300">×</button>
                      </span>
                    ))}
                  </div>
                  <button onClick={() => setProposedTerms({})} className="text-xs text-slate-500 hover:text-slate-300 mt-2">Clear all changes</button>
                </div>
              )}
            </>
          )}

          {activeTab === "sequence" && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fundraising Objective</h3>
              <Select value={selectedObjective} onValueChange={setSelectedObjective}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="fastest_first_close">Fastest First Close</SelectItem>
                  <SelectItem value="largest_tickets">Largest Tickets</SelectItem>
                  <SelectItem value="strongest_reference">Strongest Reference</SelectItem>
                  <SelectItem value="highest_engagement_probability">Highest Engagement Probability</SelectItem>
                  <SelectItem value="islamic_capital_priority">Islamic Capital Priority</SelectItem>
                  <SelectItem value="geographic_diversification">Geographic Diversification</SelectItem>
                  <SelectItem value="lowest_diligence_complexity">Lowest Diligence Complexity</SelectItem>
                  <SelectItem value="emerging_manager_friendly">Emerging Manager Friendly</SelectItem>
                  <SelectItem value="best_reup_potential">Best Re-Up Potential</SelectItem>
                </SelectContent>
              </Select>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sequence Template</h3>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diversified_global">Diversified Global</SelectItem>
                  <SelectItem value="existing_relationships_first">Existing Relationships First</SelectItem>
                  <SelectItem value="fastest_decision_makers_first">Fastest Decision Makers First</SelectItem>
                  <SelectItem value="largest_tickets_first">Largest Tickets First</SelectItem>
                  <SelectItem value="strategic_reference_first">Strategic Reference First</SelectItem>
                  <SelectItem value="islamic_capital_first">Islamic Capital First</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleGenerateSequence} disabled={sequenceMutation.isPending} className="w-full bg-blue-700 hover:bg-blue-600">
                {sequenceMutation.isPending ? "Generating…" : "Generate Sequence"}
              </Button>
            </div>
          )}

          {activeTab === "stress" && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Market Conditions</h3>
              <p className="text-xs text-slate-500">Select conditions to test. These are scenario assumptions, not market forecasts.</p>
              {STRESS_OPTIONS.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stressConditions.includes(opt.id)}
                    onChange={(e) => setStressConditions((prev) =>
                      e.target.checked ? [...prev, opt.id] : prev.filter((c) => c !== opt.id)
                    )}
                    className="rounded border-slate-600"
                  />
                  <span className="text-xs text-slate-300">{opt.label}</span>
                </label>
              ))}
              <Button onClick={handleStressTest} disabled={stressMutation.isPending || stressConditions.length === 0} className="w-full bg-orange-700 hover:bg-orange-600">
                {stressMutation.isPending ? "Running…" : `Run Stress Test (${stressConditions.length} conditions)`}
              </Button>
            </div>
          )}

          {activeTab === "sensitivity" && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sensitivity Variable</h3>
              <Select value={sensitivityField} onValueChange={setSensitivityField}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="managementFeePct">Management Fee</SelectItem>
                  <SelectItem value="carryPct">Carried Interest</SelectItem>
                  <SelectItem value="hurdleRatePct">Preferred Return</SelectItem>
                  <SelectItem value="gpCommitmentPct">GP Commitment</SelectItem>
                  <SelectItem value="targetFundSizeM">Target Fund Size ($M)</SelectItem>
                  <SelectItem value="fundTermYrs">Fund Term (years)</SelectItem>
                  <SelectItem value="targetReturnPct">Target Return</SelectItem>
                  <SelectItem value="minLpCommitmentM">Min LP Commitment ($M)</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-slate-400">Min Value</Label>
                  <Input type="number" value={sensitivityMin} onChange={(e) => setSensitivityMin(Number(e.target.value))} className="h-8 text-xs bg-slate-800 border-slate-700 mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Max Value</Label>
                  <Input type="number" value={sensitivityMax} onChange={(e) => setSensitivityMax(Number(e.target.value))} className="h-8 text-xs bg-slate-800 border-slate-700 mt-1" />
                </div>
              </div>
              <Button onClick={handleSensitivity} disabled={sensitivityMutation.isPending} className="w-full bg-purple-700 hover:bg-purple-600">
                {sensitivityMutation.isPending ? "Running…" : "Run Sensitivity Analysis"}
              </Button>
            </div>
          )}
        </div>

        {/* Right Panel — Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "laboratory" && (
            <>
              {!previewResult && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-4xl mb-4">⚗️</div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">Fund-Term Laboratory</h3>
                  <p className="text-sm text-slate-500 max-w-md">Adjust fund terms on the left, then click <strong className="text-slate-300">Preview Changes</strong> to see the impact on all 9 LP segments before saving.</p>
                </div>
              )}

              {previewResult && (
                <div className="space-y-6">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                      <div className={`text-2xl font-bold font-mono ${previewResult.avgScoreDelta > 0 ? "text-emerald-400" : previewResult.avgScoreDelta < 0 ? "text-red-400" : "text-slate-400"}`}>
                        {previewResult.avgScoreDelta > 0 ? "+" : ""}{previewResult.avgScoreDelta}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Avg Score Delta</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold font-mono text-emerald-400">
                        {previewResult.segmentResults.filter((r) => r.scoreDelta > 2).length}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Segments Helped</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold font-mono text-red-400">
                        {previewResult.segmentResults.filter((r) => r.scoreDelta < -2).length}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Segments Harmed</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold font-mono text-blue-400">
                        {previewResult.segmentResults.filter((r) => r.eligibilityChanged).length}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Eligibility Changes</div>
                    </div>
                  </div>

                  {/* Segment Comparison Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <h3 className="text-sm font-medium text-slate-200">Segment Comparison</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500">
                            <th className="text-left px-4 py-2 font-medium">Segment</th>
                            <th className="text-center px-3 py-2 font-medium">Base</th>
                            <th className="text-center px-3 py-2 font-medium">Scenario</th>
                            <th className="text-center px-3 py-2 font-medium">Delta</th>
                            <th className="text-center px-3 py-2 font-medium">Objections −</th>
                            <th className="text-center px-3 py-2 font-medium">Objections +</th>
                            <th className="text-center px-3 py-2 font-medium">Eligibility</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewResult.segmentResults.sort((a, b) => b.scoreDelta - a.scoreDelta).map((r) => (
                            <tr key={r.segmentId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                              <td className="px-4 py-2.5 text-slate-200 font-medium">{r.segmentName}</td>
                              <td className="px-3 py-2.5 text-center"><ScoreBadge score={r.baseFitScore} category={r.baseCategory} /></td>
                              <td className="px-3 py-2.5 text-center"><ScoreBadge score={r.scenarioFitScore} category={r.scenarioCategory} /></td>
                              <td className={`px-3 py-2.5 text-center font-mono font-bold ${deltaColor(r.scoreDelta)}`}>
                                {r.scoreDelta > 0 ? "+" : ""}{r.scoreDelta}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {r.objectionsResolvedCount > 0 ? (
                                  <span className="text-emerald-400 font-mono">−{r.objectionsResolvedCount}</span>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {r.objectionsAddedCount > 0 ? (
                                  <span className="text-red-400 font-mono">+{r.objectionsAddedCount}</span>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {r.eligibilityChanged ? (
                                  <span className={r.scenarioEligible ? "text-emerald-400" : "text-red-400"}>
                                    {r.scenarioEligible ? "Now eligible" : "Now ineligible"}
                                  </span>
                                ) : <span className="text-slate-600">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Term Impact Analysis */}
                  {previewResult.termImpacts.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-800">
                        <h3 className="text-sm font-medium text-slate-200">Term Impact Analysis</h3>
                      </div>
                      <div className="divide-y divide-slate-800">
                        {previewResult.termImpacts.map((impact) => (
                          <div key={impact.field} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-200">{impact.label}</span>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-500">{String(impact.baseValue)}</span>
                                <span className="text-slate-600">→</span>
                                <span className="text-blue-400 font-mono">{String(impact.proposedValue)}</span>
                                <span className={`font-mono font-bold ${deltaColor(impact.avgFitDelta)}`}>
                                  {impact.avgFitDelta > 0 ? "+" : ""}{impact.avgFitDelta} avg
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 mb-1">{impact.commercialTradeOff}</p>
                            {impact.governanceConsequence && (
                              <p className="text-xs text-amber-400/80">{impact.governanceConsequence}</p>
                            )}
                            {impact.evidenceRequired.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {impact.evidenceRequired.map((e) => (
                                  <span key={e} className="text-xs bg-amber-900/20 border border-amber-800/30 text-amber-400/80 px-1.5 py-0.5 rounded">{e}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="text-xs text-slate-600 bg-slate-900/50 border border-slate-800 rounded p-3">
                    {previewResult.disclaimer}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "sequence" && (
            <>
              {!sequenceMutation.data && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">Fundraising Sequence Engine</h3>
                  <p className="text-sm text-slate-500 max-w-md">Select your fundraising objective and sequence template, then generate an evidence-based outreach sequence across all 9 LP segments.</p>
                </div>
              )}
              {sequenceMutation.data && (
                <div className="space-y-4">
                  <div className="text-xs text-amber-500/80 bg-amber-900/10 border border-amber-800/30 rounded px-3 py-2">
                    {sequenceMutation.data.sequence.disclaimer}
                  </div>
                  {sequenceMutation.data.sequence.waves.map((wave) => (
                    <div key={wave.wave} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-medium text-slate-200">Wave {wave.wave} — {wave.label}</h3>
                        {wave.anchorNote && <span className="text-xs text-blue-400">{wave.anchorNote}</span>}
                      </div>
                      <div className="divide-y divide-slate-800">
                        {wave.segments.map((seg) => (
                          <div key={seg.segmentId} className="px-4 py-3 flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-slate-200">{seg.segmentName}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{seg.rationale}</div>
                              {seg.evidenceRequired.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {seg.evidenceRequired.slice(0, 2).map((e) => (
                                    <span key={e} className="text-xs bg-amber-900/20 border border-amber-800/30 text-amber-400/80 px-1.5 py-0.5 rounded">{e}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <ScoreBadge score={seg.fitScore} category={seg.fitCategory} />
                              <div className="text-xs text-slate-500 mt-1">~{seg.estimatedDecisionMonths} mo IC</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {sequenceMutation.data.sequence.avoidUntilTermsImprove.length > 0 && (
                    <div className="bg-red-900/10 border border-red-800/30 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-red-800/30">
                        <h3 className="text-sm font-medium text-red-400">Avoid Until Terms Improve</h3>
                      </div>
                      <div className="divide-y divide-red-800/20">
                        {sequenceMutation.data.sequence.avoidUntilTermsImprove.map((s) => (
                          <div key={s.segmentId} className="px-4 py-2.5 flex items-center justify-between">
                            <span className="text-sm text-slate-300">{s.segmentName}</span>
                            <span className="text-xs text-red-400">{s.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "stress" && (
            <>
              {!stressMutation.data && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-4xl mb-4">🌡️</div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">Market Stress Testing</h3>
                  <p className="text-sm text-slate-500 max-w-md">Select market conditions on the left to test how they affect LP fit scores across all segments. These are scenario assumptions, not market forecasts.</p>
                </div>
              )}
              {stressMutation.data && (
                <div className="space-y-4">
                  <div className="text-xs text-amber-500/80 bg-amber-900/10 border border-amber-800/30 rounded px-3 py-2">
                    {stressMutation.data.disclaimer}
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <h3 className="text-sm font-medium text-slate-200">Segment Score Impact</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500">
                            <th className="text-left px-4 py-2 font-medium">Segment</th>
                            <th className="text-center px-3 py-2 font-medium">Base Score</th>
                            <th className="text-center px-3 py-2 font-medium">Stressed Score</th>
                            <th className="text-center px-3 py-2 font-medium">Delta</th>
                            <th className="text-left px-3 py-2 font-medium">Adjustments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stressMutation.data.segmentComparison.sort((a, b) => a.scoreDelta - b.scoreDelta).map((r) => (
                            <tr key={r.segmentId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                              <td className="px-4 py-2.5 text-slate-200 font-medium">{r.segmentName}</td>
                              <td className="px-3 py-2.5 text-center font-mono text-slate-300">{r.baseFitScore}</td>
                              <td className="px-3 py-2.5 text-center font-mono text-slate-300">{r.stressedFitScore}</td>
                              <td className={`px-3 py-2.5 text-center font-mono font-bold ${deltaColor(r.scoreDelta)}`}>
                                {r.scoreDelta > 0 ? "+" : ""}{r.scoreDelta}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500">
                                {r.adjustments.map((a) => `${a.condition}: ${a.delta > 0 ? "+" : ""}${a.delta}`).join(" · ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "sensitivity" && (
            <>
              {!sensitivityMutation.data && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-4xl mb-4">📈</div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">Sensitivity Analysis</h3>
                  <p className="text-sm text-slate-500 max-w-md">Select a fund term variable and value range to see how changes affect average LP fit score across all segments.</p>
                </div>
              )}
              {sensitivityMutation.data && (
                <div className="space-y-4">
                  <div className="text-xs text-amber-500/80 bg-amber-900/10 border border-amber-800/30 rounded px-3 py-2">
                    {sensitivityMutation.data.disclaimer}
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-slate-200 mb-4">
                      {sensitivityMutation.data.analysis.label} — Average Fit Score
                    </h3>
                    <div className="space-y-2">
                      {sensitivityMutation.data.analysis.points.map((pt) => (
                        <div key={pt.value} className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-400 w-12 text-right">{pt.value}</span>
                          <div className="flex-1 bg-slate-800 rounded-full h-4 relative">
                            <div
                              className="h-4 rounded-full bg-blue-600 transition-all"
                              style={{ width: `${pt.avgFitScore}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-blue-400 w-12">{pt.avgFitScore}/100</span>
                          <span className="text-xs text-slate-500 w-16">{pt.strongFitCount} strong</span>
                        </div>
                      ))}
                    </div>
                    {sensitivityMutation.data.analysis.inflectionPoints.length > 0 && (
                      <div className="mt-4 space-y-1">
                        <div className="text-xs font-medium text-slate-400">Inflection Points</div>
                        {sensitivityMutation.data.analysis.inflectionPoints.map((ip, i) => (
                          <div key={i} className="text-xs text-slate-500">{ip.description}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save Scenario Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Save Scenario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm text-slate-300">Scenario Name</Label>
              <Input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g. Lower Fee Structure — Q1 2026"
                className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div className="text-xs text-slate-500">
              {Object.keys(proposedTerms).length} term change(s) will be saved. You can compute full segment results after saving.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending} className="bg-blue-700 hover:bg-blue-600">
              {createMutation.isPending ? "Saving…" : "Save Scenario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
