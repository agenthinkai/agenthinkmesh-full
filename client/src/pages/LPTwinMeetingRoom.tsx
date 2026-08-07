import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, FileText, MessageSquare, Users, Target, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const MEETING_TYPES = [
  { value: "introductory", label: "Introductory Meeting" },
  { value: "first_diligence", label: "First Diligence" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "ic_preparation", label: "IC Preparation" },
  { value: "terms_discussion", label: "Terms Discussion" },
  { value: "final_diligence", label: "Final Diligence" },
  { value: "reup_discussion", label: "Re-Up Discussion" },
  { value: "consultant_gatekeeper", label: "Consultant / Gatekeeper" },
];

const MEETING_OBJECTIVES = [
  { value: "secure_second_meeting", label: "Secure Second Meeting" },
  { value: "enter_formal_diligence", label: "Enter Formal Diligence" },
  { value: "obtain_data_room_request", label: "Obtain Data Room Request" },
  { value: "resolve_objections", label: "Resolve Objections" },
  { value: "discuss_terms", label: "Discuss Terms" },
  { value: "secure_soft_circle", label: "Secure Soft Circle" },
  { value: "progress_toward_commitment", label: "Progress Toward Commitment" },
  { value: "understand_rejection", label: "Understand Rejection" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  moderate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

export default function LPTwinMeetingRoom() {
  const params = useParams<{ fundId: string }>();
  const fundId = parseInt(params.fundId ?? "0");
  const [, navigate] = useLocation();

  const [activeTab, setActiveTab] = useState("brief");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [meetingType, setMeetingType] = useState("introductory");
  const [meetingObjective, setMeetingObjective] = useState("secure_second_meeting");
  const [rehearsalObjection, setRehearsalObjection] = useState("");
  const [rehearsalResponse, setRehearsalResponse] = useState("");
  const [panelSegments, setPanelSegments] = useState<string[]>([]);

  const { data: agentBankData } = trpc.lpTwinMeeting.listAgentBank.useQuery({ compareWithFundId: fundId });
  const { data: fundData } = trpc.lpTwin.getFund.useQuery({ fundId });
  const { data: readinessData } = trpc.lpTwinMeeting.getReadinessScore.useQuery({ fundId });

  const generateBrief = trpc.lpTwinMeeting.generateMeetingBrief.useMutation({
    onError: (e) => toast.error(`Brief generation failed: ${e.message}`),
  });

  const evaluateRehearsal = trpc.lpTwinMeeting.evaluateObjectionResponse.useMutation({
    onError: (e) => toast.error(`Evaluation failed: ${e.message}`),
  });

  const runPanel = trpc.lpTwinMeeting.runLPPanel.useMutation({
    onError: (e) => toast.error(`Panel failed: ${e.message}`),
  });

  const brief = generateBrief.data?.brief;
  const evaluation = evaluateRehearsal.data?.evaluation;
  const panelResult = runPanel.data?.panelResult;
  const readiness = readinessData?.readiness;
  const agents = agentBankData?.agents ?? [];

  const handleGenerateBrief = () => {
    if (!selectedSegment) { toast.error("Select an LP segment first"); return; }
    generateBrief.mutate({ fundId, segmentId: selectedSegment, meetingType: meetingType as "introductory", meetingObjective: meetingObjective as "secure_second_meeting" });
  };

  const handleEvaluate = () => {
    if (!selectedSegment || !rehearsalObjection || !rehearsalResponse) {
      toast.error("Select a segment and enter both the objection and your response");
      return;
    }
    evaluateRehearsal.mutate({ fundId, segmentId: selectedSegment, objection: rehearsalObjection, gpResponse: rehearsalResponse });
  };

  const handleRunPanel = () => {
    const segments = panelSegments.length > 0 ? panelSegments : agents.slice(0, 5).map((a) => a.id);
    runPanel.mutate({ fundId, segmentIds: segments });
  };

  const togglePanelSegment = (id: string) => {
    setPanelSegments((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  if (!fundId) return <div className="p-8 text-muted-foreground">Invalid fund ID.</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/captwin/lp-twin/fund/${fundId}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Fund
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">LP Meeting Room</h1>
              <p className="text-sm text-muted-foreground">{fundData?.fund?.fundName ?? `Fund ${fundId}`} — Prepare for the investor before you meet the investor</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Readiness Banner */}
        {readiness && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center justify-between ${
            readiness.readinessLabel === "Ready" ? "bg-green-500/10 border-green-500/30" :
            readiness.readinessLabel === "Ready with Conditions" ? "bg-yellow-500/10 border-yellow-500/30" :
            "bg-red-500/10 border-red-500/30"
          }`}>
            <div className="flex items-center gap-3">
              {readiness.readinessLabel === "Ready" ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
              <div>
                <span className="font-semibold">Global Investor Readiness: {readiness.overallScore}/100 — {readiness.readinessLabel}</span>
                {readiness.topBlockers.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">Top blocker: {readiness.topBlockers[0]}</p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("readiness")}>View Details</Button>
          </div>
        )}

        {/* Segment Selector */}
        <div className="mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">LP Segment</label>
            <Select value={selectedSegment} onValueChange={setSelectedSegment}>
              <SelectTrigger>
                <SelectValue placeholder="Select an LP archetype..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.fitScore !== null ? ` — ${a.fitScore}/100` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Meeting Type</label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Meeting Objective</label>
            <Select value={meetingObjective} onValueChange={setMeetingObjective}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MEETING_OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="brief" className="gap-2"><FileText className="w-4 h-4" />Meeting Brief</TabsTrigger>
            <TabsTrigger value="rehearsal" className="gap-2"><MessageSquare className="w-4 h-4" />Objection Rehearsal</TabsTrigger>
            <TabsTrigger value="panel" className="gap-2"><Users className="w-4 h-4" />LP Panel</TabsTrigger>
            <TabsTrigger value="readiness" className="gap-2"><Target className="w-4 h-4" />Readiness</TabsTrigger>
          </TabsList>

          {/* Meeting Brief Tab */}
          <TabsContent value="brief">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">Generate a structured pre-meeting preparation brief grounded in deterministic fit analysis.</p>
              <Button onClick={handleGenerateBrief} disabled={generateBrief.isPending || !selectedSegment} className="gap-2">
                {generateBrief.isPending ? "Generating..." : "Generate Brief"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {brief ? (
              <div className="space-y-4">
                {/* Investor Archetype */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Investor Archetype — {brief.segmentName}</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Type:</span> <span className="ml-2">{brief.investorArchetype.allocatorType}</span></div>
                    <div><span className="text-muted-foreground">Ticket Size:</span> <span className="ml-2">{brief.investorArchetype.ticketSizeRange}</span></div>
                    <div><span className="text-muted-foreground">Diligence Cycle:</span> <span className="ml-2">{brief.investorArchetype.typicalDiligenceCycle}</span></div>
                    <div><span className="text-muted-foreground">Decision Process:</span> <span className="ml-2">{brief.investorArchetype.decisionProcess}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Mandate:</span> <span className="ml-2">{brief.investorArchetype.typicalMandate}</span></div>
                  </CardContent>
                </Card>

                {/* Fund Fit */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-3">
                      Fund Fit
                      <Badge variant="outline" className={
                        brief.fundFit.fitCategory === "Strong Fit" ? "text-green-400 border-green-500/30" :
                        brief.fundFit.fitCategory === "Conditional Fit" ? "text-yellow-400 border-yellow-500/30" :
                        "text-red-400 border-red-500/30"
                      }>{brief.fundFit.overallScore}/100 — {brief.fundFit.fitCategory}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {brief.fundFit.eligibilityIssues.length > 0 && (
                      <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30">
                        <p className="text-sm font-medium text-red-400 mb-1">Eligibility Issues</p>
                        {brief.fundFit.eligibilityIssues.map((issue, i) => <p key={i} className="text-sm text-muted-foreground">• {issue}</p>)}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm font-medium text-green-400 mb-2">Strongest Dimensions</p>
                        {brief.fundFit.strongestDimensions.map((d, i) => (
                          <div key={i} className="text-sm mb-1.5">
                            <span className="font-medium">{d.dimension}</span> <span className="text-muted-foreground">({d.score}/100)</span>
                            <p className="text-muted-foreground text-xs">{d.reasoning}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-400 mb-2">Weakest Dimensions</p>
                        {brief.fundFit.weakestDimensions.map((d, i) => (
                          <div key={i} className="text-sm mb-1.5">
                            <span className="font-medium">{d.dimension}</span> <span className="text-muted-foreground">({d.score}/100)</span>
                            <p className="text-muted-foreground text-xs">{d.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Likely Questions */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Likely Questions ({brief.likelyQuestions.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {brief.likelyQuestions.slice(0, 8).map((q, i) => (
                      <div key={i} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className={`text-xs shrink-0 ${SEVERITY_COLORS[q.priority] ?? ""}`}>{q.priority}</Badge>
                          <div>
                            <p className="text-sm font-medium">{q.question}</p>
                            <p className="text-xs text-muted-foreground mt-1">{q.suggestedResponse}</p>
                            {q.evidenceNeeded.length > 0 && (
                              <p className="text-xs text-blue-400 mt-1">Evidence: {q.evidenceNeeded.join(" · ")}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Likely Objections */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Likely Objections ({brief.likelyObjections.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {brief.likelyObjections.map((o, i) => (
                      <div key={i} className={`p-3 rounded-md border ${SEVERITY_COLORS[o.severity] ?? "border-border"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[o.severity] ?? ""}`}>{o.severity}</Badge>
                          <span className="text-sm font-medium">{o.category}</span>
                          {!o.curable && <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">May be uncurable</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{o.statement}</p>
                        <p className="text-xs text-blue-400 mt-1.5">Response: {o.recommendedResponse}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Positioning + Next Action */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Positioning Guidance</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {brief.positioning.emphasize.length > 0 && (
                        <div>
                          <p className="font-medium text-green-400 mb-1">Emphasize</p>
                          {brief.positioning.emphasize.map((e, i) => <p key={i} className="text-muted-foreground">• {e}</p>)}
                        </div>
                      )}
                      {brief.positioning.doNotOverstate.length > 0 && (
                        <div>
                          <p className="font-medium text-red-400 mb-1">Do Not Overstate</p>
                          {brief.positioning.doNotOverstate.map((e, i) => <p key={i} className="text-muted-foreground">• {e}</p>)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Suggested Next Action</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{brief.suggestedNextAction}</p>
                      <div className="mt-3 p-2 rounded bg-muted/30 text-xs text-muted-foreground italic">{brief.disclaimer}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Select an LP segment and click Generate Brief to prepare for your meeting.</p>
              </div>
            )}
          </TabsContent>

          {/* Objection Rehearsal Tab */}
          <TabsContent value="rehearsal">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm text-muted-foreground">Practice your response to a specific objection. The evaluator scores factual completeness, directness, credibility, and consistency with fund data only — not charisma or tone.</p>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Objection to Rehearse</label>
                <Textarea
                  placeholder="e.g. Your track record is too short for our mandate..."
                  value={rehearsalObjection}
                  onChange={(e) => setRehearsalObjection(e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Your Response</label>
                <Textarea
                  placeholder="Enter your response as you would deliver it in the meeting..."
                  value={rehearsalResponse}
                  onChange={(e) => setRehearsalResponse(e.target.value)}
                  rows={5}
                />
              </div>
              <Button onClick={handleEvaluate} disabled={evaluateRehearsal.isPending || !selectedSegment}>
                {evaluateRehearsal.isPending ? "Evaluating..." : "Evaluate Response"}
              </Button>

              {evaluation && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-3">
                      Evaluation Result
                      <Badge variant="outline" className={
                        evaluation.verdict === "Strong" ? "text-green-400 border-green-500/30" :
                        evaluation.verdict === "Adequate" ? "text-yellow-400 border-yellow-500/30" :
                        "text-red-400 border-red-500/30"
                      }>{evaluation.verdict} — {evaluation.overallScore}/100</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>Evidence Completeness: <span className="font-medium">{evaluation.dimensions.evidenceCompleteness}/100</span></div>
                      <div>Directness: <span className="font-medium">{evaluation.dimensions.directness}/100</span></div>
                      <div>Credibility: <span className="font-medium">{evaluation.dimensions.credibility}/100</span></div>
                      <div>Consistency with Fund Data: <span className="font-medium">{evaluation.dimensions.consistencyWithFundData}/100</span></div>
                    </div>
                    {evaluation.dimensions.unsupportedClaims.length > 0 && (
                      <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                        <p className="text-sm font-medium text-red-400 mb-1">Unsupported Claims Detected</p>
                        {evaluation.dimensions.unsupportedClaims.map((c, i) => <p key={i} className="text-sm text-muted-foreground">• {c}</p>)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium mb-2">Coaching</p>
                      {evaluation.coaching.map((c, i) => <p key={i} className="text-sm text-muted-foreground mb-1">• {c}</p>)}
                    </div>
                    <p className="text-xs text-muted-foreground italic">{evaluation.disclaimer}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* LP Panel Tab */}
          <TabsContent value="panel">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Run the fund against multiple LP archetypes simultaneously. Select segments or use the default panel of 5.</p>
                <Button onClick={handleRunPanel} disabled={runPanel.isPending}>
                  {runPanel.isPending ? "Running Panel..." : "Run LP Panel"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => togglePanelSegment(a.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      panelSegments.includes(a.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>

              {panelResult && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Panel Summary</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 text-center mb-4">
                        <div className="p-3 rounded-lg bg-green-500/10">
                          <div className="text-2xl font-bold text-green-400">{panelResult.summary.wouldContinueCount}</div>
                          <div className="text-xs text-muted-foreground mt-1">Would Continue</div>
                        </div>
                        <div className="p-3 rounded-lg bg-yellow-500/10">
                          <div className="text-2xl font-bold text-yellow-400">{panelResult.summary.requiresEvidenceCount}</div>
                          <div className="text-xs text-muted-foreground mt-1">Needs Evidence</div>
                        </div>
                        <div className="p-3 rounded-lg bg-orange-500/10">
                          <div className="text-2xl font-bold text-orange-400">{panelResult.summary.requiresTermChangesCount}</div>
                          <div className="text-xs text-muted-foreground mt-1">Needs Term Changes</div>
                        </div>
                        <div className="p-3 rounded-lg bg-red-500/10">
                          <div className="text-2xl font-bold text-red-400">{panelResult.summary.wouldDeclineCount}</div>
                          <div className="text-xs text-muted-foreground mt-1">Would Decline</div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{panelResult.summary.fundraisingRecommendation}</p>
                      {panelResult.summary.commonObjections.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-1">Common Objections Across Segments</p>
                          <div className="flex flex-wrap gap-2">
                            {panelResult.summary.commonObjections.map((o, i) => (
                              <Badge key={i} variant="outline" className="text-orange-400 border-orange-500/30">{o}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-2 gap-4">
                    {panelResult.agentResults.map((r) => (
                      <Card key={r.segmentId}>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center justify-between">
                            {r.segmentName}
                            <Badge variant="outline" className={
                              r.decision === "Would Continue" ? "text-green-400 border-green-500/30" :
                              r.decision === "Would Decline" ? "text-red-400 border-red-500/30" :
                              "text-yellow-400 border-yellow-500/30"
                            }>{r.decision}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                          <div>Fit: <span className="font-medium">{r.fitScore}/100</span> <span className="text-muted-foreground">({r.fitCategory})</span></div>
                          {r.topObjections.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Top objections: </span>
                              {r.topObjections.map((o) => o.category).join(", ")}
                            </div>
                          )}
                          {r.positiveSignals.length > 0 && (
                            <div className="text-green-400 text-xs">{r.positiveSignals[0]}</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground italic">{panelResult.disclaimer}</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Readiness Tab */}
          <TabsContent value="readiness">
            {readiness ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${
                    readiness.readinessLabel === "Ready" ? "text-green-400" :
                    readiness.readinessLabel === "Ready with Conditions" ? "text-yellow-400" :
                    "text-red-400"
                  }`}>{readiness.overallScore}</div>
                  <div>
                    <div className="text-lg font-semibold">{readiness.readinessLabel}</div>
                    <div className="text-sm text-muted-foreground">Global Investor Readiness Score</div>
                  </div>
                </div>

                {readiness.topBlockers.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base text-red-400">Top Blockers</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {readiness.topBlockers.map((b, i) => <p key={i} className="text-sm text-muted-foreground">• {b}</p>)}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader><CardTitle className="text-base">Dimension Scores</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {readiness.dimensions.map((d) => (
                        <div key={d.id} className="flex items-center gap-3">
                          <div className="w-40 text-sm shrink-0">{d.label}</div>
                          <div className="flex-1 bg-muted/30 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${d.score >= 75 ? "bg-green-500" : d.score >= 55 ? "bg-yellow-500" : "bg-red-500"}`}
                              style={{ width: `${d.score}%` }}
                            />
                          </div>
                          <div className="w-12 text-sm text-right text-muted-foreground">{d.score}/100</div>
                          <Badge variant="outline" className={`text-xs w-20 justify-center ${
                            d.label_score === "strong" ? "text-green-400 border-green-500/30" :
                            d.label_score === "adequate" ? "text-yellow-400 border-yellow-500/30" :
                            "text-red-400 border-red-500/30"
                          }`}>{d.label_score}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {readiness.highestImpactCorrections.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Highest-Impact Corrections</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {readiness.highestImpactCorrections.map((c, i) => <p key={i} className="text-sm text-muted-foreground">• {c}</p>)}
                    </CardContent>
                  </Card>
                )}

                <p className="text-xs text-muted-foreground italic">{readiness.disclaimer}</p>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Loading readiness score...</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
