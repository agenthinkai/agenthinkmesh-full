/**
 * Executive Intelligence Factory — Approval queue for Executive Decision Notes
 * Review, approve, reject, and deliver intelligence notes to executives.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Brain, CheckCircle2, XCircle, Send, Eye, RefreshCw, AlertTriangle, MessageSquare, Calendar, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type NoteStatus = "PENDING_CEO_REVIEW" | "APPROVED" | "REJECTED" | "SENT" | "BOUNCED";

const STATUS_COLORS: Record<NoteStatus, string> = {
  PENDING_CEO_REVIEW: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  SENT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  BOUNCED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABELS: Record<NoteStatus, string> = {
  PENDING_CEO_REVIEW: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SENT: "Delivered",
  BOUNCED: "Bounced",
};

const PRIORITY_COLORS: Record<string, string> = {
  IMMEDIATE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  LOW: "bg-gray-100 text-gray-600",
};

export function ArosOutreach() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewItem, setViewItem] = useState<{
    id: number;
    subject: string;
    body: string;
    brief: string;
    linkedin: string;
    company: string;
    target: string | null;
  } | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, refetch } = trpc.arosOutreachFactory.listQueue.useQuery({
    status: statusFilter !== "all" ? (statusFilter as NoteStatus) : undefined,
    limit: 100,
  });

  const approveMutation = trpc.arosOutreachFactory.approve.useMutation({
    onSuccess: () => { toast.success("Intelligence note approved"); refetch(); },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const rejectMutation = trpc.arosOutreachFactory.reject.useMutation({
    onSuccess: () => { toast.success("Intelligence note rejected"); setRejectId(null); setRejectReason(""); refetch(); },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const markSentMutation = trpc.arosOutreachFactory.markSent.useMutation({
    onSuccess: () => { toast.success("Marked as delivered"); refetch(); },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const [sendDialogItem, setSendDialogItem] = useState<{ id: number; subject: string | null; body: string | null; company: string } | null>(null);
  const [sendToEmail, setSendToEmail] = useState("");
  const [sendToName, setSendToName] = useState("");

  const sendEmailMutation = trpc.arosOutreachFactory.sendEmail.useMutation({
    onSuccess: (data: { resendId?: string }) => {
      toast.success(`Intelligence note delivered. ID: ${data.resendId}`);
      setSendDialogItem(null);
      setSendToEmail("");
      setSendToName("");
      refetch();
    },
    onError: (err: { message: string }) => toast.error(`Delivery failed: ${err.message}`),
  });

  const recordReplyMutation = trpc.arosOutreachFactory.recordReply.useMutation({
    onSuccess: () => { toast.success("Executive reply recorded — pipeline advanced"); refetch(); },
    onError: (err: { message: string }) => toast.error(`Error: ${err.message}`),
  });

  const { data: statsData } = trpc.arosOutreachFactory.getQueueStats.useQuery();
  const rows = data?.rows ?? [];
  const pending = rows.filter(r => r.outreach.approvalStatus === "PENDING_CEO_REVIEW").length;
  const deliveredCount = statsData?.find(s => s.status === "SENT")?.count ?? 0;
  const repliedCount = rows.filter(r => r.outreach.repliedAt).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Executive Intelligence Factory</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {pending > 0 ? (
                <span className="text-yellow-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {pending} intelligence notes pending review
                </span>
              ) : "All intelligence notes reviewed"}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING_CEO_REVIEW">Pending Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="SENT">Delivered</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Milestone Tracker */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "FIRST_EXECUTIVE_REPLY", achieved: repliedCount > 0, icon: <MessageSquare className="h-4 w-4" /> },
            { label: "FIRST_MEETING", achieved: false, icon: <Calendar className="h-4 w-4" /> },
            { label: "FIRST_PROPOSAL", achieved: false, icon: <TrendingUp className="h-4 w-4" /> },
            { label: "FIRST_CUSTOMER", achieved: false, icon: <DollarSign className="h-4 w-4" /> },
          ].map((m) => (
            <Card key={m.label} className={`border ${m.achieved ? "border-green-400 bg-green-50 dark:bg-green-950/20" : "border-border"}`}>
              <CardContent className="p-3">
                <div className={`flex items-center gap-2 mb-1 text-xs font-mono ${m.achieved ? "text-green-600" : "text-muted-foreground"}`}>
                  {m.icon}{m.label}
                </div>
                <div className={`text-sm font-semibold ${m.achieved ? "text-green-700" : "text-foreground"}`}>
                  {m.achieved ? "✓ ACHIEVED" : "Pending"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: "Total Notes", value: data?.total ?? 0 },
            { label: "Pending Review", value: pending },
            { label: "Approved", value: statsData?.find(s => s.status === "APPROVED")?.count ?? 0 },
            { label: "Delivered", value: deliveredCount },
            { label: "Executive Replies", value: repliedCount },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-xl font-bold mt-1">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Queue */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading intelligence queue...</div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No intelligence notes in queue. Generate from the Top 20 Opportunities page.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map(({ outreach, company }) => (
              <Card key={outreach.id} className="overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {/* Priority */}
                  <div className="shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[outreach.priority ?? "MEDIUM"] ?? ""}`}>
                      {outreach.priority}
                    </span>
                  </div>

                  {/* Company + Subject */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{company.companyName}</p>
                    <p className="text-xs text-muted-foreground">{company.sector} · {company.country}</p>
                    <p className="text-xs mt-0.5 text-muted-foreground truncate">
                      Note: {outreach.emailSubject}
                    </p>
                    {outreach.targetName && (
                      <p className="text-xs text-muted-foreground">To: {outreach.targetName} ({outreach.targetTitle})</p>
                    )}
                  </div>

                  {/* ACV */}
                  {outreach.estimatedDealSizeUsd && (
                    <div className="text-center shrink-0">
                      <p className="text-xs text-muted-foreground">ACV</p>
                      <p className="text-sm font-bold text-green-600">${(outreach.estimatedDealSizeUsd / 1000).toFixed(0)}K</p>
                    </div>
                  )}

                  {/* Status */}
                  <div className="shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[outreach.approvalStatus as NoteStatus] ?? ""}`}>
                      {STATUS_LABELS[outreach.approvalStatus as NoteStatus] ?? outreach.approvalStatus?.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="View intelligence note"
                      onClick={() => setViewItem({
                        id: outreach.id,
                        subject: outreach.emailSubject ?? "",
                        body: outreach.emailBody ?? "",
                        brief: outreach.executiveBrief ?? "",
                        linkedin: outreach.sdrTeaser ?? "",
                        company: company.companyName,
                        target: outreach.targetName,
                      })}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {outreach.approvalStatus === "PENDING_CEO_REVIEW" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          title="Approve"
                          onClick={() => approveMutation.mutate({ outreachId: outreach.id })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          title="Reject"
                          onClick={() => setRejectId(outreach.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {outreach.approvalStatus === "APPROVED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                        title="Deliver intelligence note"
                        onClick={() => {
                          setSendDialogItem({ id: outreach.id, subject: outreach.emailSubject, body: outreach.emailBody, company: company.companyName });
                          setSendToEmail(outreach.targetEmail ?? "");
                          setSendToName(outreach.targetName ?? "");
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    {outreach.approvalStatus === "SENT" && !outreach.repliedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                        title="Record executive reply"
                        onClick={() => recordReplyMutation.mutate({ outreachId: outreach.id })}
                        disabled={recordReplyMutation.isPending}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* View Intelligence Note Modal */}
        <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewItem?.company} — Intelligence Package</DialogTitle>
            </DialogHeader>
            {viewItem && (
              <div className="space-y-4 text-sm">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Executive Decision Note</p>
                  <p className="font-medium mb-2">Subject: {viewItem.subject}</p>
                  {viewItem.target && <p className="text-muted-foreground mb-2">To: {viewItem.target}</p>}
                  <p className="whitespace-pre-wrap leading-relaxed">{viewItem.body}</p>
                </div>
                {viewItem.linkedin && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">LinkedIn Intelligence Message</p>
                    <p className="leading-relaxed">{viewItem.linkedin}</p>
                  </div>
                )}
                {viewItem.brief && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Executive Brief</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{viewItem.brief}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewItem(null)}>Close</Button>
              {viewItem && (
                <Button onClick={() => {
                  approveMutation.mutate({ outreachId: viewItem.id });
                  setViewItem(null);
                }}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Deliver Intelligence Note Dialog */}
        <Dialog open={!!sendDialogItem} onOpenChange={() => setSendDialogItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deliver Intelligence Note — {sendDialogItem?.company}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300">
                Delivers from <strong>farouq@agenthink.ai</strong> with CC to <strong>farouqsultan@gmail.com</strong>. A copy is always sent to your review address.
              </div>
              <div>
                <Label className="text-xs">Executive Email *</Label>
                <Input
                  value={sendToEmail}
                  onChange={(e) => setSendToEmail(e.target.value)}
                  placeholder="ceo@company.com"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Executive Name</Label>
                <Input
                  value={sendToName}
                  onChange={(e) => setSendToName(e.target.value)}
                  placeholder="John Smith"
                  className="mt-1 text-sm"
                />
              </div>
              {sendDialogItem?.subject && (
                <div className="p-3 bg-muted/40 rounded text-xs">
                  <div className="font-semibold mb-1">Subject: {sendDialogItem.subject}</div>
                  <div className="text-muted-foreground line-clamp-3">{sendDialogItem.body?.substring(0, 200)}...</div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendDialogItem(null)}>Cancel</Button>
              <Button
                onClick={() => sendDialogItem && sendEmailMutation.mutate({ outreachId: sendDialogItem.id, toEmail: sendToEmail, toName: sendToName })}
                disabled={!sendToEmail || sendEmailMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {sendEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Deliver Now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={!!rejectId} onOpenChange={() => { setRejectId(null); setRejectReason(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Intelligence Note</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Reason for rejection — Atlas will use this to improve future notes..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim()}
                onClick={() => rejectId && rejectMutation.mutate({ outreachId: rejectId, reason: rejectReason })}
              >
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
