import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function QualityBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    "Synthetic Only": "bg-slate-700 text-slate-300",
    "Early Validation": "bg-amber-900/40 text-amber-300 border-amber-700/30",
    "Moderately Validated": "bg-blue-900/40 text-blue-300 border-blue-700/30",
    "Strongly Validated": "bg-emerald-900/40 text-emerald-300 border-emerald-700/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[label] ?? "bg-slate-700 text-slate-300"}`}>
      {label}
    </span>
  );
}

function AgreementBar({ value, label }: { value: number; label: string }) {
  const color = value >= 0.75 ? "bg-emerald-500" : value >= 0.5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{pct(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LPTwinValidation() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [segmentFilter, setSegmentFilter] = useState<string | undefined>();

  const { data: dashboard, isLoading } = trpc.lpTwinValidation.getValidationDashboard.useQuery({
    segmentId: segmentFilter,
  });
  const { data: participants } = trpc.lpTwinValidation.listParticipants.useQuery({ includeArchived: false });
  const { data: scenarios } = trpc.lpTwinValidation.listValidationScenarios.useQuery();
  const { data: candidates } = trpc.lpTwinValidation.listCalibrationCandidates.useQuery({});
  const { data: thresholds } = trpc.lpTwinValidation.getValidationThresholds.useQuery();
  const { data: report } = trpc.lpTwinValidation.getValidationReport.useQuery();

  const reviewMutation = trpc.lpTwinValidation.reviewCalibrationCandidate.useMutation({
    onSuccess: () => toast("Review status updated"),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
        Loading validation data…
      </div>
    );
  }

  const summary = dashboard?.summary;
  const segmentAggregations = dashboard?.segmentAggregations ?? [];
  const qualityScores = dashboard?.qualityScores ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate("/captwin/lp-twin")} className="text-sm text-muted-foreground hover:text-foreground">
              ← LP Twin
            </button>
          </div>
          <h1 className="text-2xl font-bold">Validation Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agreement metrics between synthetic LP archetypes and human validator responses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/captwin/lp-twin/validation/participants/new")}>
            + Add Participant
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/captwin/lp-twin/validation/import")}>
            Import Responses
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
        <strong>Agreement Metrics Only</strong> — These figures measure agreement between synthetic LP archetype outputs and human validator responses.
        They do not constitute validated predictive accuracy. Do not use these metrics to claim predictive performance until minimum evidence thresholds are met and independently reviewed.
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Participants", value: summary?.totalParticipants ?? 0 },
          { label: "Segment Coverage", value: summary?.segmentCoverage ?? 0 },
          { label: "Scenario Coverage", value: summary?.scenarioCoverage ?? 0 },
          { label: "Verified Responses", value: summary?.verifiedResponses ?? 0 },
          { label: "Calib. Eligible", value: summary?.calibrationEligibleResponses ?? 0 },
          { label: "Comparisons", value: summary?.totalComparisons ?? 0 },
        ].map((item) => (
          <Card key={item.label} className="bg-white/5 border-white/10">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{item.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5">
          <TabsTrigger value="overview">Segment Overview</TabsTrigger>
          <TabsTrigger value="quality">Quality Scores</TabsTrigger>
          <TabsTrigger value="calibration">Calibration</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>

        {/* Segment Overview */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          {segmentAggregations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-2">No comparison data yet</p>
              <p className="text-sm">Add participants, create validation scenarios, and submit human responses to see agreement metrics.</p>
            </div>
          ) : (
            segmentAggregations.map((agg) => (
              <Card key={agg.segmentId} className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{agg.segmentId}</CardTitle>
                    <span className="text-xs text-muted-foreground">{agg.totalComparisons} comparisons</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div>
                      <div className="text-lg font-bold text-emerald-400">{agg.verdictExactAgreement}</div>
                      <div className="text-muted-foreground">Exact Agreement</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-amber-400">{agg.verdictPartialAgreement}</div>
                      <div className="text-muted-foreground">Partial</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-400">{agg.verdictDisagreement}</div>
                      <div className="text-muted-foreground">Disagreement</div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-1">
                    <AgreementBar value={agg.avgObjRecall} label="Objection Recall" />
                    <AgreementBar value={agg.avgObjPrecision} label="Objection Precision" />
                    <AgreementBar value={agg.avgEvidenceAgreement} label="Evidence Request Agreement" />
                    <AgreementBar value={agg.avgTermAgreement} label="Term Sensitivity Agreement" />
                    <AgreementBar value={agg.nextStepAgreementRate} label="Next-Step Agreement" />
                  </div>
                  {agg.largestGaps.length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground mb-1">Largest model gaps:</p>
                      <div className="flex flex-wrap gap-1">
                        {agg.largestGaps.map((gap) => (
                          <Badge key={gap} variant="outline" className="text-xs text-red-400 border-red-500/30">{gap}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Quality Scores */}
        <TabsContent value="quality" className="space-y-4 pt-4">
          {qualityScores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No quality scores yet. Quality scores are computed from verified human responses.</p>
            </div>
          ) : (
            qualityScores.map((qs) => (
              <Card key={qs.segmentId} className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{qs.segmentId}</CardTitle>
                    <div className="flex items-center gap-2">
                      <QualityBadge label={qs.label} />
                      <span className="text-sm font-bold">{qs.score}/100</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><span className="text-muted-foreground">Verified responses:</span> {qs.verifiedResponseCount}</div>
                    <div><span className="text-muted-foreground">Participants:</span> {qs.independentParticipantCount}</div>
                    <div><span className="text-muted-foreground">Scenarios:</span> {qs.scenarioDiversity}</div>
                    <div><span className="text-muted-foreground">Geographies:</span> {qs.geographicDiversity}</div>
                  </div>
                  <div className="pt-1 space-y-1">
                    <div className="flex gap-4 flex-wrap text-muted-foreground">
                      {Object.entries(qs.thresholdsMet).map(([k, v]) => (
                        <span key={k} className={v ? "text-emerald-400" : "text-red-400"}>
                          {v ? "✓" : "✗"} {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  {qs.calibrationThresholdMet ? (
                    <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-700/30 text-xs">Calibration threshold met</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs">Calibration threshold not yet met</Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
          {thresholds && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle className="text-sm">Validation Thresholds</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {Object.entries(thresholds.labels).map(([label, desc]) => (
                  <div key={label}><strong className="text-foreground">{label}:</strong> {desc}</div>
                ))}
                <div className="pt-2 text-amber-300">{thresholds.disclaimer}</div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Calibration */}
        <TabsContent value="calibration" className="space-y-4 pt-4">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">
            <strong>Human Approval Required</strong> — No calibration candidate may alter production behavior automatically.
            Every change requires explicit review and approval. Approved changes create a new Agent Bank version. Historical sessions remain reproducible.
          </div>
          {(candidates?.candidates ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No calibration candidates yet.</p>
              <p className="text-sm mt-1">Calibration candidates are proposed based on validated human evidence.</p>
            </div>
          ) : (
            (candidates?.candidates ?? []).map((c) => (
              <Card key={c.id} className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{c.ruleOrAttribute}</CardTitle>
                    <Badge variant="outline" className={
                      c.reviewStatus === "approved" ? "text-emerald-400 border-emerald-500/30" :
                      c.reviewStatus === "rejected" ? "text-red-400 border-red-500/30" :
                      "text-amber-400 border-amber-500/30"
                    }>{c.reviewStatus}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Segment:</span> {c.segmentId}</div>
                    <div><span className="text-muted-foreground">Evidence count:</span> {c.evidenceCount}</div>
                    <div><span className="text-muted-foreground">Confidence:</span> {c.confidence}</div>
                    <div><span className="text-muted-foreground">Proposed by:</span> User {c.proposedBy}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Current:</span> {c.currentValue}</div>
                    <div><span className="text-muted-foreground">Proposed:</span> {c.proposedValue}</div>
                  </div>
                  {c.reviewStatus === "proposed" && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => reviewMutation.mutate({ candidateId: c.id, reviewStatus: "under_review" })}>
                        Start Review
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 text-red-400"
                        onClick={() => reviewMutation.mutate({ candidateId: c.id, reviewStatus: "rejected" })}>
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Participants */}
        <TabsContent value="participants" className="space-y-4 pt-4">
          {(participants?.participants ?? []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No participants registered yet.</p>
              <Button className="mt-3" size="sm" onClick={() => navigate("/captwin/lp-twin/validation/participants/new")}>
                Register First Participant
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {(participants?.participants ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {p.anonymizationPreference === "full_anonymous" ? `Anonymous ${p.participantType}` : (p.organizationName ?? `Participant ${p.id}`)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.participantType} · {p.geography ?? "Geography not specified"} · {p.allocatorSegment ?? "Segment not specified"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={p.consentStatus === "granted" ? "text-emerald-400 border-emerald-500/30 text-xs" : "text-muted-foreground text-xs"}>
                      {p.consentStatus}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{p.verificationStatus}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Scenarios */}
        <TabsContent value="scenarios" className="space-y-4 pt-4">
          <div>
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Standard Validation Scenarios</h3>
            <div className="space-y-2">
              {(scenarios?.standardScenarios ?? []).map((s) => (
                <Card key={s.scenarioCode} className="bg-white/5 border-white/10">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{s.scenarioName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.scenarioCode} · v{s.version} · {s.strategy} · {s.geography}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 ml-4">${s.targetSizeM}M</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.expectedChallenges.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs text-amber-400 border-amber-500/30">{c}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          {(scenarios?.scenarios ?? []).length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Custom Scenarios</h3>
              <div className="space-y-2">
                {(scenarios?.scenarios ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{s.scenarioName}</p>
                      <p className="text-xs text-muted-foreground">{s.scenarioCode} · v{s.version} · {s.strategy}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{s.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Report */}
        <TabsContent value="report" className="space-y-4 pt-4">
          {report ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{report.reportTitle}</h2>
                <span className="text-xs text-muted-foreground">Generated {new Date(report.generatedAt).toLocaleString()}</span>
              </div>
              <Card className="bg-white/5 border-white/10">
                <CardHeader><CardTitle className="text-sm">Methodology</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground">{report.methodology}</CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Participants", value: report.participants.total },
                  { label: "Verified", value: report.participants.verified },
                  { label: "Scenarios", value: report.scenarios.total },
                  { label: "Responses", value: report.responses.total },
                ].map((item) => (
                  <Card key={item.label} className="bg-white/5 border-white/10">
                    <CardContent className="pt-4 pb-3 text-center">
                      <div className="text-2xl font-bold">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="bg-white/5 border-white/10">
                <CardHeader><CardTitle className="text-sm">Synthetic Versions</CardTitle></CardHeader>
                <CardContent className="text-xs space-y-1">
                  <div><span className="text-muted-foreground">Agent Bank:</span> {report.syntheticVersions.agentBankVersion}</div>
                  <div><span className="text-muted-foreground">Fit Engine:</span> {report.syntheticVersions.fitEngineVersion}</div>
                  <div><span className="text-muted-foreground">Objection Engine:</span> {report.syntheticVersions.objectionEngineVersion}</div>
                  <div><span className="text-muted-foreground">Validation Engine:</span> {report.syntheticVersions.validationEngineVersion}</div>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardHeader><CardTitle className="text-sm">Known Limitations</CardTitle></CardHeader>
                <CardContent className="text-xs space-y-1 text-muted-foreground">
                  {report.knownLimitations.map((l, i) => (
                    <div key={i}>• {l}</div>
                  ))}
                </CardContent>
              </Card>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
                {report.disclaimer}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">Loading report…</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
