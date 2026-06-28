import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Zap,
  FileText,
  User,
  Building2,
  Globe,
  Shield,
} from "lucide-react";

function ValidationRow({
  gate,
  passed,
  value,
  blockReason,
}: {
  gate: string;
  passed: boolean;
  value: string;
  blockReason?: string | null;
}) {
  return (
    <div
      className={`flex items-start justify-between px-3 py-2 rounded text-xs ${
        passed ? "bg-emerald-500/5 border border-emerald-700/30" : "bg-red-500/5 border border-red-700/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        )}
        <span className={passed ? "text-slate-300" : "text-red-300"}>{gate}</span>
        {blockReason && (
          <span className="text-red-400 italic ml-1">— {blockReason}</span>
        )}
      </div>
      <span className="font-mono text-slate-400 ml-4">{value}</span>
    </div>
  );
}

export default function ArosDispatchPreview() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const queueId = parseInt(params.get("id") ?? "0", 10);

  const [editMode, setEditMode] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data, isLoading, refetch } = trpc.arosExecutiveIntelligenceFactory.dispatchPreview.useQuery(
    { queueId },
    { enabled: queueId > 0 }
  );

  const approveMutation = trpc.arosExecutiveIntelligenceFactory.approve.useMutation({
    onSuccess: () => { toast.success("Brief approved for dispatch"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.arosExecutiveIntelligenceFactory.reject.useMutation({
    onSuccess: () => { toast.success("Brief rejected"); refetch(); setShowRejectInput(false); },
    onError: (e) => toast.error(e.message),
  });

  const sendMutation = trpc.arosExecutiveIntelligenceFactory.markSent.useMutation({
    onSuccess: () => { toast.success("Brief dispatched immediately"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const generateMutation = trpc.arosExecutiveIntelligenceFactory.generate.useMutation({
    onSuccess: () => { toast.success("New brief generated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (!queueId) {
    return (
      <div className="p-6 text-slate-400">
        No queue item selected. Navigate from Tomorrow's Dispatch.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-slate-400">Loading dispatch preview…</div>;
  }

  if (!data) {
    return <div className="p-6 text-slate-400">Queue item not found.</div>;
  }

  const { preview, validationGates, allValidationsPassed, blockReasons } = data;
  const item = data.queueItem;
  const company = data.company;

  const passCount = validationGates.filter((g) => g.passed).length;

  const isSent = !!item.sentAt;
  const isApproved = item.approvalStatus === "APPROVED";
  const isRejected = item.approvalStatus === "REJECTED";

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">
            Dispatch Preview — {preview.company}
          </h1>
          <p className="text-slate-400 text-sm">
            {preview.sector} · {preview.country} · Queue:{" "}
            <span
              className={
                preview.queue === "IMMEDIATE"
                  ? "text-emerald-400"
                  : preview.queue === "WATCH"
                  ? "text-amber-400"
                  : "text-slate-400"
              }
            >
              {preview.queue}
            </span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:text-white"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Status banner */}
      {isSent && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-700/40 text-emerald-300 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Dispatched on {new Date(item.sentAt!).toUTCString()}
          {item.openedAt && (
            <span className="ml-4 text-sky-300">
              · Opened {new Date(item.openedAt).toUTCString()}
            </span>
          )}
          {item.repliedAt && (
            <span className="ml-4 text-violet-300">
              · Replied {new Date(item.repliedAt).toUTCString()}
            </span>
          )}
        </div>
      )}

      {isRejected && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-700/40 text-red-300 text-sm">
          <XCircle className="w-4 h-4" />
          Rejected{item.rejectionReason ? `: ${item.rejectionReason}` : ""}
        </div>
      )}

      {!allValidationsPassed && !isSent && !isRejected && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-700/40 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Validation incomplete — {passCount}/9 gates passed.</span>
            {blockReasons.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-amber-400">
                {blockReasons.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 15-field payload */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recipient */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Recipient
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Executive</p>
                  <p className="text-white font-medium">{preview.executive ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Title</p>
                  <p className="text-white">{preview.executiveTitle ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sky-300 font-mono text-xs">{preview.recipientEmail ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Estimated ACV</p>
                  <p className="text-white">
                    {preview.estimatedAcv
                      ? `$${Number(preview.estimatedAcv).toLocaleString()}`
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scores */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-slate-400" />
                Significance Scores
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-900/60">
                  <p className="text-xs text-slate-500 mb-1">SSS</p>
                  <p
                    className={`text-2xl font-bold font-mono ${
                      (preview.sss ?? 0) >= 90 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {preview.sss ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">/ 100</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60">
                  <p className="text-xs text-slate-500 mb-1">ESI</p>
                  <p
                    className={`text-2xl font-bold font-mono ${
                      (preview.esi ?? 0) >= 85 ? "text-violet-400" : "text-amber-400"
                    }`}
                  >
                    {preview.esi ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">/ 100</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60">
                  <p className="text-xs text-slate-500 mb-1">Decision Level</p>
                  <p className="text-sm font-bold text-white">
                    {preview.decisionLevel ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brief content */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2 justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Intelligence Note
                </span>
                {!isSent && !isRejected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-400 hover:text-white"
                    onClick={() => {
                      setEditMode(!editMode);
                      if (!editMode) {
                        setEditedSubject(item.emailSubject ?? "");
                        setEditedBody(item.emailBody ?? "");
                      }
                    }}
                  >
                    {editMode ? "Cancel Edit" : "Edit"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Subject Line</p>
                {editMode ? (
                  <Textarea
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white text-sm resize-none"
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-white font-medium">
                    {item.emailSubject ?? "—"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Note Body</p>
                {editMode ? (
                  <Textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white text-sm resize-none"
                    rows={10}
                  />
                ) : (
                  <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/40 rounded p-3 border border-slate-700">
                    {item.emailBody ?? "—"}
                  </div>
                )}
              </div>
              {item.executiveBrief && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Executive Brief (50 words)</p>
                  <p className="text-xs text-slate-400 italic border-l-2 border-slate-600 pl-3">
                    {item.executiveBrief}
                  </p>
                </div>
              )}
              {item.sdrTeaser && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">LinkedIn Intelligence Message</p>
                  <p className="text-xs text-slate-400 italic border-l-2 border-violet-600 pl-3">
                    {item.sdrTeaser}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Traceability */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" />
                Traceability
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Constitution Version</p>
                  <p className="text-white font-mono">{preview.constitutionVersion ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Decision Twin Version</p>
                  <p className="text-white font-mono">{preview.decisionTwinVersion ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Approval Status</p>
                  <p className="text-white">{preview.approvalStatus}</p>
                </div>
                <div>
                  <p className="text-slate-500">Queue</p>
                  <p className="text-white">{preview.queue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: 9-point validation + actions */}
        <div className="space-y-4">
          {/* Validation */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-400" />
                9-Point Validation
                <span
                  className={`ml-auto text-xs font-mono ${
                    allValidationsPassed ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {passCount}/9
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-1.5">
              {validationGates.map((gate) => (
                <ValidationRow
                  key={gate.gate}
                  gate={gate.gate}
                  passed={gate.passed}
                  value={gate.value}
                  blockReason={gate.blockReason}
                />
              ))}
            </CardContent>
          </Card>

          {/* Action controls */}
          {!isSent && !isRejected && (
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm text-slate-300">Actions</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-2">
                {/* Regenerate */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-slate-600 text-slate-300 hover:text-white justify-start"
                  onClick={() =>
                generateMutation.mutate({
                      companyId: item.companyId!,
                      targetEmail: item.targetEmail ?? "",
                    })
                  }
                  disabled={generateMutation.isPending}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  Regenerate Brief
                </Button>

                {/* Approve */}
                {!isApproved && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-emerald-700/50 text-emerald-300 hover:bg-emerald-500/10 justify-start"
                onClick={() => approveMutation.mutate({ outreachId: item.id })}
                    disabled={approveMutation.isPending}
                  >
                    <ThumbsUp className="w-3.5 h-3.5 mr-2" />
                    Approve for Dispatch
                  </Button>
                )}

                {/* Send immediately */}
                <Button
                  size="sm"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white justify-start"
              onClick={() => sendMutation.mutate({ outreachId: item.id })}
                  disabled={sendMutation.isPending || !allValidationsPassed}
                >
                  <Send className="w-3.5 h-3.5 mr-2" />
                  {sendMutation.isPending ? "Dispatching…" : "Send Immediately"}
                </Button>
                {!allValidationsPassed && (
                  <p className="text-xs text-amber-400 text-center">
                    Resolve {9 - passCount} validation issue{9 - passCount !== 1 ? "s" : ""} to enable send
                  </p>
                )}

                {/* Reject */}
                {!showRejectInput ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 justify-start"
                    onClick={() => setShowRejectInput(true)}
                  >
                    <ThumbsDown className="w-3.5 h-3.5 mr-2" />
                    Reject
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Reason for rejection…"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white text-xs resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 text-xs"
                        onClick={() =>
                  rejectMutation.mutate({ outreachId: item.id, reason: rejectionReason })
                        }
                        disabled={rejectMutation.isPending}
                      >
                        Confirm Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-400"
                        onClick={() => setShowRejectInput(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Company context */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                Company Context
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2 text-xs">
              <div>
                <p className="text-slate-500">Sector</p>
                <p className="text-white">{company.sector ?? "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Country</p>
                <p className="text-white">{company.country ?? "—"}</p>
              </div>
              {company.keyDecisionDomain && (
                <div>
                  <p className="text-slate-500">Key Decision Domain</p>
                  <p className="text-white">{company.keyDecisionDomain}</p>
                </div>
              )}
              {company.activeStrategicInitiative && (
                <div>
                  <p className="text-slate-500">Active Strategic Initiative</p>
                  <p className="text-white">{company.activeStrategicInitiative}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
