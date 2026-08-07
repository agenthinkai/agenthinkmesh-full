import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, GitCompare, Shield } from "lucide-react";
import { Link } from "wouter";

const STAGES = ["target", "contacted", "first_meeting", "follow_up", "diligence", "ic_review", "soft_circle", "committed", "declined", "deferred"];
const INTEREST_LEVELS = ["strong", "moderate", "low", "none", "unknown"];
const RESPONSE_TYPES = ["question", "objection", "evidence_request", "term_challenge", "positive_signal"];

export default function LPTwinActualMeeting() {
  const params = useParams<{ meetingId: string }>();
  const meetingId = parseInt(params.meetingId ?? "0");
  const [, navigate] = useLocation();

  const [newResponseType, setNewResponseType] = useState("objection");
  const [newResponseContent, setNewResponseContent] = useState("");
  const [newResponseCategory, setNewResponseCategory] = useState("");
  const [showCompare, setShowCompare] = useState(false);

  const { data: meetingData, refetch } = trpc.lpTwinMeeting.getMeeting.useQuery({ meetingId }, { enabled: !!meetingId });
  const { data: agentsData } = trpc.lpTwinMeeting.listAgentBank.useQuery({});

  const updateMeeting = trpc.lpTwinMeeting.updateMeeting.useMutation({
    onSuccess: () => { toast.success("Meeting updated"); refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const addResponse = trpc.lpTwinMeeting.addMeetingResponse.useMutation({
    onSuccess: () => { toast.success("Response recorded"); setNewResponseContent(""); refetch(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const compareWithSim = trpc.lpTwinMeeting.compareWithSimulation.useMutation({
    onSuccess: (data) => {
      toast.success(`Comparison complete — Objections: ${data.objectionsAgreement}`);
      setShowCompare(true);
    },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const meeting = meetingData?.meeting;
  const responses = meetingData?.responses ?? [];
  const agents = agentsData?.agents ?? [];

  if (!meetingId) return <div className="p-8 text-muted-foreground">Invalid meeting ID.</div>;
  if (!meeting) return <div className="p-8 text-muted-foreground">Loading meeting...</div>;

  const segmentName = agents.find((a) => a.id === meeting.segmentId)?.name ?? meeting.segmentId;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate(-1 as unknown as string)}>
              <ArrowLeft className="w-4 h-4" />Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Actual Meeting Record</h1>
              <p className="text-sm text-muted-foreground">{segmentName} — {new Date(meeting.meetingDate).toLocaleDateString()}</p>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Institution name: {meeting.institutionNameVisible}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* Meeting Status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Meeting Status</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Stage</label>
                <Select
                  value={meeting.stage}
                  onValueChange={(v) => updateMeeting.mutate({ meetingId, stage: v as "target" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Interest Level</label>
                <Select
                  value={meeting.interestLevel}
                  onValueChange={(v) => updateMeeting.mutate({ meetingId, interestLevel: v as "strong" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INTEREST_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Soft Circle</label>
                <Select
                  value={meeting.softCircleStatus}
                  onValueChange={(v) => updateMeeting.mutate({ meetingId, softCircleStatus: v as "none" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["none", "verbal", "written", "confirmed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-sm font-medium mb-1.5 block">Next Action</label>
              <Textarea
                defaultValue={meeting.nextAction ?? ""}
                onBlur={(e) => updateMeeting.mutate({ meetingId, nextAction: e.target.value })}
                rows={2}
                placeholder="What needs to happen next?"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actual Responses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Actual Questions, Objections & Evidence Requests ({responses.length})
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {meeting.verificationStatus}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {responses.map((r) => (
              <div key={r.id} className="p-3 rounded-md border border-border/50 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">{r.responseType.replace(/_/g, " ")}</Badge>
                  {r.category && <span className="text-muted-foreground">{r.category}</span>}
                  <Badge variant="outline" className={`text-xs ${r.severity === "critical" ? "text-red-400 border-red-500/30" : r.severity === "high" ? "text-orange-400 border-orange-500/30" : "text-muted-foreground"}`}>{r.severity}</Badge>
                </div>
                <p>{r.content}</p>
                {r.gpResponse && <p className="text-muted-foreground mt-1 italic">GP: {r.gpResponse}</p>}
              </div>
            ))}

            {/* Add Response */}
            <div className="border-t border-border/50 pt-3 space-y-2">
              <div className="flex gap-2">
                <Select value={newResponseType} onValueChange={setNewResponseType}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESPONSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Category (optional)" value={newResponseCategory} onChange={(e) => setNewResponseCategory(e.target.value)} className="w-40" />
              </div>
              <Textarea
                placeholder="What was actually said or asked in the meeting..."
                value={newResponseContent}
                onChange={(e) => setNewResponseContent(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newResponseContent) { toast.error("Enter the response content"); return; }
                  addResponse.mutate({ meetingId, responseType: newResponseType as "objection", content: newResponseContent, category: newResponseCategory || undefined });
                }}
                disabled={addResponse.isPending}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />Record Response
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Compare with Simulation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Compare with Simulation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Compare what actually happened in this meeting against the synthetic simulation predictions.
              Agreement labels (Agreement / Partial Agreement / Disagreement / Insufficient Evidence) are preliminary comparisons — not accuracy metrics.
            </p>
            <Button
              variant="outline"
              onClick={() => compareWithSim.mutate({ meetingId, sessionId: meeting.sessionId ?? undefined })}
              disabled={compareWithSim.isPending}
              className="gap-2"
            >
              <GitCompare className="w-4 h-4" />
              {compareWithSim.isPending ? "Comparing..." : "Run Comparison"}
            </Button>

            {compareWithSim.data && (
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-md border border-border">
                  <p className="text-muted-foreground mb-1">Objections</p>
                  <p className="font-medium">{compareWithSim.data.objectionsAgreement.replace(/_/g, " ")}</p>
                </div>
                <div className="p-3 rounded-md border border-border">
                  <p className="text-muted-foreground mb-1">Questions</p>
                  <p className="font-medium">{compareWithSim.data.questionsAgreement.replace(/_/g, " ")}</p>
                </div>
                <div className="p-3 rounded-md border border-border">
                  <p className="text-muted-foreground mb-1">Progression</p>
                  <p className="font-medium">{compareWithSim.data.progressionAgreement.replace(/_/g, " ")}</p>
                </div>
                <div className="col-span-3">
                  <p className="text-xs text-muted-foreground italic">{compareWithSim.data.disclaimer}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

