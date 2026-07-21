/**
 * Mesh Core v0.1 — Admin Cost Dashboard
 * Route: /admin/mesh-core
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Database,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Zap,
  ShieldAlert,
} from "lucide-react";

function fmtUsd(n: number, decimals = 4) {
  return `$${n.toFixed(decimals)}`;
}
function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

const VERDICT_COLORS: Record<string, string> = {
  STRONG: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  VIABLE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  REPRICE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  FAIL: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ALERT_ICONS: Record<string, React.ReactNode> = {
  CAP_BREACH: <Zap className="h-4 w-4 text-amber-400" />,
  ESCALATION: <TrendingUp className="h-4 w-4 text-blue-400" />,
  FAIL_VERDICT: <AlertTriangle className="h-4 w-4 text-red-400" />,
  REPRICE_VERDICT: <ShieldAlert className="h-4 w-4 text-amber-400" />,
};

function AlertsPanel() {
  const { data: alerts = [], refetch, isLoading } = trpc.meshCore.getLiveAlerts.useQuery();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Last 24 hours</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {alerts.length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground text-sm">No alerts in the last 24 hours</div>
      )}
      {alerts.map((a, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
          <div className="mt-0.5">{ALERT_ICONS[a.type] ?? <AlertTriangle className="h-4 w-4" />}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-foreground">{a.workflowType}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{a.type}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{a.count} OUs</span>
        </div>
      ))}
    </div>
  );
}

function MarginsPanel() {
  const { data: margins = [], isLoading } = trpc.meshCore.getWorkflowMargins.useQuery({});
  if (isLoading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading margin data…</div>;
  if (margins.length === 0) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      No OU data yet. Use the <strong>Seed 120 Demo OUs</strong> button to populate sample data.
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wide">
            <th className="text-left py-2 pr-4">Workflow</th>
            <th className="text-right py-2 pr-4">OUs</th>
            <th className="text-right py-2 pr-4">Price</th>
            <th className="text-right py-2 pr-4">p50 Cost</th>
            <th className="text-right py-2 pr-4">p90 Cost</th>
            <th className="text-right py-2 pr-4">p50 Margin</th>
            <th className="text-right py-2 pr-4">p90 Margin</th>
            <th className="text-right py-2">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {margins.map((m) => (
            <tr key={m.workflowType} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
              <td className="py-2.5 pr-4 font-mono text-xs font-medium">{m.workflowType}</td>
              <td className="text-right py-2.5 pr-4 tabular-nums text-muted-foreground">{m.ouCount}</td>
              <td className="text-right py-2.5 pr-4 tabular-nums">{fmtUsd(m.price, 2)}</td>
              <td className="text-right py-2.5 pr-4 tabular-nums text-muted-foreground">{fmtUsd(m.p50Cost, 4)}</td>
              <td className="text-right py-2.5 pr-4 tabular-nums text-muted-foreground">{fmtUsd(m.p90Cost, 4)}</td>
              <td className={`text-right py-2.5 pr-4 tabular-nums font-semibold ${m.p50Margin >= 50 ? "text-emerald-400" : m.p50Margin >= 20 ? "text-blue-400" : "text-red-400"}`}>
                {fmtPct(m.p50Margin)}
              </td>
              <td className={`text-right py-2.5 pr-4 tabular-nums font-semibold ${m.p90Margin >= 50 ? "text-emerald-400" : m.p90Margin >= 20 ? "text-blue-400" : "text-red-400"}`}>
                {fmtPct(m.p90Margin)}
              </td>
              <td className="text-right py-2.5">
                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${VERDICT_COLORS[m.verdict] ?? ""}`}>
                  {m.verdict}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/30 text-xs text-muted-foreground space-y-1">
        <p><strong className="text-foreground">STRONG</strong> — p90 margin ≥ 50% &nbsp;|&nbsp; <strong className="text-foreground">VIABLE</strong> — p90 ≥ 20% &lt; 50%</p>
        <p><strong className="text-foreground">REPRICE</strong> — p50 ≥ 50% AND p90 &lt; 20% &nbsp;|&nbsp; <strong className="text-foreground">FAIL</strong> — p50 &lt; 50%</p>
      </div>
    </div>
  );
}

function PricebookPanel() {
  const { data: pricebook = [], refetch } = trpc.meshCore.getPricebook.useQuery();

  const updateMutation = trpc.meshCore.updatePricebook.useMutation({
    onSuccess: () => { refetch(); toast.success("Pricebook updated"); },
    onError: (e) => toast.error(`Update failed: ${e.message}`),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  function startEdit(wt: string, row: typeof pricebook[0]) {
    setEditing(wt);
    setEditValues({
      priceUsd: String(row.priceUsd),
      liabilityReservePct: String((row.liabilityReservePct * 100).toFixed(2)),
      humanGateCostPerMinute: String(row.humanGateCostPerMinute),
      humanGateMinutes: String(row.humanGateMinutes),
      residencyCacPerOuUsd: String(row.residencyCacPerOuUsd),
      disputeRate: String((row.disputeRate * 100).toFixed(2)),
    });
  }

  function saveEdit(wt: string) {
    updateMutation.mutate({
      workflowType: wt,
      priceUsd: parseFloat(editValues.priceUsd),
      liabilityReservePct: parseFloat(editValues.liabilityReservePct) / 100,
      humanGateCostPerMinute: parseFloat(editValues.humanGateCostPerMinute),
      humanGateMinutes: parseFloat(editValues.humanGateMinutes),
      residencyCacPerOuUsd: parseFloat(editValues.residencyCacPerOuUsd),
      disputeRate: parseFloat(editValues.disputeRate) / 100,
    });
    setEditing(null);
  }

  return (
    <div className="space-y-3">
      {pricebook.map((row) => (
        <div key={row.workflowType} className="p-4 rounded-lg bg-muted/30 border border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{row.workflowType}</span>
              <Badge variant="outline" className={`text-[10px] ${row.isEnterprise ? "text-purple-400 border-purple-500/30" : "text-slate-400"}`}>
                {row.isEnterprise ? "Enterprise" : "Self-serve"}
              </Badge>
            </div>
            {editing === row.workflowType ? (
              <div className="flex gap-2">
                <Button size="sm" variant="default" onClick={() => saveEdit(row.workflowType)} disabled={updateMutation.isPending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => startEdit(row.workflowType, row)}>Edit</Button>
            )}
          </div>
          {editing === row.workflowType ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: "priceUsd", label: "Price (USD)" },
                { key: "liabilityReservePct", label: "Liability Reserve (%)" },
                { key: "humanGateCostPerMinute", label: "Gate Rate ($/min)" },
                { key: "humanGateMinutes", label: "Gate Minutes" },
                { key: "residencyCacPerOuUsd", label: "CAC/OU (USD)" },
                { key: "disputeRate", label: "Dispute Rate (%)" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    step="any"
                    value={editValues[key]}
                    onChange={(e) => setEditValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
              <span>Price: <strong className="text-foreground">{fmtUsd(row.priceUsd, 2)}</strong></span>
              <span>Reserve: <strong className="text-foreground">{fmtPct(row.liabilityReservePct * 100)}</strong></span>
              <span>Gate: <strong className="text-foreground">{row.humanGateMinutes}min @ ${row.humanGateCostPerMinute}/min</strong></span>
              <span>CAC/OU: <strong className="text-foreground">{fmtUsd(row.residencyCacPerOuUsd, 4)}</strong></span>
              <span>Dispute: <strong className="text-foreground">{fmtPct(row.disputeRate * 100)}</strong></span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ModelPricingPanel() {
  const { data: pricing = [] } = trpc.meshCore.getModelPricing.useQuery();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Amendment B seed values — USD per 1M tokens</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pricing.map((p) => (
          <div key={p.tier} className="p-4 rounded-lg bg-muted/30 border border-border/40 space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{p.tier}</span>
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Input</span>
                <strong className="text-foreground">{fmtUsd(p.inputPricePerMillion, 2)}/1M</strong>
              </div>
              <div className="flex justify-between">
                <span>Output</span>
                <strong className="text-foreground">{fmtUsd(p.outputPricePerMillion, 2)}/1M</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OULedgerPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.meshCore.getOULedger.useQuery({ page, pageSize: 20 });

  return (
    <div className="space-y-3">
      {isLoading && <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>}
      {data && data.rows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">No OU records yet.</div>
      )}
      {data && data.rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground uppercase tracking-wide">
                  <th className="text-left py-2 pr-3">Workflow</th>
                  <th className="text-left py-2 pr-3">Tier</th>
                  <th className="text-right py-2 pr-3">Tokens</th>
                  <th className="text-right py-2 pr-3">Token $</th>
                  <th className="text-right py-2 pr-3">Gate $</th>
                  <th className="text-right py-2 pr-3">Dispute $</th>
                  <th className="text-right py-2 pr-3">CAC $</th>
                  <th className="text-right py-2 pr-3">Reserve $</th>
                  <th className="text-right py-2 pr-3">Loaded $</th>
                  <th className="text-right py-2 pr-3">Price $</th>
                  <th className="text-right py-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const margin = r.priceUsd > 0 ? ((r.priceUsd - r.loadedCostUsd) / r.priceUsd) * 100 : 0;
                  return (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="py-2 pr-3 font-mono">{r.workflowType}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="text-[9px] px-1">{r.tier}</Badge>
                      </td>
                      <td className="text-right py-2 pr-3 tabular-nums text-muted-foreground">{(r.inputTokens + r.outputTokens).toLocaleString()}</td>
                      <td className="text-right py-2 pr-3 tabular-nums">{fmtUsd(r.tokenCostUsd, 5)}</td>
                      <td className="text-right py-2 pr-3 tabular-nums">{fmtUsd(r.humanGateCostUsd, 5)}</td>
                      <td className="text-right py-2 pr-3 tabular-nums">{fmtUsd(r.disputeCostUsd, 5)}</td>
                      <td className="text-right py-2 pr-3 tabular-nums">{fmtUsd(r.residencyCacUsd, 5)}</td>
                      <td className="text-right py-2 pr-3 tabular-nums">{fmtUsd(r.liabilityReserveUsd, 5)}</td>
                      <td className="text-right py-2 pr-3 tabular-nums font-semibold">{fmtUsd(r.loadedCostUsd, 5)}</td>
                      <td className="text-right py-2 pr-3 tabular-nums">{fmtUsd(r.priceUsd, 2)}</td>
                      <td className={`text-right py-2 tabular-nums font-semibold ${margin >= 50 ? "text-emerald-400" : margin >= 20 ? "text-blue-400" : "text-red-400"}`}>
                        {fmtPct(margin)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Page {data.page} of {data.totalPages} ({data.total.toLocaleString()} total OUs)
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function MeshCostDashboard() {
  const { user, loading } = useAuth();

  const utils = trpc.useUtils();

  const seedMutation = trpc.meshCore.seedDemoOUs.useMutation({
    onSuccess: (d) => {
      toast.success(`Seeded ${d.inserted} demo OUs`);
      utils.meshCore.getOULedger.invalidate();
      utils.meshCore.getWorkflowMargins.invalidate();
      utils.meshCore.getLiveAlerts.invalidate();
    },
    onError: (e) => toast.error(`Seed failed: ${e.message}`),
  });

  if (loading) return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading…</div>;
  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
          <p className="text-lg font-semibold">Admin Access Required</p>
          <p className="text-sm text-muted-foreground">This page is restricted to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/50 bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Mesh Core — Cost Dashboard</h1>
              <p className="text-xs text-muted-foreground">Loaded cost · margin · verdict · pricebook</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate({ count: 120 })}
            disabled={seedMutation.isPending}
            className="gap-2"
          >
            <Database className={`h-3.5 w-3.5 ${seedMutation.isPending ? "animate-pulse" : ""}`} />
            {seedMutation.isPending ? "Seeding…" : "Seed 120 Demo OUs"}
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Live Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertsPanel />
          </CardContent>
        </Card>

        <Tabs defaultValue="margins">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="margins" className="text-xs">Margins</TabsTrigger>
            <TabsTrigger value="pricebook" className="text-xs">Pricebook</TabsTrigger>
            <TabsTrigger value="models" className="text-xs">Models</TabsTrigger>
            <TabsTrigger value="ledger" className="text-xs">OU Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="margins" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  Workflow Margin Analysis
                  <span className="text-xs text-muted-foreground font-normal ml-1">(Amendment C p90 definition)</span>
                </CardTitle>
              </CardHeader>
              <CardContent><MarginsPanel /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricebook" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  Workflow Pricebook
                  <span className="text-xs text-muted-foreground font-normal ml-1">(admin-editable)</span>
                </CardTitle>
              </CardHeader>
              <CardContent><PricebookPanel /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-purple-400" />
                  Model Pricing Reference
                </CardTitle>
              </CardHeader>
              <CardContent><ModelPricingPanel /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-slate-400" />
                  Orchestration Unit Ledger
                </CardTitle>
              </CardHeader>
              <CardContent><OULedgerPanel /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
