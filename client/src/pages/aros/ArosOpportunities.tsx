import { toast } from "sonner";
/**
 * AROS Opportunities — Top 20 ranked opportunities
 * Decision Detection output with urgency, ACV, and outreach actions
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Target, Mail, Brain, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";


function TierBadge({ tier }: { tier: string | null | undefined }) {
  const map: Record<string, string> = {
    OUTREACH_CANDIDATE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    HIGH_PRIORITY: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    ACTIVE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    UNIVERSE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const t = tier ?? "UNIVERSE";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[t] ?? map.UNIVERSE}`}>{t.replace(/_/g, " ")}</span>;
}

export function ArosOpportunities() {
  
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dossierCompany, setDossierCompany] = useState<{ name: string; dossier: string; twin: string } | null>(null);
  const [generatingOutreach, setGeneratingOutreach] = useState<number | null>(null);
  const [scoringId, setScoringId] = useState<number | null>(null);

  const { data: top20, isLoading, refetch } = trpc.arosDecisionDetection.getTop20.useQuery();

  const generateOutreachMutation = trpc.arosOutreachFactory.generate.useMutation({
    onSuccess: () => {
      setGeneratingOutreach(null);
      toast.success("Outreach Generated: Added to approval queue");
    },
    onError: (err) => {
      setGeneratingOutreach(null);
      toast.error(`Error: `);
    },
  });

  const scoreOpportunityMutation = trpc.arosDecisionDetection.scoreOpportunity.useMutation({
    onSuccess: (result) => {
      setScoringId(null);
      toast.success("Scored: Tier: ${result.tier} | Urgency: ${result.urgencyScore}");
      refetch();
    },
    onError: (err) => {
      setScoringId(null);
      toast.error(`Error: `);
    },
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Top 20 Opportunities</h1>
            </div>
            <p className="text-sm text-muted-foreground">Decision Detection output — ranked by composite score</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Opportunity Cards */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading opportunities...</div>
        ) : !top20?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No opportunities yet. Run a Discovery from the Command Center to populate the universe.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {top20.map((row, i) => {
              const co = row.company;
              const isExpanded = expandedId === co.id;
              return (
                <Card key={co.id} className="overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20"
                    onClick={() => setExpandedId(isExpanded ? null : co.id)}
                  >
                    {/* Rank */}
                    <div className="text-2xl font-black text-muted-foreground/40 w-8 shrink-0">
                      {i + 1}
                    </div>

                    {/* Company Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{co.companyName}</span>
                        <TierBadge tier={row.job?.funnelTier} />
                        {row.signalCount > 0 && (
                          <Badge variant="outline" className="text-xs">{row.signalCount} signals</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {co.sector} · {co.country} {co.ceoName ? `· CEO: ${co.ceoName}` : ""}
                      </p>
                      {co.keyDecisionDomain && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{co.keyDecisionDomain}</p>
                      )}
                    </div>

                    {/* Scores */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Opp</p>
                        <p className="text-lg font-bold">{co.opportunityScore}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Fit</p>
                        <p className="text-lg font-bold">{co.agenthinkFitScore}</p>
                      </div>
                      {row.totalAcv > 0 && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">ACV</p>
                          <p className="text-sm font-bold text-green-600">${(row.totalAcv / 1000).toFixed(0)}K</p>
                        </div>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t bg-muted/10 p-4 space-y-3">
                      {co.activeStrategicInitiative && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Strategic Initiative</p>
                          <p className="text-sm">{co.activeStrategicInitiative}</p>
                        </div>
                      )}
                      {co.aiTransformationSignal && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">AI Signal</p>
                          <p className="text-sm">{co.aiTransformationSignal}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={generatingOutreach === co.id}
                          onClick={() => {
                            setGeneratingOutreach(co.id);
                            generateOutreachMutation.mutate({ companyId: co.id });
                          }}
                        >
                          {generatingOutreach === co.id
                            ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
                            : <><Mail className="h-3 w-3 mr-1" /> Generate Outreach</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={scoringId === co.id}
                          onClick={() => {
                            setScoringId(co.id);
                            scoreOpportunityMutation.mutate({ companyId: co.id });
                          }}
                        >
                          {scoringId === co.id
                            ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Scoring...</>
                            : <><Target className="h-3 w-3 mr-1" /> Re-Score</>}
                        </Button>
                        {(co.executiveDossier || co.decisionTwin) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => setDossierCompany({
                              name: co.companyName,
                              dossier: co.executiveDossier ?? "",
                              twin: co.decisionTwin ?? "",
                            })}
                          >
                            <Brain className="h-3 w-3 mr-1" /> View Dossier
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Dossier Modal */}
        <Dialog open={!!dossierCompany} onOpenChange={() => setDossierCompany(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dossierCompany?.name} — Intelligence Package</DialogTitle>
            </DialogHeader>
            {dossierCompany && (
              <div className="space-y-4 text-sm">
                {dossierCompany.dossier && (
                  <div>
                    <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Executive Dossier</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{dossierCompany.dossier}</p>
                  </div>
                )}
                {dossierCompany.twin && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Decision Twin</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{dossierCompany.twin}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
