import { toast } from "sonner";
/**
 * AROS Outreach Queue — Approval queue for CEO emails
 * Approve, reject, mark sent, view email content
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
import { Mail, CheckCircle2, XCircle, Send, Eye, RefreshCw, AlertTriangle } from "lucide-react";


type OutreachStatus = "PENDING_CEO_REVIEW" | "APPROVED" | "REJECTED" | "SENT" | "BOUNCED";

const STATUS_COLORS: Record<OutreachStatus, string> = {
  PENDING_CEO_REVIEW: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  SENT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  BOUNCED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
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
    teaser: string;
    company: string;
    target: string | null;
  } | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, refetch } = trpc.arosOutreachFactory.listQueue.useQuery({
    status: statusFilter !== "all" ? (statusFilter as OutreachStatus) : undefined,
    limit: 100,
  });

  const approveMutation = trpc.arosOutreachFactory.approve.useMutation({
    onSuccess: () => { toast.success("Approved"); refetch(); },
    onError: (err) => toast.error(`Error: `),
  });

  const rejectMutation = trpc.arosOutreachFactory.reject.useMutation({
    onSuccess: () => { toast.success("Rejected"); setRejectId(null); setRejectReason(""); refetch(); },
    onError: (err) => toast.error(`Error: `),
  });

  const markSentMutation = trpc.arosOutreachFactory.markSent.useMutation({
    onSuccess: () => { toast.success("Marked as Sent"); refetch(); },
    onError: (err) => toast.error(`Error: `),
  });

  const rows = data?.rows ?? [];
  const pending = rows.filter(r => r.outreach.approvalStatus === "PENDING_CEO_REVIEW").length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Outreach Approval Queue</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {pending > 0 ? (
                <span className="text-yellow-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {pending} pending CEO review
                </span>
              ) : "All outreach reviewed"}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING_CEO_REVIEW">Pending Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Queue */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading queue...</div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No outreach in queue. Generate outreach from the Top 20 Opportunities page.
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
                      Subject: {outreach.emailSubject}
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[outreach.approvalStatus as OutreachStatus] ?? ""}`}>
                      {outreach.approvalStatus?.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setViewItem({
                        id: outreach.id,
                        subject: outreach.emailSubject ?? "",
                        body: outreach.emailBody ?? "",
                        brief: outreach.executiveBrief ?? "",
                        teaser: outreach.sdrTeaser ?? "",
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
                          onClick={() => approveMutation.mutate({ outreachId: outreach.id })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
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
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                        onClick={() => markSentMutation.mutate({ outreachId: outreach.id })}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* View Email Modal */}
        <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewItem?.company} — Outreach Package</DialogTitle>
            </DialogHeader>
            {viewItem && (
              <div className="space-y-4 text-sm">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">CEO Email</p>
                  <p className="font-medium mb-2">Subject: {viewItem.subject}</p>
                  {viewItem.target && <p className="text-muted-foreground mb-2">To: {viewItem.target}</p>}
                  <p className="whitespace-pre-wrap leading-relaxed">{viewItem.body}</p>
                </div>
                {viewItem.teaser && (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">SDR Teaser</p>
                    <p className="leading-relaxed">{viewItem.teaser}</p>
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

        {/* Reject Modal */}
        <Dialog open={!!rejectId} onOpenChange={() => { setRejectId(null); setRejectReason(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Outreach</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Reason for rejection..."
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
