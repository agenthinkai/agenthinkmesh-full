/**
 * OutcomeBackfill.tsx — Operation 1000 Outcomes
 *
 * Admin review queue for classifying existing outcome sessions.
 * Read-only for all council/CFA/attribution/calibration logic.
 * Only writes: outcomeStatus, primaryDriver, sourceConfidence, sourceType, sourceUrl, outcomeNotes.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
type OutcomeStatus = "UNKNOWN" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "ABANDONED" | "RESTRUCTURED";
type PrimaryDriver = "FINANCIAL" | "CONSTRUCTION" | "REGULATORY" | "TECHNOLOGY" | "COMMERCIAL" | "ESG";
type SourceConfidence = "HIGH" | "MEDIUM" | "LOW";
type SourceType = "FILING" | "ANNUAL_REPORT" | "REGULATORY" | "LENDER" | "DEVELOPER" | "ANNOUNCEMENT" | "MANUAL";

const STATUS_COLORS: Record<OutcomeStatus, string> = {
  UNKNOWN: "bg-slate-700 text-slate-300",
  IN_PROGRESS: "bg-blue-900 text-blue-200",
  SUCCEEDED: "bg-emerald-900 text-emerald-200",
  FAILED: "bg-red-900 text-red-200",
  ABANDONED: "bg-orange-900 text-orange-200",
  RESTRUCTURED: "bg-yellow-900 text-yellow-200",
};

const CONFIDENCE_COLORS: Record<SourceConfidence, string> = {
  HIGH: "bg-emerald-900 text-emerald-200",
  MEDIUM: "bg-yellow-900 text-yellow-200",
  LOW: "bg-red-900 text-red-200",
};

const DRIVER_ICONS: Record<PrimaryDriver, string> = {
  FINANCIAL: "💰",
  CONSTRUCTION: "🏗",
  REGULATORY: "📋",
  TECHNOLOGY: "⚙️",
  COMMERCIAL: "📊",
  ESG: "🌱",
};

// ── Coverage Banner ───────────────────────────────────────────────────────────
function CoverageBanner() {
  const { data } = trpc.outcomeLedger.outcomeCoverage.useQuery();
  if (!data) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-2xl font-bold text-white">
            {data.resolved.toLocaleString()} / {data.total.toLocaleString()} Outcomes
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {data.coveragePct}% coverage · {data.unknown.toLocaleString()} pending classification
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-emerald-400">{data.coveragePct}%</div>
          <div className="text-xs text-muted-foreground">Coverage</div>
        </div>
      </div>

      {/* Phase milestones */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Phase 1", target: data.phase1.target, pct: data.phase1.pct, reached: data.phase1.reached },
          { label: "Phase 2", target: data.phase2.target, pct: data.phase2.pct, reached: data.phase2.reached },
          { label: "Phase 3", target: data.phase3.target, pct: data.phase3.pct, reached: data.phase3.reached },
        ].map((ph) => (
          <div key={ph.label} className={`rounded-lg p-3 ${ph.reached ? "bg-emerald-900/40 border border-emerald-700" : "bg-slate-700/40 border border-slate-600"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">{ph.label}</span>
              <span className={`text-xs font-bold ${ph.reached ? "text-emerald-400" : "text-slate-300"}`}>
                {ph.reached ? "✓ REACHED" : `${ph.pct}%`}
              </span>
            </div>
            <Progress value={ph.pct} className="h-1.5" />
            <div className="text-xs text-muted-foreground mt-1">{ph.target.toLocaleString()} outcomes</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Classify Dialog ───────────────────────────────────────────────────────────
interface ClassifyDialogProps {
  session: {
    id: number;
    dealId: string;
    councilMode: string;
    originalVerdict: string;
    decisionDate: number;
    outcomeStatus: OutcomeStatus;
    outcomeDate: number | null;
    outcomeNotes: string | null;
    primaryDriver: PrimaryDriver | null;
    sourceConfidence: SourceConfidence | null;
    sourceType: SourceType | null;
    sourceUrl: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

function ClassifyDialog({ session, onClose, onSaved }: ClassifyDialogProps) {
  const [status, setStatus] = useState<OutcomeStatus>(session.outcomeStatus);
  const [driver, setDriver] = useState<PrimaryDriver | "">(session.primaryDriver ?? "");
  const [confidence, setConfidence] = useState<SourceConfidence | "">(session.sourceConfidence ?? "");
  const [sourceType, setSourceType] = useState<SourceType | "">(session.sourceType ?? "");
  const [sourceUrl, setSourceUrl] = useState(session.sourceUrl ?? "");
  const [notes, setNotes] = useState(session.outcomeNotes ?? "");
  const [outcomeDate, setOutcomeDate] = useState(
    session.outcomeDate ? new Date(session.outcomeDate).toISOString().split("T")[0] : ""
  );

  const utils = trpc.useUtils();
  const updateMutation = trpc.outcomeLedger.update.useMutation({
    onSuccess: () => {
      toast.success("Outcome classified successfully.");
      utils.outcomeLedger.list.invalidate();
      utils.outcomeLedger.outcomeCoverage.invalidate();
      onSaved();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const handleSave = useCallback(() => {
    updateMutation.mutate({
      id: session.id,
      outcomeStatus: status,
      outcomeDate: outcomeDate ? new Date(outcomeDate).getTime() : undefined,
      outcomeNotes: notes || undefined,
      primaryDriver: driver || undefined,
      sourceConfidence: confidence || undefined,
      sourceType: sourceType || undefined,
      sourceUrl: sourceUrl || undefined,
    });
  }, [session.id, status, outcomeDate, notes, driver, confidence, sourceType, sourceUrl, updateMutation]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Classify Outcome</DialogTitle>
          <div className="text-xs text-muted-foreground font-mono mt-1">{session.dealId}</div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Deal context */}
          <div className="bg-slate-800/60 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Council Mode</span>
              <span className="text-slate-200 uppercase">{session.councilMode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original Verdict</span>
              <span className="text-slate-200">{session.originalVerdict}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Decision Date</span>
              <span className="text-slate-200">{new Date(session.decisionDate).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Outcome Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Outcome Status *</label>
            <Select value={status} onValueChange={(v) => setStatus(v as OutcomeStatus)}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {(["SUCCEEDED", "FAILED", "RESTRUCTURED", "ABANDONED", "IN_PROGRESS", "UNKNOWN"] as OutcomeStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="text-white hover:bg-slate-700">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Primary Driver */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Primary Outcome Driver</label>
            <Select value={driver} onValueChange={(v) => setDriver(v as PrimaryDriver)}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Select driver..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {(["FINANCIAL", "CONSTRUCTION", "REGULATORY", "TECHNOLOGY", "COMMERCIAL", "ESG"] as PrimaryDriver[]).map((d) => (
                  <SelectItem key={d} value={d} className="text-white hover:bg-slate-700">
                    {DRIVER_ICONS[d]} {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Source Confidence</label>
              <Select value={confidence} onValueChange={(v) => setConfidence(v as SourceConfidence)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Confidence..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(["HIGH", "MEDIUM", "LOW"] as SourceConfidence[]).map((c) => (
                    <SelectItem key={c} value={c} className="text-white hover:bg-slate-700">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Source Type</label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Source type..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(["FILING", "ANNUAL_REPORT", "REGULATORY", "LENDER", "DEVELOPER", "ANNOUNCEMENT", "MANUAL"] as SourceType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-white hover:bg-slate-700">{t.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Outcome Date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Outcome Date</label>
            <Input
              type="date"
              value={outcomeDate}
              onChange={(e) => setOutcomeDate(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>

          {/* Source URL */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Source URL (optional)</label>
            <Input
              type="url"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes (optional)</label>
            <Textarea
              placeholder="Brief description of outcome, key factors, or data source..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {updateMutation.isPending ? "Saving..." : "Save Classification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Row type for the classify dialog ─────────────────────────────────────────
type SessionRow = {
  id: number;
  dealId: string;
  councilMode: string;
  originalVerdict: string;
  decisionDate: number;
  outcomeStatus: OutcomeStatus;
  outcomeDate: number | null;
  outcomeNotes: string | null;
  primaryDriver: PrimaryDriver | null;
  sourceConfidence: SourceConfidence | null;
  sourceType: SourceType | null;
  sourceUrl: string | null;
  [key: string]: unknown;
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function OutcomeBackfill() {
  const [filterStatus, setFilterStatus] = useState<OutcomeStatus | "ALL">("UNKNOWN");
  const [page, setPage] = useState(0);
  const [classifyTarget, setClassifyTarget] = useState<SessionRow | null>(null);
  const PAGE_SIZE = 25;

  const listQ = trpc.outcomeLedger.list.useQuery({
    outcomeStatus: filterStatus === "ALL" ? undefined : filterStatus,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const rows = listQ.data?.rows ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Operation 1000 Outcomes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Classify existing corpus deals with outcome status, primary driver, and source evidence.
          </p>
        </div>

        {/* Coverage Banner */}
        <CoverageBanner />

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Filter:</span>
          {(["UNKNOWN", "IN_PROGRESS", "SUCCEEDED", "FAILED", "RESTRUCTURED", "ABANDONED", "ALL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(0); }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterStatus === s
                  ? "bg-emerald-600 border-emerald-500 text-white"
                  : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200"
              }`}
            >
              {s === "ALL" ? "All" : s}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{total.toLocaleString()} sessions</span>
        </div>

        {/* Queue */}
        {listQ.isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading queue...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {filterStatus === "UNKNOWN" ? "No unclassified sessions — great work!" : "No sessions match this filter."}
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-4 hover:border-slate-500 transition-colors"
              >
                {/* Status badge */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[row.outcomeStatus as OutcomeStatus]}`}>
                  {row.outcomeStatus}
                </span>

                {/* Deal info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-slate-400 truncate">{row.dealId}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {row.councilMode.toUpperCase()} · {row.originalVerdict} · {new Date(row.decisionDate).toLocaleDateString()}
                  </div>
                </div>

                {/* Backfill badges */}
                <div className="flex items-center gap-2 shrink-0">
                  {row.primaryDriver && (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      {DRIVER_ICONS[row.primaryDriver as PrimaryDriver]} {row.primaryDriver}
                    </span>
                  )}
                  {row.sourceConfidence && (
                    <span className={`text-xs px-2 py-0.5 rounded ${CONFIDENCE_COLORS[row.sourceConfidence as SourceConfidence]}`}>
                      {row.sourceConfidence}
                    </span>
                  )}
                  {row.sourceType && (
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      {row.sourceType.replace("_", " ")}
                    </span>
                  )}
                </div>

                {/* Classify button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClassifyTarget(row as any)}
                  className="shrink-0 border-slate-600 text-slate-300 hover:border-emerald-500 hover:text-emerald-300 text-xs"
                >
                  {row.outcomeStatus === "UNKNOWN" ? "Classify" : "Edit"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="border-slate-600 text-slate-300"
            >
              ← Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="border-slate-600 text-slate-300"
            >
              Next →
            </Button>
          </div>
        )}

        <Separator className="bg-slate-800" />
        <div className="text-xs text-muted-foreground text-center pb-4">
          Operation 1000 Outcomes · Read-only governance layer · No changes to Council, CFA, Attribution, or Calibration logic
        </div>
      </div>

      {/* Classify Dialog */}
      {classifyTarget && (
        <ClassifyDialog
          session={classifyTarget as any}
          onClose={() => setClassifyTarget(null)}
          onSaved={() => setClassifyTarget(null)}
        />
      )}
    </DashboardLayout>
  );
}
