/**
 * LPTwinFundWizard.tsx — Fund Setup + Session Launch Wizard
 * CapTwin Enterprise Module — WP3
 *
 * Step 1: Fund identity and economics
 * Step 2: Track record and credibility
 * Step 3: Select LP segments and launch simulation
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowLeft, ArrowRight, FlaskConical, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FundForm {
  fundName: string;
  gpName: string;
  strategy: string;
  currency: string;
  targetFundSizeM: string;
  managementFeePct: string;
  carryPct: string;
  hurdleRatePct: string;
}

interface TrackRecordForm {
  trackRecordYrs: string;
  priorFundIRR: string;
  priorFundMOIC: string;
  vintageYear: string;
}

const STRATEGIES = [
  "Private Equity",
  "Venture Capital",
  "Private Credit",
  "Real Estate",
  "Infrastructure",
  "Hedge Fund",
  "Fund of Funds",
  "Growth Equity",
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/20 border border-primary text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          {i < total - 1 && <div className={`h-px w-8 ${i < step ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
      <span className="text-xs text-muted-foreground ml-2">Step {step + 1} of {total}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LPTwinFundWizard() {
  const [, navigate] = useLocation();
  
  const [step, setStep] = useState(0);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [createdFundId, setCreatedFundId] = useState<number | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const [fundForm, setFundForm] = useState<FundForm>({
    fundName: "",
    gpName: "",
    strategy: "Private Equity",
    currency: "USD",
    targetFundSizeM: "",
    managementFeePct: "2.0",
    carryPct: "20",
    hurdleRatePct: "8",
  });

  const [trackForm, setTrackForm] = useState<TrackRecordForm>({
    trackRecordYrs: "",
    priorFundIRR: "",
    priorFundMOIC: "",
    vintageYear: "",
  });

  const { data: segmentsData, isLoading: segmentsLoading } = trpc.lpTwin.listSegments.useQuery();
  const segments = segmentsData?.segments ?? [];

  const createFundMutation = trpc.lpTwin.createFund.useMutation();
  const createSessionMutation = trpc.lpTwin.createSession.useMutation();
  const runAnalysisMutation = trpc.lpTwin.runSegmentAnalysis.useMutation();

  // Group segments by region
  const segmentsByRegion = segments.reduce<Record<string, typeof segments>>((acc, seg) => {
    const region = seg.region || "Other";
    if (!acc[region]) acc[region] = [];
    acc[region].push(seg);
    return acc;
  }, {});

  function toggleSegment(id: string) {
    setSelectedSegments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleLaunch() {
    if (!sessionName.trim()) {
      toast.error("Session name required");
      return;
    }
    if (selectedSegments.length === 0) {
      toast.error("Select at least one LP segment");
      return;
    }
    setIsLaunching(true);
    try {
      // Step 1: Create fund if not already created
      let fundId = createdFundId;
      if (!fundId) {
        const fundResult = await createFundMutation.mutateAsync({
          fundName: fundForm.fundName,
          gpName: fundForm.gpName,
          strategy: fundForm.strategy,
          currency: fundForm.currency,
          targetFundSizeM: Number(fundForm.targetFundSizeM),
          economics: {
            managementFeePct: Number(fundForm.managementFeePct),
            carryPct: Number(fundForm.carryPct),
            hurdleRatePct: fundForm.hurdleRatePct ? Number(fundForm.hurdleRatePct) : undefined,
          },
          trackRecord: {
            trackRecordYrs: Number(trackForm.trackRecordYrs),
            priorFundIRR: Number(trackForm.priorFundIRR),
            priorFundMOIC: trackForm.priorFundMOIC ? Number(trackForm.priorFundMOIC) : undefined,
            vintageYear: trackForm.vintageYear ? Number(trackForm.vintageYear) : undefined,
          },
        });
        fundId = fundResult.fundId;
        setCreatedFundId(fundId);
      }

      // Step 2: Create session
      const sessionResult = await createSessionMutation.mutateAsync({
        fundId,
        sessionName: sessionName.trim(),
        selectedSegmentIds: selectedSegments,
        scenarioType: "baseline",
      });

      // Step 3: Run analysis
      await runAnalysisMutation.mutateAsync({ sessionId: sessionResult.sessionId });

      toast.success("Analysis complete", { description: "Redirecting to results..." });
      navigate(`/captwin/lp-twin/session/${sessionResult.sessionId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to launch analysis", { description: message });
    } finally {
      setIsLaunching(false);
    }
  }

  const step1Valid =
    fundForm.fundName.trim() &&
    fundForm.gpName.trim() &&
    fundForm.strategy &&
    fundForm.targetFundSizeM &&
    Number(fundForm.targetFundSizeM) > 0;

  const step2Valid =
    trackForm.trackRecordYrs &&
    Number(trackForm.trackRecordYrs) >= 0 &&
    trackForm.priorFundIRR;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/captwin/lp-twin")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">New LP Twin Test</h1>
        </div>
      </div>

      <StepIndicator step={step} total={3} />

      {/* Step 0: Fund Identity & Economics */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Fund Identity</h2>
            <p className="text-sm text-muted-foreground">Basic information about the fund being tested.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fundName">Fund Name *</Label>
              <Input id="fundName" placeholder="e.g. Horizon Capital Fund III" value={fundForm.fundName} onChange={(e) => setFundForm((f) => ({ ...f, fundName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gpName">GP / Manager Name *</Label>
              <Input id="gpName" placeholder="e.g. Horizon Capital Partners" value={fundForm.gpName} onChange={(e) => setFundForm((f) => ({ ...f, gpName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Strategy *</Label>
              <Select value={fundForm.strategy} onValueChange={(v) => setFundForm((f) => ({ ...f, strategy: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="targetSize">Target Fund Size (USD M) *</Label>
              <Input id="targetSize" type="number" placeholder="e.g. 300" min={1} value={fundForm.targetFundSizeM} onChange={(e) => setFundForm((f) => ({ ...f, targetFundSizeM: e.target.value }))} />
            </div>
          </div>
          <div>
            <h2 className="text-base font-semibold mb-3">Economics</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mgmtFee">Management Fee (%)</Label>
                <Input id="mgmtFee" type="number" step="0.25" min={0} max={5} value={fundForm.managementFeePct} onChange={(e) => setFundForm((f) => ({ ...f, managementFeePct: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carry">Carry (%)</Label>
                <Input id="carry" type="number" step={1} min={0} max={40} value={fundForm.carryPct} onChange={(e) => setFundForm((f) => ({ ...f, carryPct: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hurdle">Hurdle Rate (%)</Label>
                <Input id="hurdle" type="number" step={1} min={0} max={30} value={fundForm.hurdleRatePct} onChange={(e) => setFundForm((f) => ({ ...f, hurdleRatePct: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled={!step1Valid} onClick={() => setStep(1)} className="gap-1">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Track Record */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Track Record & Credibility</h2>
            <p className="text-sm text-muted-foreground">Used to score fit against LP minimum thresholds.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="trackYrs">GP Track Record (years) *</Label>
              <Input id="trackYrs" type="number" min={0} max={50} placeholder="e.g. 8" value={trackForm.trackRecordYrs} onChange={(e) => setTrackForm((f) => ({ ...f, trackRecordYrs: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priorIRR">Prior Fund Net IRR (%) *</Label>
              <Input id="priorIRR" type="number" step="0.1" placeholder="e.g. 18.5" value={trackForm.priorFundIRR} onChange={(e) => setTrackForm((f) => ({ ...f, priorFundIRR: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="moic">Prior Fund MOIC (optional)</Label>
              <Input id="moic" type="number" step="0.1" min={0} placeholder="e.g. 2.4" value={trackForm.priorFundMOIC} onChange={(e) => setTrackForm((f) => ({ ...f, priorFundMOIC: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vintage">Prior Fund Vintage Year (optional)</Label>
              <Input id="vintage" type="number" min={1990} max={2030} placeholder="e.g. 2018" value={trackForm.vintageYear} onChange={(e) => setTrackForm((f) => ({ ...f, vintageYear: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button disabled={!step2Valid} onClick={() => setStep(2)} className="gap-1">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Select LP Segments */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">Select LP Segments</h2>
            <p className="text-sm text-muted-foreground">Choose which institutional allocator archetypes to test your fund against.</p>
            <p className="text-xs text-amber-500/80 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Synthetic archetypes only — not real institutions.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sessionName">Session Name *</Label>
            <Input id="sessionName" placeholder="e.g. Baseline Q3 2026" value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
          </div>

          {segmentsLoading ? (
            <div className="text-sm text-muted-foreground">Loading LP segments...</div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {Object.entries(segmentsByRegion).map(([region, segs]) => (
                <div key={region}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{region}</p>
                  <div className="space-y-2">
                    {segs.map((seg) => (
                      <label key={seg.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSegments.includes(seg.id) ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/30"
                      }`}>
                        <Checkbox
                          checked={selectedSegments.includes(seg.id)}
                          onCheckedChange={() => toggleSegment(seg.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{seg.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {seg.segment} · Ticket USD {seg.ticketMin}M–{seg.ticketMax}M
                            {seg.shariaRequired && " · Sharia"}
                            {seg.esgPriority >= 8 && " · ESG Mandate"}
                            {seg.irrHurdle ? ` · IRR Hurdle ${seg.irrHurdle}%` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground">
              {selectedSegments.length} segment{selectedSegments.length !== 1 ? "s" : ""} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                disabled={isLaunching || selectedSegments.length === 0 || !sessionName.trim()}
                onClick={handleLaunch}
                className="gap-1"
              >
                {isLaunching ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Running Analysis...</>
                ) : (
                  <><FlaskConical className="h-4 w-4" /> Launch Analysis</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
