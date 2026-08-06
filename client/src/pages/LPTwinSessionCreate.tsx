/**
 * LPTwinSessionCreate.tsx — Session Creation Page
 * CapTwin Enterprise Module — WP3
 *
 * From a fund, allows the user to:
 * - Name the simulation
 * - Select allocator segments
 * - Select scenario type
 * - Enter assumptions
 * - Review engine version
 * - Create session and launch analysis
 *
 * Shows the synthetic-simulation disclaimer before execution.
 */

import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, FlaskConical, Play, AlertTriangle, Loader2, Search, Info,
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCENARIO_TYPES = [
  { value: "baseline", label: "Baseline", description: "Standard assumptions, no adjustments" },
  { value: "stress", label: "Stress", description: "Conservative LP expectations, higher scrutiny" },
  { value: "optimistic", label: "Optimistic", description: "Favourable market conditions, relaxed thresholds" },
  { value: "custom", label: "Custom", description: "Enter custom assumptions below" },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function LPTwinSessionCreate() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const fundId = params.get("fundId") ? Number(params.get("fundId")) : null;

  const [sessionName, setSessionName] = useState("");
  const [scenarioType, setScenarioType] = useState<"baseline" | "stress" | "optimistic" | "custom">("baseline");
  const [customAssumptions, setCustomAssumptions] = useState("");
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  const { data: fundData, isLoading: fundLoading } = trpc.lpTwin.getFund.useQuery(
    { fundId: fundId! },
    { enabled: !!fundId }
  );
  const { data: segmentsData, isLoading: segmentsLoading } = trpc.lpTwin.listSegments.useQuery();
  const { data: engineData } = trpc.lpTwin.listSegments.useQuery(); // reuse to get engine version from context

  const createSessionMutation = trpc.lpTwin.createSession.useMutation();
  const runAnalysisMutation = trpc.lpTwin.runSegmentAnalysis.useMutation();

  const segments = segmentsData?.segments ?? [];
  const fund = fundData?.fund;

  const filteredSegments = useMemo(() => {
    if (!segmentSearch.trim()) return segments;
    const q = segmentSearch.toLowerCase();
    return segments.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.segment.toLowerCase().includes(q)
    );
  }, [segments, segmentSearch]);

  const segmentsByRegion = useMemo(() => {
    return filteredSegments.reduce<Record<string, typeof segments>>((acc, seg) => {
      const region = seg.region || "Other";
      if (!acc[region]) acc[region] = [];
      acc[region].push(seg);
      return acc;
    }, {});
  }, [filteredSegments]);

  function toggleSegment(id: string) {
    setSelectedSegments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    setSelectedSegments(filteredSegments.map((s) => s.id));
  }

  function handleClearAll() {
    setSelectedSegments([]);
  }

  function handleLaunchClick() {
    if (!sessionName.trim()) { toast.error("Session name is required"); return; }
    if (selectedSegments.length === 0) { toast.error("Select at least one LP segment"); return; }
    if (!fundId) { toast.error("No fund selected"); return; }
    setShowDisclaimer(true);
  }

  async function handleConfirmLaunch() {
    setShowDisclaimer(false);
    setIsLaunching(true);
    try {
      const assumptions = scenarioType === "custom" && customAssumptions.trim()
        ? { customNote: customAssumptions.trim() }
        : undefined;

      const sessionResult = await createSessionMutation.mutateAsync({
        fundId: fundId!,
        sessionName: sessionName.trim(),
        selectedSegmentIds: selectedSegments,
        scenarioType,
        assumptions,
      });

      toast("Analysis running…", { description: "This may take a few seconds." });
      await runAnalysisMutation.mutateAsync({ sessionId: sessionResult.sessionId });
      toast.success("Analysis complete");
      navigate(`/captwin/lp-twin/${sessionResult.sessionId}`);
    } catch (err: unknown) {
      toast.error("Launch failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsLaunching(false);
    }
  }

  if (!fundId) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto text-center py-20 text-muted-foreground">
        <p>No fund selected. <button className="text-primary underline" onClick={() => navigate("/captwin/lp-twin")}>Go back</button></p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-background/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/captwin/lp-twin")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <FlaskConical className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold">New Simulation</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Fund summary */}
        {fundLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : fund ? (
          <div className="p-4 rounded-lg border border-border bg-muted/20">
            <p className="text-xs text-muted-foreground mb-1">Testing fund</p>
            <p className="font-semibold">{fund.fundName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fund.gpName} · {fund.strategy} · {fund.currency} {Number(fund.targetFundSizeM).toLocaleString()}M
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
            Fund not found or access denied.
          </div>
        )}

        {/* Session name */}
        <div className="space-y-1.5">
          <Label htmlFor="sessionName">Session Name <span className="text-destructive">*</span></Label>
          <Input
            id="sessionName"
            placeholder="e.g. Baseline Q3 2026 — GCC Focus"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
        </div>

        {/* Scenario type */}
        <div className="space-y-3">
          <Label>Scenario Type</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {SCENARIO_TYPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setScenarioType(s.value as typeof scenarioType)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  scenarioType === s.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              </button>
            ))}
          </div>
          {scenarioType === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="assumptions">Custom Assumptions</Label>
              <Textarea
                id="assumptions"
                rows={3}
                placeholder="Describe any custom assumptions for this simulation run…"
                value={customAssumptions}
                onChange={(e) => setCustomAssumptions(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* LP Segment selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Allocator Segments <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <button className="text-xs text-primary hover:underline" onClick={handleSelectAll}>Select all</button>
              <span className="text-muted-foreground">·</span>
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={handleClearAll}>Clear</button>
              <Badge variant="secondary" className="text-xs">{selectedSegments.length} selected</Badge>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search segments…"
              value={segmentSearch}
              onChange={(e) => setSegmentSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {segmentsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1 rounded-lg border border-border p-3">
              {Object.entries(segmentsByRegion).map(([region, segs]) => (
                <div key={region}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{region}</p>
                  <div className="space-y-1.5">
                    {segs.map((seg) => (
                      <label
                        key={seg.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          selectedSegments.includes(seg.id)
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/30 border border-transparent"
                        }`}
                      >
                        <Checkbox
                          checked={selectedSegments.includes(seg.id)}
                          onCheckedChange={() => toggleSegment(seg.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{seg.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {seg.segment} · USD {seg.ticketMin}M–{seg.ticketMax}M
                            {seg.shariaRequired && " · Sharia"}
                            {seg.esgPriority >= 8 && " · ESG Mandate"}
                            {seg.irrHurdle ? ` · IRR ≥ ${seg.irrHurdle}%` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Engine version info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Analysis will run using the current engine and registry version. The version is recorded with the session
            to ensure historical reproducibility.
          </span>
        </div>

        {/* Launch button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleLaunchClick}
            disabled={isLaunching || !sessionName.trim() || selectedSegments.length === 0}
            className="gap-1.5"
          >
            {isLaunching ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running Analysis…</>
            ) : (
              <><Play className="h-4 w-4" /> Launch Analysis</>
            )}
          </Button>
        </div>
      </div>

      {/* Disclaimer confirmation dialog */}
      <AlertDialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Synthetic Simulation Disclaimer
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              <strong>These outputs are evidence-based synthetic simulations</strong> derived from anonymised institutional
              allocator archetypes. They are not validated predictions of real allocator behaviour and should not be
              presented to investors as such.
              <br /><br />
              Outputs are intended to help investment managers identify potential fit gaps, objections, and evidence
              weaknesses before beginning a fundraising campaign.
              <br /><br />
              By proceeding, you confirm you understand the synthetic nature of these results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLaunch}>
              I Understand — Run Analysis
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
