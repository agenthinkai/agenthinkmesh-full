import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Info, ExternalLink } from "lucide-react";
import { Link } from "wouter";

const FIT_CATEGORY_COLORS: Record<string, string> = {
  "Strong Fit": "text-green-400 border-green-500/30",
  "Conditional Fit": "text-yellow-400 border-yellow-500/30",
  "Weak Fit": "text-orange-400 border-orange-500/30",
  "Likely Ineligible": "text-red-400 border-red-500/30",
};

export default function LPTwinAgentBank() {
  const [, navigate] = useLocation();
  const [compareFundId, setCompareFundId] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: fundsData } = trpc.lpTwin.listFunds.useQuery({ includeArchived: false });
  const { data: agentBankData, isLoading } = trpc.lpTwinMeeting.listAgentBank.useQuery({
    compareWithFundId: compareFundId ? parseInt(compareFundId) : undefined,
  });

  const { data: agentDetail } = trpc.lpTwinMeeting.getAgentBankEntry.useQuery(
    {
      segmentId: selectedAgent ?? "",
      compareWithFundId: compareFundId ? parseInt(compareFundId) : undefined,
    },
    { enabled: !!selectedAgent }
  );

  const agents = agentBankData?.agents ?? [];
  const funds = fundsData?.funds ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/captwin/lp-twin">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to LP Twin
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">LP Agent Bank</h1>
              <p className="text-sm text-muted-foreground">Browse institutional allocator archetypes — test your fund against real institutional profiles</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Disclaimer Banner */}
        <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-blue-400">Synthetic LP Archetypes</span>
            <span className="text-muted-foreground ml-2">{agentBankData?.disclaimer ?? "These profiles are evidence-based synthetic representations of institutional allocator types. They do not represent any specific institution."}</span>
          </div>
        </div>

        {/* Compare with Fund */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-muted-foreground shrink-0">Compare with Fund:</label>
          <Select value={compareFundId} onValueChange={setCompareFundId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a fund to compare..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No comparison</SelectItem>
              {funds.map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>{f.fundName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {compareFundId && (
            <span className="text-sm text-muted-foreground">Fit scores shown against selected fund</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Agent List */}
          <div className="col-span-1 space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading archetypes...</div>
            ) : (
              agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedAgent === agent.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{agent.type}</p>
                      <Badge variant="outline" className="text-xs mt-1.5 text-blue-400 border-blue-500/30">{agent.archetypeLabel}</Badge>
                    </div>
                    {agent.fitScore !== null && (
                      <Badge variant="outline" className={`text-xs shrink-0 ${FIT_CATEGORY_COLORS[agent.fitCategory ?? ""] ?? ""}`}>
                        {agent.fitScore}/100
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{agent.mandate}</p>
                </button>
              ))
            )}
          </div>

          {/* Agent Detail */}
          <div className="col-span-2">
            {selectedAgent && agentDetail ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{agentDetail.agent.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-blue-400 border-blue-500/30">{agentDetail.agent.archetypeLabel}</Badge>
                          <Badge variant="outline" className="text-muted-foreground">{agentDetail.agent.segmentType}</Badge>
                        </div>
                      </div>
                      {agentDetail.fitResult && (
                        <Badge variant="outline" className={`text-sm ${FIT_CATEGORY_COLORS[agentDetail.fitResult.fitCategory] ?? ""}`}>
                          {agentDetail.fitResult.overallFitScore}/100 — {agentDetail.fitResult.fitCategory}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Mandate</p>
                      <p className="text-sm text-muted-foreground">{agentDetail.agent.mandate}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Geography:</span> <span className="ml-2">{agentDetail.agent.geography}</span></div>
                      <div><span className="text-muted-foreground">Ticket Size:</span> <span className="ml-2">${agentDetail.agent.ticketSizeMinM}M – ${agentDetail.agent.ticketSizeMaxM}M</span></div>
                      <div><span className="text-muted-foreground">Diligence Cycle:</span> <span className="ml-2">{agentDetail.agent.diligenceDurationMonths} months</span></div>
                      <div><span className="text-muted-foreground">Decision Authority:</span> <span className="ml-2">{agentDetail.agent.decisionAuthority}</span></div>
                      <div><span className="text-muted-foreground">Sharia Required:</span> <span className="ml-2">{agentDetail.agent.shariaRequired ? "Yes" : "No"}</span></div>
                      <div><span className="text-muted-foreground">First-Time Funds:</span> <span className="ml-2">{agentDetail.agent.firstTimeFundTolerance ? "Considered" : "Not considered"}</span></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Evidence and Governance */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Evidence Basis & Governance</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Evidence Basis:</span>
                      <p className="mt-1 text-muted-foreground">{agentDetail.agent.evidenceBasis}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Verification Status:</span>
                      <p className="mt-1 text-muted-foreground">{agentDetail.agent.verificationStatus}</p>
                    </div>
                    <div className="flex gap-4">
                      <div><span className="text-muted-foreground">Last Updated:</span> <span className="ml-2">{agentDetail.agent.lastUpdated}</span></div>
                      <div><span className="text-muted-foreground">Registry Version:</span> <span className="ml-2">{agentDetail.agent.registryVersion}</span></div>
                    </div>
                    {agentDetail.agent.knownLimitations.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Known Limitations:</span>
                        {agentDetail.agent.knownLimitations.map((l: string, i: number) => (
                          <p key={i} className="text-muted-foreground mt-0.5">• {l}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Fit Result if fund selected */}
                {agentDetail.fitResult && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Fit Analysis</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {agentDetail.fitResult.disqualifyingIssues.length > 0 && (
                        <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                          <p className="text-sm font-medium text-red-400 mb-1">Disqualifying Issues</p>
                          {agentDetail.fitResult.disqualifyingIssues.map((issue: string, i: number) => (
                            <p key={i} className="text-sm text-muted-foreground">• {issue}</p>
                          ))}
                        </div>
                      )}
                      {agentDetail.fitResult.principalFitReasons.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-green-400 mb-1">Principal Fit Reasons</p>
                          {agentDetail.fitResult.principalFitReasons.map((r: string, i: number) => (
                            <p key={i} className="text-sm text-muted-foreground">• {r}</p>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Objections if fund selected */}
                {agentDetail.objections && agentDetail.objections.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Likely Objections</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {agentDetail.objections.slice(0, 5).map((o: { category: string; statement: string; severity: string }, i: number) => (
                        <div key={i} className="text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-xs ${o.severity === "critical" ? "text-red-400 border-red-500/30" : o.severity === "high" ? "text-orange-400 border-orange-500/30" : "text-yellow-400 border-yellow-500/30"}`}>{o.severity}</Badge>
                            <span className="font-medium">{o.category}</span>
                          </div>
                          <p className="text-muted-foreground mt-1">{o.statement}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  {compareFundId && (
                    <Button onClick={() => navigate(`/captwin/lp-twin/meeting-room/${compareFundId}`)}>
                      Open Meeting Room
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground italic self-center">{agentDetail.disclaimer}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <Info className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Select an LP archetype to view details</p>
                  {!compareFundId && (
                    <p className="text-sm mt-1">Select a fund above to see fit scores</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
