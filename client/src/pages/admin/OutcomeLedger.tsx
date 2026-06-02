import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BookOpen, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

const OUTCOME_STATUSES = ["UNKNOWN", "IN_PROGRESS", "SUCCEEDED", "FAILED", "ABANDONED", "RESTRUCTURED"] as const;
type OutcomeStatus = typeof OUTCOME_STATUSES[number];

const COUNCIL_MODES = [
  { value: "gcc", label: "GCC PE" },
  { value: "global_vc", label: "Global VC" },
  { value: "india_pe", label: "India PE" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "gcc_equities", label: "GCC Equities" },
] as const;

const STATUS_COLORS: Record<OutcomeStatus, string> = {
  UNKNOWN: "bg-zinc-700 text-zinc-200",
  IN_PROGRESS: "bg-blue-700 text-blue-100",
  SUCCEEDED: "bg-emerald-700 text-emerald-100",
  FAILED: "bg-red-700 text-red-100",
  ABANDONED: "bg-orange-700 text-orange-100",
  RESTRUCTURED: "bg-purple-700 text-purple-100",
};

const VERDICT_COLORS: Record<string, string> = {
  APPROVED: "bg-emerald-700 text-emerald-100",
  APPROVED_WITH_CONDITIONS: "bg-teal-700 text-teal-100",
  REJECTED: "bg-red-700 text-red-100",
  VETOED: "bg-rose-800 text-rose-100",
  INSUFFICIENT_DATA: "bg-zinc-600 text-zinc-200",
};

function formatDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-KW", {
    timeZone: "Asia/Kuwait",
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatMode(mode: string) {
  return COUNCIL_MODES.find((m) => m.value === mode)?.label ?? mode;
}

type OutcomeSession = {
  id: number;
  dealId: string;
  councilRunId: string | null;
  councilMode: string;
  originalVerdict: string;
  consensusScore: string | null;
  confidenceLevel: string | null;
  decisionDate: number;
  outcomeStatus: OutcomeStatus;
  outcomeDate: number | null;
  outcomeNotes: string | null;
  createdAt: number;
  updatedAt: number;
};

export default function OutcomeLedgerAdmin() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Filters
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Update modal state
  const [editRow, setEditRow] = useState<OutcomeSession | null>(null);
  const [editStatus, setEditStatus] = useState<OutcomeStatus>("UNKNOWN");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const listQuery = trpc.outcomeLedger.list.useQuery({
    councilMode: filterMode !== "all" ? (filterMode as any) : undefined,
    outcomeStatus: filterStatus !== "all" ? (filterStatus as any) : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const updateMutation = trpc.outcomeLedger.update.useMutation({
    onSuccess: () => {
      toast.success("Outcome updated — status saved.");
      setEditRow(null);
      listQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Update failed: ${err.message}`);
    },
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Admin access required.</p>
      </div>
    );
  }

  const rows: OutcomeSession[] = (listQuery.data?.rows ?? []) as OutcomeSession[];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function openEdit(row: OutcomeSession) {
    setEditRow(row);
    setEditStatus(row.outcomeStatus);
    setEditDate(row.outcomeDate ? new Date(row.outcomeDate).toISOString().split("T")[0] : "");
    setEditNotes(row.outcomeNotes ?? "");
  }

  function submitEdit() {
    if (!editRow) return;
    updateMutation.mutate({
      id: editRow.id,
      outcomeStatus: editStatus,
      outcomeDate: editDate ? new Date(editDate).getTime() : undefined,
      outcomeNotes: editNotes || undefined,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="text-zinc-400 hover:text-zinc-100">
          <ChevronLeft className="w-4 h-4 mr-1" /> Admin
        </Button>
        <BookOpen className="w-5 h-5 text-indigo-400" />
        <h1 className="text-xl font-semibold text-zinc-100">Outcome Ledger</h1>
        <Badge className="bg-indigo-900 text-indigo-200 text-xs ml-2">Phase 1 — Data Collection</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => listQuery.refetch()} className="border-zinc-700 text-zinc-300 hover:text-zinc-100">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={filterMode} onValueChange={(v) => { setFilterMode(v); setPage(0); }}>
          <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-zinc-200 text-sm">
            <SelectValue placeholder="All Modes" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
            <SelectItem value="all">All Modes</SelectItem>
            {COUNCIL_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
          <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-zinc-200 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
            <SelectItem value="all">All Statuses</SelectItem>
            {OUTCOME_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-zinc-500 self-center">
          {total} record{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Deal ID</th>
                <th className="text-left px-4 py-3 font-medium">Council Mode</th>
                <th className="text-left px-4 py-3 font-medium">Verdict</th>
                <th className="text-left px-4 py-3 font-medium">Decision Date</th>
                <th className="text-left px-4 py-3 font-medium">Outcome Status</th>
                <th className="text-left px-4 py-3 font-medium">Outcome Date</th>
                <th className="text-left px-4 py-3 font-medium">Notes</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-500">Loading...</td>
                </tr>
              )}
              {!listQuery.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-500">
                    No outcome records yet. Outcome sessions are created automatically after each council run.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{row.dealId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-zinc-300">{formatMode(row.councilMode)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${VERDICT_COLORS[row.originalVerdict] ?? "bg-zinc-700 text-zinc-200"}`}>
                      {row.originalVerdict}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{formatDate(row.decisionDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[row.outcomeStatus]}`}>
                      {row.outcomeStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{formatDate(row.outcomeDate)}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs max-w-[200px] truncate" title={row.outcomeNotes ?? ""}>
                    {row.outcomeNotes ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs h-7"
                      onClick={() => openEdit(row)}
                    >
                      Update Outcome
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-400">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="border-zinc-700">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="border-zinc-700">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Update Modal */}
      <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) setEditRow(null); }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Update Outcome Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Deal ID</p>
              <p className="text-sm font-mono text-zinc-300">{editRow?.dealId}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Original Verdict</p>
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${VERDICT_COLORS[editRow?.originalVerdict ?? ""] ?? "bg-zinc-700 text-zinc-200"}`}>
                {editRow?.originalVerdict}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-sm">Outcome Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as OutcomeStatus)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-200">
                  {OUTCOME_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-sm">Outcome Date (optional)</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300 text-sm">Notes (optional)</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="What happened? Why did the deal succeed or fail?"
                className="bg-zinc-800 border-zinc-700 text-zinc-200 resize-none h-24"
                maxLength={2000}
              />
              <p className="text-xs text-zinc-600">{editNotes.length}/2000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button
              onClick={submitEdit}
              disabled={updateMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {updateMutation.isPending ? "Saving…" : "Save Outcome"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
