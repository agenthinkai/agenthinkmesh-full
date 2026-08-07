import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, TrendingUp, Users, Calendar, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";

const STAGES = ["target", "contacted", "first_meeting", "follow_up", "diligence", "ic_review", "soft_circle", "committed", "declined", "deferred"];
const STAGE_COLORS: Record<string, string> = {
  target: "bg-slate-500/20 text-slate-400",
  contacted: "bg-blue-500/20 text-blue-400",
  first_meeting: "bg-cyan-500/20 text-cyan-400",
  follow_up: "bg-indigo-500/20 text-indigo-400",
  diligence: "bg-yellow-500/20 text-yellow-400",
  ic_review: "bg-orange-500/20 text-orange-400",
  soft_circle: "bg-purple-500/20 text-purple-400",
  committed: "bg-green-500/20 text-green-400",
  declined: "bg-red-500/20 text-red-400",
  deferred: "bg-gray-500/20 text-gray-400",
};

export default function LPTwinPipeline() {
  const [, navigate] = useLocation();
  const [filterFundId, setFilterFundId] = useState<string>("");
  const [filterStage, setFilterStage] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFundId, setNewFundId] = useState<string>("");
  const [newSegmentId, setNewSegmentId] = useState<string>("");

  const { data: fundsData } = trpc.lpTwin.listFunds.useQuery({ includeArchived: false });
  const { data: agentsData } = trpc.lpTwinMeeting.listAgentBank.useQuery({});
  const { data: pipelineData, refetch } = trpc.lpTwinMeeting.listPipeline.useQuery({
    fundId: filterFundId ? parseInt(filterFundId) : undefined,
    stage: filterStage || undefined,
  });

  const createEntry = trpc.lpTwinMeeting.createPipelineEntry.useMutation({
    onSuccess: () => { toast.success("Added to pipeline"); setShowAddForm(false); setNewLabel(""); refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const updateEntry = trpc.lpTwinMeeting.updatePipelineEntry.useMutation({
    onSuccess: () => { toast.success("Updated"); refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const deleteEntry = trpc.lpTwinMeeting.deletePipelineEntry.useMutation({
    onSuccess: () => { toast.success("Removed from pipeline"); refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const funds = fundsData?.funds ?? [];
  const agents = agentsData?.agents ?? [];
  const entries = pipelineData?.entries ?? [];

  // Stage summary
  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s] = entries.filter((e) => e.stage === s).length;
    return acc;
  }, {} as Record<string, number>);

  const handleAdd = () => {
    if (!newLabel || !newFundId || !newSegmentId) { toast.error("Label, fund, and segment are required"); return; }
    createEntry.mutate({ fundId: parseInt(newFundId), segmentId: newSegmentId, investorLabel: newLabel });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/captwin/lp-twin">
              <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="w-4 h-4" />Back to LP Twin</Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Fundraising Pipeline</h1>
              <p className="text-sm text-muted-foreground">Track investor relationships from target to commitment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stage Summary */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {["target", "contacted", "diligence", "soft_circle", "committed"].map((s) => (
            <div key={s} className={`p-3 rounded-lg ${STAGE_COLORS[s] ?? ""}`}>
              <div className="text-2xl font-bold">{stageCounts[s] ?? 0}</div>
              <div className="text-xs mt-0.5 capitalize">{s.replace(/_/g, " ")}</div>
            </div>
          ))}
        </div>

        {/* Filters + Add */}
        <div className="flex items-center gap-3 mb-4">
          <Select value={filterFundId} onValueChange={setFilterFundId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All funds" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All funds</SelectItem>
              {funds.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.fundName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All stages" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All stages</SelectItem>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2"><Plus className="w-4 h-4" />Add Investor</Button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Investor Label</label>
                  <Input placeholder="e.g. Nordic Pension Fund A" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                </div>
                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">Fund</label>
                  <Select value={newFundId} onValueChange={setNewFundId}>
                    <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                    <SelectContent>{funds.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.fundName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">LP Segment</label>
                  <Select value={newSegmentId} onValueChange={setNewSegmentId}>
                    <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                    <SelectContent>{agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={createEntry.isPending}>Add</Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pipeline Table */}
        {entries.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No investors in the pipeline yet.</p>
            <p className="text-sm mt-1">Add investors from your LP targeting results to begin tracking.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{entry.investorLabel}</span>
                    <Badge variant="outline" className={`text-xs ${STAGE_COLORS[entry.stage] ?? ""}`}>{entry.stage.replace(/_/g, " ")}</Badge>
                    {entry.fitScore && <span className="text-xs text-muted-foreground">Fit: {entry.fitScore}/100</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{agents.find((a) => a.id === entry.segmentId)?.name ?? entry.segmentId}</span>
                    {entry.nextAction && <span>→ {entry.nextAction.slice(0, 60)}{entry.nextAction.length > 60 ? "..." : ""}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={entry.stage}
                    onValueChange={(v) => updateEntry.mutate({ entryId: entry.id, stage: v as "target" })}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => deleteEntry.mutate({ entryId: entry.id })} className="text-muted-foreground hover:text-red-400 h-8 px-2">×</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
