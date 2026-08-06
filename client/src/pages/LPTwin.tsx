/**
 * LPTwin.tsx — LP Twin Dashboard
 * CapTwin Enterprise Module — WP3
 *
 * Displays the user's fund profiles and simulation sessions.
 * Entry point for the LP Twin experience.
 */

import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, ChevronRight, Archive, FlaskConical, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "secondary" },
    running: { label: "Running", variant: "default" },
    completed: { label: "Completed", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LPTwin() {
  const [activeTab, setActiveTab] = useState<"sessions" | "funds">("sessions");

  const { data: fundsData, isLoading: fundsLoading, error: fundsError } = trpc.lpTwin.listFunds.useQuery({ includeArchived: false });
  const { data: sessionsData, isLoading: sessionsLoading } = trpc.lpTwin.listSessions.useQuery({ limit: 50 });

  const funds = fundsData?.funds ?? [];
  const sessions = sessionsData?.sessions ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">LP Twin</h1>
            <Badge variant="outline" className="text-xs font-mono">v1</Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Test your fund against synthetic institutional allocator segments before beginning a fundraising campaign.
          </p>
          <p className="text-xs text-amber-500/80 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Evidence-based synthetic simulations — not validated predictions of real allocator behaviour.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/captwin/lp-twin/new">
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              New Test
            </Button>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {fundsError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6 text-sm text-destructive">
          {fundsError.message.includes("membership") || fundsError.message.includes("FORBIDDEN")
            ? "LP Twin requires an active enterprise membership. Contact your administrator."
            : `Error: ${fundsError.message}`}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(["sessions", "funds"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "sessions" ? `Simulation Sessions (${sessions.length})` : `Fund Profiles (${funds.length})`}
          </button>
        ))}
      </div>

      {/* Sessions tab */}
      {activeTab === "sessions" && (
        <div>
          {sessionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No simulation sessions yet</p>
              <p className="text-sm mt-1">Create a fund profile and run your first test.</p>
              <Link href="/captwin/lp-twin/new">
                <Button variant="outline" size="sm" className="mt-4 gap-1">
                  <Plus className="h-4 w-4" /> New Test
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Link key={session.id} href={`/captwin/lp-twin/session/${session.id}`}>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon status={session.status} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{session.sessionName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {session.scenarioType} · Engine {session.engineVersion} · {formatDate(session.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={session.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Funds tab */}
      {activeTab === "funds" && (
        <div>
          {fundsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}
            </div>
          ) : funds.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No fund profiles yet</p>
              <p className="text-sm mt-1">Create your first fund profile to begin testing.</p>
              <Link href="/captwin/lp-twin/new">
                <Button variant="outline" size="sm" className="mt-4 gap-1">
                  <Plus className="h-4 w-4" /> Create Fund Profile
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {funds.map((fund) => (
                <Card key={fund.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-semibold leading-tight">{fund.fundName}</CardTitle>
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">{fund.evidenceStatus}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{fund.gpName}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Strategy</p>
                        <p className="font-medium truncate">{fund.strategy}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Target Size</p>
                        <p className="font-medium">{fund.currency} {Number(fund.targetFundSizeM).toLocaleString()}M</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Version</p>
                        <p className="font-medium">v{fund.version}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Link href={`/captwin/lp-twin/new?fundId=${fund.id}`}>
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                          <Plus className="h-3 w-3" /> New Session
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
