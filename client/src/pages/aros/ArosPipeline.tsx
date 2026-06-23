import { toast } from "sonner";
/**
 * AROS Pipeline — Revenue loop Kanban
 * Company → Outreach → Meeting → Proposal → Customer
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GitBranch, RefreshCw, DollarSign, ArrowRight } from "lucide-react";


const STAGES = [
  { key: "RESEARCHED", label: "Researched", color: "border-t-gray-400" },
  { key: "OUTREACH_SENT", label: "Outreach Sent", color: "border-t-blue-400" },
  { key: "RESPONSE_RECEIVED", label: "Response", color: "border-t-indigo-400" },
  { key: "MEETING_BOOKED", label: "Meeting Booked", color: "border-t-purple-400" },
  { key: "MEETING_HELD", label: "Meeting Held", color: "border-t-violet-400" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", color: "border-t-orange-400" },
  { key: "NEGOTIATION", label: "Negotiation", color: "border-t-amber-400" },
  { key: "CUSTOMER", label: "Customer", color: "border-t-green-500" },
];

export function ArosPipeline() {
  
  const [moveTarget, setMoveTarget] = useState<{ id: number; company: string; currentStage: string } | null>(null);
  const [newStage, setNewStage] = useState<string>("");
  const [moveNotes, setMoveNotes] = useState("");

  const { data: overview, isLoading, refetch } = trpc.arosPipeline.getConversionFunnel.useQuery();
  const { data: kanbanData } = trpc.arosPipeline.getKanban.useQuery();

  const advanceStageMutation = trpc.arosPipeline.advanceStage.useMutation({
    onSuccess: () => {
      toast.success("Stage Updated");
      setMoveTarget(null);
      setNewStage("");
      setMoveNotes("");
      refetch();
    },
    onError: (err) => toast.error(`Error: `),
  });

  const byStage: Record<string, Array<{ pipeline: { id: number; stage: string; dealValueUsd: number | null; notes: string | null }; company: { companyName: string; sector: string } }>> = {};
  for (const stage of STAGES) byStage[stage.key] = [];
  if (kanbanData) {
    for (const [stageKey, cards] of Object.entries(kanbanData)) {
      byStage[stageKey] = cards as typeof byStage[string];
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Revenue Pipeline</h1>
            </div>
            <p className="text-sm text-muted-foreground">Company → Outreach → Meeting → Proposal → Customer</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Funnel Metrics */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Outreach → Response</p>
              <p className="text-xl font-bold">{(overview.conversionRates?.outreachToResponse ?? 0).toFixed(1)}%</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Response → Meeting</p>
              <p className="text-xl font-bold">{(overview.conversionRates?.responseToMeeting ?? 0).toFixed(1)}%</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Meeting → Proposal</p>
              <p className="text-xl font-bold">{(overview.conversionRates?.meetingToProposal ?? 0).toFixed(1)}%</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Overall Conversion</p>
              <p className="text-xl font-bold">{(overview.conversionRates?.overallConversion ?? 0).toFixed(1)}%</p>
            </Card>
          </div>
        )}

        {/* Kanban Board */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading pipeline...</div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3 min-w-max">
              {STAGES.map(stage => {
                const cards = byStage[stage.key] ?? [];
                const stageData = overview?.stages?.find((s: { stage: string; count: number; totalDealValue: number }) => s.stage === stage.key);
                return (
                  <div key={stage.key} className="w-56 shrink-0">
                    <div className={`rounded-t-lg border-t-4 ${stage.color} bg-muted/30 px-3 py-2 mb-2`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{stage.label}</span>
                        <Badge variant="secondary" className="text-xs h-5">{stageData?.count ?? 0}</Badge>
                      </div>
                      {stageData && stageData.totalDealValue > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-0.5">
                          <DollarSign className="h-3 w-3" />{(stageData.totalDealValue / 1000).toFixed(0)}K
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 min-h-24">
                      {cards.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-4">Empty</div>
                      ) : (
                        cards.map(({ pipeline, company }) => (
                          <Card
                            key={pipeline.id}
                            className="cursor-pointer hover:shadow-md transition-all"
                            onClick={() => setMoveTarget({ id: pipeline.id, company: company.companyName, currentStage: pipeline.stage })}
                          >
                            <CardContent className="p-2.5">
                              <p className="text-xs font-medium leading-tight">{company.companyName}</p>
                              <p className="text-xs text-muted-foreground">{company.sector}</p>
                              {pipeline.dealValueUsd && (
                                <p className="text-xs text-green-600 font-semibold mt-1">${(pipeline.dealValueUsd / 1000).toFixed(0)}K</p>
                              )}
                              <div className="flex items-center gap-1 mt-1.5">
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Move</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Move Stage Modal */}
        <Dialog open={!!moveTarget} onOpenChange={() => setMoveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Move: {moveTarget?.company}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Current: <strong>{moveTarget?.currentStage?.replace(/_/g, " ")}</strong></p>
              <Select value={newStage} onValueChange={setNewStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new stage..." />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.filter(s => s.key !== moveTarget?.currentStage).map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <textarea
                className="w-full text-sm border rounded-md p-2 bg-background resize-none"
                rows={2}
                placeholder="Notes (optional)..."
                value={moveNotes}
                onChange={e => setMoveNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveTarget(null)}>Cancel</Button>
              <Button
                disabled={!newStage}
                onClick={() => moveTarget && advanceStageMutation.mutate({
                  pipelineId: moveTarget.id,
                  newStage: newStage as "RESEARCHED" | "OUTREACH_SENT" | "RESPONSE_RECEIVED" | "MEETING_BOOKED" | "MEETING_HELD" | "PROPOSAL_SENT" | "NEGOTIATION" | "CUSTOMER" | "CHURNED" | "DISQUALIFIED",
                  notes: moveNotes || undefined,
                })}
              >
                Move Stage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
