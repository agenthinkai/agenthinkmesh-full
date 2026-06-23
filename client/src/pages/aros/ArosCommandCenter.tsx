import { toast } from "sonner";
/**
 * AROS Revenue Command Center
 * Primary KPI dashboard: funnel overview, top opportunities, token ROI
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crosshair, Target, Mail, GitBranch, Coins, Radar,
  TrendingUp, DollarSign, Users, Zap, ArrowRight, RefreshCw,
  AlertTriangle, CheckCircle2, Clock
} from "lucide-react";

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({
  title, value, sub, icon: Icon, color, onClick
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${color} ${onClick ? "hover:scale-[1.02]" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Funnel Bar ────────────────────────────────────────────────────────────────
function FunnelBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{count.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function ArosCommandCenter() {
  const [, setLocation] = useLocation();
  const [startingRun, setStartingRun] = useState(false);

  const { data: funnel, isLoading: funnelLoading, refetch: refetchFunnel } = trpc.arosDecisionDetection.getFunnelSummary.useQuery();
  const { data: economics, isLoading: econLoading } = trpc.arosTokenLedger.getEconomics.useQuery();
  const { data: queueStats } = trpc.arosOutreachFactory.getQueueStats.useQuery();
  const { data: top20 } = trpc.arosDecisionDetection.getTop20.useQuery();

  const startRunMutation = trpc.arosDiscovery.startRun.useMutation({
    onSuccess: () => { setStartingRun(false); refetchFunnel(); },
    onError: () => setStartingRun(false),
  });

  const handleQuickRun = () => {
    setStartingRun(true);
    startRunMutation.mutate({
      sectors: ["Banks", "Asset Managers", "Energy Companies"],
      geographies: ["United States", "United Kingdom", "Singapore"],
      targetCount: 30,
    });
  };

  const pendingApprovals = queueStats?.find(s => s.status === "PENDING_CEO_REVIEW")?.count ?? 0;
  const approved = queueStats?.find(s => s.status === "APPROVED")?.count ?? 0;
  const sent = queueStats?.find(s => s.status === "SENT")?.count ?? 0;

  const totalCost = economics?.totalCostUsd ?? 0;
  const tokenRoi = economics?.tokenRoi ?? 0;
  const revenue = economics?.revenueGeneratedUsd ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crosshair className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">AROS Revenue Command Center</h1>
            </div>
            <p className="text-sm text-muted-foreground">Autonomous Revenue Operating System — 10,000-company universe</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchFunnel()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={handleQuickRun} disabled={startingRun}>
              {startingRun ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Running...</> : <><Zap className="h-4 w-4 mr-1" /> Quick Discovery Run</>}
            </Button>
          </div>
        </div>

        {/* Primary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Universe"
            value={funnelLoading ? "..." : (funnel?.totalCompanies ?? 0).toLocaleString()}
            sub="Monitored companies"
            icon={Radar}
            color="border-l-blue-500"
            onClick={() => setLocation("/aros/universe")}
          />
          <MetricCard
            title="High Priority"
            value={funnelLoading ? "..." : (funnel?.highPriority ?? 0).toLocaleString()}
            sub="Score ≥ 90"
            icon={Target}
            color="border-l-orange-500"
            onClick={() => setLocation("/aros/opportunities")}
          />
          <MetricCard
            title="Outreach Candidates"
            value={funnelLoading ? "..." : (funnel?.outreachCandidate ?? 0).toLocaleString()}
            sub="Ready for CEO email"
            icon={Mail}
            color="border-l-purple-500"
            onClick={() => setLocation("/aros/outreach")}
          />
          <MetricCard
            title="Pipeline"
            value={funnelLoading ? "..." : ((economics?.pipelineSummary?.companies ?? 0)).toLocaleString()}
            sub="In revenue loop"
            icon={GitBranch}
            color="border-l-green-500"
            onClick={() => setLocation("/aros/pipeline")}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Token Cost"
            value={`$${totalCost.toFixed(4)}`}
            sub="Total AI spend"
            icon={Coins}
            color="border-l-yellow-500"
            onClick={() => setLocation("/aros/token-roi")}
          />
          <MetricCard
            title="Token ROI"
            value={tokenRoi > 0 ? `${tokenRoi.toFixed(0)}x` : "—"}
            sub="Revenue / AI cost"
            icon={TrendingUp}
            color="border-l-emerald-500"
          />
          <MetricCard
            title="Revenue Generated"
            value={revenue > 0 ? `$${revenue.toLocaleString()}` : "$0"}
            sub="Closed customers"
            icon={DollarSign}
            color="border-l-green-600"
          />
          <MetricCard
            title="Pending Approvals"
            value={pendingApprovals}
            sub="CEO review queue"
            icon={Clock}
            color={pendingApprovals > 0 ? "border-l-red-500" : "border-l-gray-400"}
            onClick={() => setLocation("/aros/outreach")}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Funnel Visualization */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Radar className="h-4 w-4" /> Opportunity Funnel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnelLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <FunnelBar label="Universe (10K target)" count={funnel?.totalCompanies ?? 0} max={10000} color="bg-blue-500" />
                  <FunnelBar label="Active (1K target)" count={funnel?.active ?? 0} max={1000} color="bg-indigo-500" />
                  <FunnelBar label="High Priority (200 target)" count={funnel?.highPriority ?? 0} max={200} color="bg-orange-500" />
                  <FunnelBar label="Outreach Candidates (50 target)" count={funnel?.outreachCandidate ?? 0} max={50} color="bg-purple-500" />
                  <div className="pt-2 border-t space-y-1">
                    <FunnelBar label="Outreach Sent" count={economics?.pipelineSummary?.outreach ?? 0} max={Math.max(economics?.pipelineSummary?.outreach ?? 0, 1)} color="bg-pink-500" />
                    <FunnelBar label="Meetings" count={economics?.pipelineSummary?.meetings ?? 0} max={Math.max(economics?.pipelineSummary?.meetings ?? 0, 1)} color="bg-rose-500" />
                    <FunnelBar label="Customers" count={economics?.pipelineSummary?.customers ?? 0} max={Math.max(economics?.pipelineSummary?.customers ?? 0, 1)} color="bg-green-500" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Top 5 Opportunities */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4" /> Top Opportunities
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/aros/opportunities")}>
                  View all 20 <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!top20 || top20.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No opportunities yet. Run a Discovery to populate the universe.
                </div>
              ) : (
                <div className="space-y-2">
                  {top20.slice(0, 5).map((row, i) => (
                    <div
                      key={row.company.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => setLocation("/aros/opportunities")}
                    >
                      <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{row.company.companyName}</p>
                        <p className="text-xs text-muted-foreground">{row.company.sector} · {row.company.country}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={row.company.opportunityScore >= 90 ? "default" : "secondary"} className="text-xs">
                          {row.company.opportunityScore}
                        </Badge>
                        {row.totalAcv > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">${(row.totalAcv / 1000).toFixed(0)}K ACV</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Outreach Queue Status + Token Economics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outreach Queue */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Outreach Queue Status
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/aros/outreach")}>
                  Manage <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!queueStats || queueStats.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No outreach generated yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {queueStats.map(s => (
                    <div key={s.status} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        {s.status === "PENDING_CEO_REVIEW" && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
                        {s.status === "APPROVED" && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />}
                        {s.status === "SENT" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        {s.status === "REJECTED" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                        <span className="text-sm">{s.status.replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold">{s.count}</span>
                        {s.totalAcv > 0 && <span className="text-xs text-muted-foreground ml-2">${(s.totalAcv / 1000).toFixed(0)}K</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Token Economics Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Coins className="h-4 w-4" /> Token Economics
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/aros/token-roi")}>
                  Full report <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {econLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: "Cost per Opportunity", value: economics?.costPerOpportunity ?? 0 },
                    { label: "Cost per Outreach", value: economics?.costPerOutreach ?? 0 },
                    { label: "Cost per Meeting", value: economics?.costPerMeeting ?? 0 },
                    { label: "Cost per Proposal", value: economics?.costPerProposal ?? 0 },
                    { label: "Cost per Customer", value: economics?.costPerCustomer ?? 0 },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between py-1 border-b last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-semibold">
                        {item.value > 0 ? `$${item.value.toFixed(4)}` : "—"}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1 pt-2">
                    <span className="text-sm font-semibold">Token ROI</span>
                    <span className="text-sm font-bold text-green-600">
                      {tokenRoi > 0 ? `${tokenRoi.toFixed(0)}x` : "—"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setLocation("/aros/universe")}>
                <Radar className="h-4 w-4 mr-1" /> View Universe
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/aros/opportunities")}>
                <Target className="h-4 w-4 mr-1" /> Rank Opportunities
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/aros/outreach")}>
                <Mail className="h-4 w-4 mr-1" /> Approve Outreach
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/aros/pipeline")}>
                <GitBranch className="h-4 w-4 mr-1" /> Pipeline Kanban
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/aros/token-roi")}>
                <Coins className="h-4 w-4 mr-1" /> Token ROI
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
