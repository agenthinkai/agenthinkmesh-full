/**
 * ArosEditor.tsx — Pre-Dispatch Editor Mode
 *
 * The CEO reviews, edits, regenerates, and approves Executive Intelligence Briefs
 * for the top 25 companies continuously — before dispatch day.
 *
 * Writing happens continuously. Dispatch day is execution only.
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  Edit3,
  Save,
  GitCompare,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCheck,
  Send,
  Eye,
  ChevronRight,
  Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type EditorStatus = "DRAFT" | "READY" | "APPROVED" | "SCHEDULED" | "SENT" | "NO_DRAFT";

interface CompanyRow {
  rank: number;
  companyId: number;
  companyName: string;
  sector: string;
  country: string;
  executiveName: string;
  executiveEmail: string;
  sss: number;
  esi: number;
  keyDecisionDomain: string | null;
  qualityGatePassed: boolean;
  tripleGateSss: boolean;
  tripleGateEsi: boolean;
  tripleGateConf: boolean;
  tripleGatePasses: boolean;
  draftId: number | null;
  editorStatus: EditorStatus;
  draftVersion: number;
  strategicDecision: string;
  hiddenVariable: string;
  evidenceConfidence: number;
  briefContent: string | null;
  approvedAt: number | null;
  promotedAt: number | null;
  updatedAt: number | null;
}

// ── Status helpers ────────────────────────────────────────────────────────────
function statusColor(status: EditorStatus): string {
  switch (status) {
    case "DRAFT": return "bg-zinc-700 text-zinc-200";
    case "READY": return "bg-blue-900 text-blue-200";
    case "APPROVED": return "bg-green-900 text-green-200";
    case "SCHEDULED": return "bg-amber-900 text-amber-200";
    case "SENT": return "bg-emerald-900 text-emerald-200";
    default: return "bg-zinc-800 text-zinc-400";
  }
}

function statusIcon(status: EditorStatus) {
  switch (status) {
    case "DRAFT": return <FileText className="w-3 h-3" />;
    case "READY": return <Eye className="w-3 h-3" />;
    case "APPROVED": return <CheckCircle2 className="w-3 h-3" />;
    case "SCHEDULED": return <Clock className="w-3 h-3" />;
    case "SENT": return <Send className="w-3 h-3" />;
    default: return <AlertTriangle className="w-3 h-3" />;
  }
}

function ScoreBadge({ value, threshold, label }: { value: number; threshold: number; label: string }) {
  const passes = value >= threshold;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold ${passes ? "bg-green-900/60 text-green-300" : "bg-zinc-800 text-zinc-400"}`}>
      {passes ? <CheckCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {label} {value}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ArosEditor() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareVersionIds, setCompareVersionIds] = useState<[number, number] | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: top25, isLoading: loadingTop25, refetch: refetchTop25 } = trpc.arosEditorBriefs.getTop25.useQuery(
    undefined,
    { refetchInterval: 60_000 }
  );

  const { data: briefData, isLoading: loadingBrief, refetch: refetchBrief } = trpc.arosEditorBriefs.getBrief.useQuery(
    { companyId: selectedCompanyId! },
    { enabled: selectedCompanyId !== null }
  );

  const { data: compareData } = trpc.arosEditorBriefs.compareVersions.useQuery(
    { versionIdA: compareVersionIds?.[0]!, versionIdB: compareVersionIds?.[1]! },
    { enabled: compareVersionIds !== null }
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const generateDraft = trpc.arosEditorBriefs.generateDraft.useMutation({
    onSuccess: () => {
      toast.success("New draft generated");
      refetchTop25();
      refetchBrief();
      setIsEditing(false);
    },
    onError: (err) => toast.error(`Generation failed: ${err.message}`),
  });

  const saveEdit = trpc.arosEditorBriefs.saveEdit.useMutation({
    onSuccess: () => {
      toast.success("Draft saved");
      setIsEditing(false);
      refetchTop25();
      refetchBrief();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const approve = trpc.arosEditorBriefs.approve.useMutation({
    onSuccess: (result) => {
      if (result.autoPromoted) {
        toast.success("Brief approved and auto-promoted to SCHEDULED queue — Triple Gate passed");
      } else {
        toast.success("Brief approved — will be promoted when Triple Gate passes");
      }
      refetchTop25();
      refetchBrief();
    },
    onError: (err) => toast.error(`Approval failed: ${err.message}`),
  });

  // ── Derived state ─────────────────────────────────────────────────────────
  const selectedCompany = top25?.find((c) => c.companyId === selectedCompanyId);
  const latestDraft = briefData?.latestDraft;

  // Sync edit content when brief loads
  useEffect(() => {
    if (latestDraft?.briefContent && !isEditing) {
      setEditContent(latestDraft.briefContent);
    }
  }, [latestDraft, isEditing]);

  const handleSelectCompany = useCallback((companyId: number) => {
    setSelectedCompanyId(companyId);
    setIsEditing(false);
  }, []);

  const handleEdit = () => {
    setEditContent(latestDraft?.briefContent ?? "");
    setIsEditing(true);
  };

  const handleSave = (status: "DRAFT" | "READY" = "DRAFT") => {
    if (!latestDraft) return;
    saveEdit.mutate({
      draftId: latestDraft.id,
      briefContent: editContent,
      editorStatus: status,
    });
  };

  const handleApprove = () => {
    if (!latestDraft) return;
    approve.mutate({ draftId: latestDraft.id });
  };

  const handleRegenerate = () => {
    if (!selectedCompanyId) return;
    generateDraft.mutate({ companyId: selectedCompanyId });
  };

  const handleCompare = () => {
    const versions = briefData?.versions;
    if (!versions || versions.length < 2) {
      toast.info("Need at least two versions to compare");
      return;
    }
    setCompareVersionIds([versions[1].id, versions[0].id]);
    setCompareOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-400" />
              Pre-Dispatch Editor
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Review and approve Executive Intelligence Briefs before dispatch day. Writing happens continuously.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
              <Zap className="w-3 h-3 mr-1 text-amber-400" />
              Auto-promotes on Triple Gate pass
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchTop25()}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Main content: two-panel layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: ranked company list */}
          <div className="w-[380px] flex-shrink-0 border-r border-zinc-800 flex flex-col">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Top 25 Companies</span>
              <span className="text-xs text-zinc-500">Ranked by SSS</span>
            </div>
            <ScrollArea className="flex-1">
              {loadingTop25 ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full bg-zinc-800" />
                  ))}
                </div>
              ) : !top25 || top25.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">
                  No companies scored yet. Run the Daily Cycle to populate the universe.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {top25.map((company) => (
                    <button
                      key={company.companyId}
                      onClick={() => handleSelectCompany(company.companyId)}
                      className={`w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition-colors ${
                        selectedCompanyId === company.companyId ? "bg-zinc-800 border-l-2 border-blue-500" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-zinc-500 w-5 flex-shrink-0">#{company.rank}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate">{company.companyName}</div>
                            <div className="text-xs text-zinc-400 truncate">{company.executiveName} · {company.sector}</div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(company.editorStatus as EditorStatus)}`}>
                            {statusIcon(company.editorStatus as EditorStatus)}
                            {company.editorStatus === "NO_DRAFT" ? "NO DRAFT" : company.editorStatus}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 ml-7">
                        <span className={`text-xs font-mono ${company.tripleGateSss ? "text-green-400" : "text-zinc-500"}`}>
                          SSS {company.sss}
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span className={`text-xs font-mono ${company.tripleGateEsi ? "text-green-400" : "text-zinc-500"}`}>
                          ESI {company.esi}
                        </span>
                        {company.tripleGatePasses && (
                          <span className="text-xs text-green-400 flex items-center gap-0.5">
                            <CheckCheck className="w-3 h-3" /> Gate
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right panel: brief editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedCompanyId ? (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                  <p className="text-sm">Select a company to review its brief</p>
                  <p className="text-xs text-zinc-600 mt-1">Writing happens continuously. Dispatch day is execution only.</p>
                </div>
              </div>
            ) : loadingBrief ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-64 bg-zinc-800" />
                <Skeleton className="h-4 w-96 bg-zinc-800" />
                <Skeleton className="h-48 w-full bg-zinc-800" />
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Company header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex-shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{selectedCompany?.companyName}</h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-zinc-400">{selectedCompany?.executiveName}</span>
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                        <span className="text-sm text-zinc-500">{selectedCompany?.sector} · {selectedCompany?.country}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {latestDraft && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${statusColor((latestDraft.editorStatus ?? "DRAFT") as EditorStatus)}`}>
                            {statusIcon((latestDraft.editorStatus ?? "DRAFT") as EditorStatus)}
                          {latestDraft.editorStatus}
                          {latestDraft.version > 0 && <span className="text-xs opacity-60">v{latestDraft.version}</span>}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score row */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <ScoreBadge value={selectedCompany?.sss ?? 0} threshold={90} label="SSS" />
                    <ScoreBadge value={selectedCompany?.esi ?? 0} threshold={85} label="ESI" />
                    <ScoreBadge value={latestDraft?.evidenceConfidence ?? 0} threshold={80} label="Conf" />
                    {selectedCompany?.tripleGatePasses && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-900 text-green-300">
                        <Zap className="w-3 h-3" /> Triple Gate Passes
                      </span>
                    )}
                  </div>

                  {/* Strategic decision + hidden variable */}
                  {latestDraft && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="bg-zinc-800/50 rounded-md px-3 py-2">
                        <div className="text-xs text-zinc-500 mb-1">Strategic Decision</div>
                        <div className="text-xs text-zinc-300 line-clamp-2">{latestDraft.strategicDecision || selectedCompany?.keyDecisionDomain || "—"}</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md px-3 py-2">
                        <div className="text-xs text-zinc-500 mb-1">Hidden Variable</div>
                        <div className="text-xs text-zinc-300 line-clamp-2">{latestDraft.hiddenVariable || "—"}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action bar */}
                <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {!latestDraft ? (
                    <Button
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={generateDraft.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {generateDraft.isPending ? (
                        <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
                      ) : (
                        <><Zap className="w-3.5 h-3.5 mr-1.5" /> Generate Draft</>
                      )}
                    </Button>
                  ) : (
                    <>
                      {!isEditing ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleEdit}
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleSave("DRAFT")}
                            disabled={saveEdit.isPending}
                            className="bg-zinc-700 hover:bg-zinc-600 text-white"
                          >
                            {saveEdit.isPending ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                            Save Draft
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSave("READY")}
                            disabled={saveEdit.isPending}
                            className="bg-blue-700 hover:bg-blue-600 text-white"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Ready
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsEditing(false)}
                            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRegenerate}
                        disabled={generateDraft.isPending}
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      >
                        {generateDraft.isPending ? (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Regenerate
                      </Button>

                      {(briefData?.versions?.length ?? 0) >= 2 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCompare}
                          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        >
                          <GitCompare className="w-3.5 h-3.5 mr-1.5" /> Compare Versions
                        </Button>
                      )}

                      {(latestDraft.editorStatus as string) !== "APPROVED" &&
                        (latestDraft.editorStatus as string) !== "SCHEDULED" &&
                        (latestDraft.editorStatus as string) !== "SENT" && (
                        <Button
                          size="sm"
                          onClick={handleApprove}
                          disabled={approve.isPending || isEditing}
                          className="bg-green-700 hover:bg-green-600 text-white ml-auto"
                        >
                          {approve.isPending ? (
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Approve
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {/* Brief content area */}
                <div className="flex-1 overflow-hidden flex">
                  {/* Main editor */}
                  <div className="flex-1 overflow-auto p-6">
                    {!latestDraft ? (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                        <FileText className="w-10 h-10 mb-3 text-zinc-700" />
                        <p className="text-sm">No draft yet for this company.</p>
                        <p className="text-xs text-zinc-600 mt-1">Click "Generate Draft" to create the first version.</p>
                      </div>
                    ) : isEditing ? (
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-full min-h-[400px] bg-zinc-900 border-zinc-700 text-zinc-200 font-mono text-sm resize-none focus:ring-blue-500"
                        placeholder="Edit the brief content here…"
                      />
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                          {latestDraft.briefContent ?? "Brief content not yet generated."}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Version history sidebar */}
                  {(briefData?.versions?.length ?? 0) > 0 && (
                    <div className="w-56 border-l border-zinc-800 flex flex-col flex-shrink-0">
                      <div className="px-3 py-2 border-b border-zinc-800">
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Version History</span>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="divide-y divide-zinc-800/60">
                          {briefData?.versions?.map((v) => (
                            <div key={v.id} className="px-3 py-2.5 hover:bg-zinc-800/40 cursor-pointer">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-mono text-zinc-400">v{v.version}</span>
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${statusColor(v.editorStatus as EditorStatus)}`}>
                                  {statusIcon(v.editorStatus as EditorStatus)}
                                  {v.editorStatus}
                                </span>
                              </div>
                              <div className="text-xs text-zinc-500">
                                {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                              <div className="text-xs text-zinc-600 mt-0.5">{v.generatedBy}</div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compare Versions Modal */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-blue-400" />
              Compare Versions
            </DialogTitle>
          </DialogHeader>
          {compareData ? (
            <div className="grid grid-cols-2 gap-4 overflow-auto">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-zinc-400">v{compareData.versionA.version}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${statusColor(compareData.versionA.editorStatus as EditorStatus)}`}>
                    {compareData.versionA.editorStatus}
                  </span>
                  <span className="text-xs text-zinc-500">{new Date(compareData.versionA.createdAt).toLocaleString()}</span>
                </div>
                <ScrollArea className="h-[50vh]">
                  <pre className="whitespace-pre-wrap font-sans text-xs text-zinc-300 leading-relaxed bg-zinc-800/50 rounded p-3 border border-zinc-700">
                    {compareData.versionA.briefContent ?? "No content"}
                  </pre>
                </ScrollArea>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-zinc-400">v{compareData.versionB.version}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${statusColor(compareData.versionB.editorStatus as EditorStatus)}`}>
                    {compareData.versionB.editorStatus}
                  </span>
                  <span className="text-xs text-zinc-500">{new Date(compareData.versionB.createdAt).toLocaleString()}</span>
                </div>
                <ScrollArea className="h-[50vh]">
                  <pre className="whitespace-pre-wrap font-sans text-xs text-zinc-300 leading-relaxed bg-zinc-800/50 rounded p-3 border border-zinc-700">
                    {compareData.versionB.briefContent ?? "No content"}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
              Loading versions…
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
