import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Brain, Users, MessageSquare, Calendar, TrendingUp,
  Building2, ChevronRight, Clock, Star, Target,
} from "lucide-react";

function RelationshipBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Champion</Badge>;
  if (score >= 60) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Engaged</Badge>;
  if (score >= 40) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Warm</Badge>;
  if (score >= 20) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Cold</Badge>;
  return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">New</Badge>;
}

function ScoreBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  const pct = Math.min(100, Math.round(value));
  return (
    <div className="w-full bg-slate-700/50 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ArosExecutiveMemory() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: stats } = trpc.arosExecutiveMemory.getSummaryStats.useQuery();
  const { data: listData, isLoading } = trpc.arosExecutiveMemory.list.useQuery({ limit: 100, offset: 0 });
  const { data: timelineData } = trpc.arosExecutiveMemory.getTimeline.useQuery(
    { executiveMemoryId: selectedId!, limit: 20 },
    { enabled: selectedId !== null }
  );

  const selected = listData?.rows.find(r => r.id === selectedId) ?? null;
  const selectedCompanyId = selected?.companyId ?? 0;

  const { data: orgData } = trpc.arosExecutiveMemory.getOrgProfile.useQuery(
    { companyId: selectedCompanyId },
    { enabled: selectedId !== null && selectedCompanyId > 0 }
  );

  const executives = (listData?.rows ?? []).filter(r =>
    search === "" ||
    r.executiveName.toLowerCase().includes(search.toLowerCase()) ||
    r.companyName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-7 h-7 text-violet-400" />
            Executive Memory
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Permanent relationship intelligence — every executive Atlas has ever contacted
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Executives", value: stats?.totalExecutives ?? 0, icon: Users, color: "text-violet-400" },
          { label: "Briefs Delivered", value: stats?.totalBriefs ?? 0, icon: MessageSquare, color: "text-blue-400" },
          { label: "Replies", value: stats?.totalReplies ?? 0, icon: MessageSquare, color: "text-emerald-400" },
          { label: "Meetings", value: stats?.totalMeetings ?? 0, icon: Calendar, color: "text-amber-400" },
          { label: "Proposals", value: stats?.totalProposals ?? 0, icon: Target, color: "text-orange-400" },
          { label: "Customers", value: stats?.totalCustomers ?? 0, icon: Star, color: "text-yellow-400" },
          { label: "Avg Rel Score", value: `${stats?.avgRelationshipScore ?? 0}/100`, icon: TrendingUp, color: "text-pink-400" },
          { label: "Timeline Events", value: stats?.totalTimelineEvents ?? 0, icon: Clock, color: "text-cyan-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-slate-400 text-xs">{label}</span>
              </div>
              <div className="text-lg font-bold text-white">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Executive List */}
        <div className="lg:col-span-1 space-y-3">
          <Input
            placeholder="Search executives or companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
          />
          {isLoading ? (
            <div className="text-slate-400 text-sm text-center py-8">Loading...</div>
          ) : executives.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-6 text-center text-slate-400 text-sm">
                No executive memory records yet. Records are created automatically after the first brief is delivered.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {executives.map(exec => (
                <Card
                  key={exec.id}
                  className={`bg-slate-900 border-slate-800 cursor-pointer transition-all hover:border-violet-500/50 ${selectedId === exec.id ? "border-violet-500 bg-violet-950/20" : ""}`}
                  onClick={() => setSelectedId(exec.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-white text-sm truncate">{exec.executiveName}</div>
                        <div className="text-slate-400 text-xs truncate">{exec.companyName}</div>
                        {exec.role && <div className="text-slate-500 text-xs truncate">{exec.role}</div>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <RelationshipBadge score={exec.relationshipScore ?? 0} />
                        <span className="text-slate-400 text-xs">{exec.relationshipScore ?? 0}/100</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <ScoreBar value={exec.relationshipScore ?? 0} color="bg-violet-500" />
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-slate-500">
                      <span>{exec.totalBriefsDelivered ?? 0} briefs</span>
                      <span>{exec.totalReplies ?? 0} replies</span>
                      <span>{exec.meetings ?? 0} meetings</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-12 text-center">
                <Brain className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Select an executive to view their full memory profile</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-lg">{selected.executiveName}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-400 text-sm">{selected.companyName}</span>
                        {selected.role && <span className="text-slate-500 text-xs">· {selected.role}</span>}
                      </div>
                    </div>
                    <RelationshipBadge score={selected.relationshipScore ?? 0} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Briefs", value: selected.totalBriefsDelivered ?? 0, color: "text-blue-400" },
                      { label: "Replies", value: selected.totalReplies ?? 0, color: "text-emerald-400" },
                      { label: "Meetings", value: selected.meetings ?? 0, color: "text-amber-400" },
                      { label: "Proposals", value: selected.proposals ?? 0, color: "text-orange-400" },
                      { label: "Customers", value: selected.customers ?? 0, color: "text-yellow-400" },
                      { label: "Rel Score", value: `${selected.relationshipScore ?? 0}/100`, color: "text-violet-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-slate-800/50 rounded-lg p-2.5 text-center">
                        <div className={`text-xl font-bold ${color}`}>{value}</div>
                        <div className="text-slate-400 text-xs">{label}</div>
                      </div>
                    ))}
                  </div>
                  <Separator className="bg-slate-800" />
                  {selected.interests && (
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-1">Interests</div>
                      <p className="text-slate-300 text-sm">{selected.interests}</p>
                    </div>
                  )}
                  {selected.objections && (
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-1">Known Objections</div>
                      <p className="text-slate-300 text-sm">{selected.objections}</p>
                    </div>
                  )}
                  {selected.preferredTopics && (
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-1">Preferred Topics</div>
                      <p className="text-slate-300 text-sm">{selected.preferredTopics}</p>
                    </div>
                  )}
                  {selected.responsePattern && (
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-1">Response Pattern</div>
                      <p className="text-slate-300 text-sm">{selected.responsePattern}</p>
                    </div>
                  )}
                  {selected.nextRecommendedAction && (
                    <div className="bg-violet-950/30 border border-violet-500/30 rounded-lg p-3">
                      <div className="text-violet-400 text-xs font-medium mb-1 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" /> Next Recommended Action
                      </div>
                      <p className="text-slate-300 text-sm">{selected.nextRecommendedAction}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conversation Timeline */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Conversation Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!timelineData || (timelineData as unknown[]).length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">No timeline events yet</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {(timelineData as Array<{id:number;eventType:string;eventDate:number;summary:string|null;sss:number|null;esi:number|null}>).map(event => (
                        <div key={event.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                            <div className="w-px flex-1 bg-slate-700 mt-1" />
                          </div>
                          <div className="pb-3 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                                {event.eventType}
                              </Badge>
                              <span className="text-slate-500 text-xs">
                                {new Date(event.eventDate).toLocaleDateString()}
                              </span>
                            </div>
                            {event.summary && <p className="text-slate-300 text-sm">{event.summary}</p>}
                            {event.sss != null && (
                              <span className="text-slate-500 text-xs">SSS {event.sss} · ESI {event.esi}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Org Intelligence */}
  {orgData && (() => {
                    const org = orgData.orgIntelligence;
                    return (
                      <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-white text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-amber-400" />
                            Organisational Intelligence — {org.companyName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {org.aiInitiatives && (
                            <div>
                              <div className="text-slate-400 text-xs font-medium mb-1">AI Initiatives</div>
                              <p className="text-slate-300 text-sm">{org.aiInitiatives}</p>
                            </div>
                          )}
                          {org.capitalAllocationDecisions && (
                            <div>
                              <div className="text-slate-400 text-xs font-medium mb-1">Capital Allocation</div>
                              <p className="text-slate-300 text-sm">{org.capitalAllocationDecisions}</p>
                            </div>
                          )}
                          {org.previousAtlasObservations && (
                            <div>
                              <div className="text-slate-400 text-xs font-medium mb-1">Previous Atlas Observations</div>
                              <p className="text-slate-300 text-sm whitespace-pre-line text-xs">{org.previousAtlasObservations}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
