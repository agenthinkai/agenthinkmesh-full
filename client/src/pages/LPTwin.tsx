/**
 * LPTwin.tsx — LP Twin Home
 * CapTwin Enterprise Module — WP3
 *
 * Displays:
 * - Active and archived fund profiles with full card actions
 * - Recent simulation sessions with status, engine version, segment count
 * - Search and filtering
 * - New Fund CTA and Run New Simulation action
 */

import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FlaskConical, Plus, Search, MoreHorizontal, Archive, Eye, Edit3,
  Play, History, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle,
  BarChart3, ChevronRight, Filter,
} from "lucide-react";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function EvidenceBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    complete: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    verified: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <Badge className={`text-xs capitalize ${map[status] ?? "bg-muted text-muted-foreground"} hover:opacity-100`}>
      {status}
    </Badge>
  );
}

function SessionStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

// ── Fund Card ─────────────────────────────────────────────────────────────────

function FundCard({
  fund,
  onArchive,
  onRunSimulation,
}: {
  fund: {
    id: number;
    fundName: string;
    gpName: string;
    strategy: string;
    currency: string;
    targetFundSizeM: string;
    evidenceStatus: string;
    version: number;
    createdAt: number;
    updatedAt: number;
    archivedAt: number | null;
  };
  onArchive: (id: number, name: string) => void;
  onRunSimulation: (id: number) => void;
}) {
  const [, navigate] = useLocation();
  const isArchived = !!fund.archivedAt;

  return (
    <Card className={`transition-all ${isArchived ? "opacity-60 border-dashed" : "hover:border-primary/40"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold leading-tight truncate">{fund.fundName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{fund.gpName}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <EvidenceBadge status={fund.evidenceStatus} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/captwin/lp-twin/fund/${fund.id}`)}>
                  <Eye className="h-4 w-4 mr-2" /> View Fund
                </DropdownMenuItem>
                {!isArchived && (
                  <DropdownMenuItem onClick={() => navigate(`/captwin/lp-twin/fund/${fund.id}/edit`)}>
                    <Edit3 className="h-4 w-4 mr-2" /> Edit Fund
                  </DropdownMenuItem>
                )}
                {!isArchived && (
                  <DropdownMenuItem onClick={() => onRunSimulation(fund.id)}>
                    <Play className="h-4 w-4 mr-2" /> Run Simulation
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate(`/captwin/lp-twin?tab=sessions&fundId=${fund.id}`)}>
                  <History className="h-4 w-4 mr-2" /> View History
                </DropdownMenuItem>
                {!isArchived && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onArchive(fund.id, fund.fundName)}
                    >
                      <Archive className="h-4 w-4 mr-2" /> Archive Fund
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div>
            <p className="text-muted-foreground">Strategy</p>
            <p className="font-medium truncate">{fund.strategy}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Target</p>
            <p className="font-medium">{fund.currency} {Number(fund.targetFundSizeM).toLocaleString()}M</p>
          </div>
          <div>
            <p className="text-muted-foreground">Version</p>
            <p className="font-medium">v{fund.version}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Updated {formatDate(fund.updatedAt)}</p>
          {!isArchived && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => onRunSimulation(fund.id)}
            >
              <Play className="h-3 w-3" /> Simulate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Session Row ───────────────────────────────────────────────────────────────

function SessionRow({ session }: {
  session: {
    id: number;
    fundId: number;
    sessionName: string;
    scenarioType: string;
    status: string;
    engineVersion: string;
    createdAt: number;
    completedAt: number | null;
  };
}) {
  const selectedSegments = (() => {
    try {
      return [] as string[]; // segments count shown from results
    } catch {
      return [] as string[];
    }
  })();

  return (
    <Link href={`/captwin/lp-twin/${session.id}`}>
      <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer group">
        <div className="flex items-center gap-3 min-w-0">
          <SessionStatusIcon status={session.status} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{session.sessionName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.scenarioType} · Engine {session.engineVersion} · {formatDate(session.createdAt)}
              {session.completedAt && ` · Completed ${formatDate(session.completedAt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs capitalize">{session.status}</Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>
    </Link>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LPTwin() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"funds" | "sessions">("funds");
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<{ id: number; name: string } | null>(null);

  const utils = trpc.useUtils();

  const { data: fundsData, isLoading: fundsLoading, error: fundsError } = trpc.lpTwin.listFunds.useQuery(
    { includeArchived: showArchived },
  );
  const { data: sessionsData, isLoading: sessionsLoading } = trpc.lpTwin.listSessions.useQuery({ limit: 50 });

  const archiveMutation = trpc.lpTwin.archiveFund.useMutation({
    onSuccess: () => {
      toast.success("Fund archived");
      utils.lpTwin.listFunds.invalidate();
      setArchiveTarget(null);
    },
    onError: (err) => {
      toast.error("Archive failed", { description: err.message });
      setArchiveTarget(null);
    },
  });

  const allFunds = fundsData?.funds ?? [];
  const allSessions = sessionsData?.sessions ?? [];

  const filteredFunds = useMemo(() => {
    if (!search.trim()) return allFunds;
    const q = search.toLowerCase();
    return allFunds.filter(
      (f) =>
        f.fundName.toLowerCase().includes(q) ||
        f.gpName.toLowerCase().includes(q) ||
        f.strategy.toLowerCase().includes(q)
    );
  }, [allFunds, search]);

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return allSessions;
    const q = search.toLowerCase();
    return allSessions.filter((s) => s.sessionName.toLowerCase().includes(q));
  }, [allSessions, search]);

  const activeFunds = filteredFunds.filter((f) => !f.archivedAt);
  const archivedFunds = filteredFunds.filter((f) => !!f.archivedAt);

  function handleRunSimulation(fundId: number) {
    navigate(`/captwin/lp-twin/new?fundId=${fundId}`);
  }

  const isEnterpriseError =
    fundsError?.message?.includes("membership") ||
    fundsError?.message?.includes("FORBIDDEN") ||
    fundsError?.message?.includes("enterprise");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Page header */}
      <div className="border-b border-border bg-background/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">LP Twin</h1>
            <Badge variant="outline" className="text-xs font-mono">v1</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/captwin/lp-twin/fund/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> New Fund
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Disclaimer */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-6 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Evidence-based synthetic simulations only.</strong> Outputs are derived from anonymised institutional archetypes and are not validated predictions of real allocator behaviour.
          </span>
        </div>

        {/* Enterprise error */}
        {fundsError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6 text-sm text-destructive">
            {isEnterpriseError
              ? "LP Twin requires an active enterprise membership. Contact your administrator to be added to an organisation."
              : `Error loading funds: ${fundsError.message}`}
          </div>
        )}

        {/* Search + filter bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search funds or sessions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className="gap-1.5 h-9"
            onClick={() => setShowArchived((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(["funds", "sessions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "funds"
                ? `Funds (${activeFunds.length}${archivedFunds.length > 0 ? ` + ${archivedFunds.length} archived` : ""})`
                : `Sessions (${filteredSessions.length})`}
            </button>
          ))}
        </div>

        {/* ── FUNDS TAB ── */}
        {activeTab === "funds" && (
          <div>
            {fundsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
              </div>
            ) : activeFunds.length === 0 && archivedFunds.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-base font-medium mb-1">No fund profiles yet</p>
                <p className="text-sm mb-4">Create your first fund profile to begin testing against LP segments.</p>
                <Link href="/captwin/lp-twin/fund/new">
                  <Button className="gap-1.5">
                    <Plus className="h-4 w-4" /> Create Fund Profile
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {activeFunds.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Active Funds ({activeFunds.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeFunds.map((fund) => (
                        <FundCard
                          key={fund.id}
                          fund={fund}
                          onArchive={(id, name) => setArchiveTarget({ id, name })}
                          onRunSimulation={handleRunSimulation}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {showArchived && archivedFunds.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Archived Funds ({archivedFunds.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archivedFunds.map((fund) => (
                        <FundCard
                          key={fund.id}
                          fund={fund}
                          onArchive={(id, name) => setArchiveTarget({ id, name })}
                          onRunSimulation={handleRunSimulation}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {activeTab === "sessions" && (
          <div>
            {sessionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-base font-medium mb-1">No simulation sessions yet</p>
                <p className="text-sm mb-4">Create a fund profile and run your first simulation.</p>
                <Link href="/captwin/lp-twin/fund/new">
                  <Button className="gap-1.5">
                    <Plus className="h-4 w-4" /> New Simulation
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Archive confirmation dialog */}
      <AlertDialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Fund</AlertDialogTitle>
            <AlertDialogDescription>
              Archive <strong>{archiveTarget?.name}</strong>? The fund and all its simulation history will be preserved but hidden from the active list. This action can be reversed by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => archiveTarget && archiveMutation.mutate({ fundId: archiveTarget.id })}
            >
              {archiveMutation.isPending ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
