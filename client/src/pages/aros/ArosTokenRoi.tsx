import { toast } from "sonner";
/**
 * AROS Token ROI — Token economics dashboard
 * Cost per opportunity, meeting, proposal, customer + ROI
 */

import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, RefreshCw, TrendingUp, Zap, Target, Users, FileText, DollarSign } from "lucide-react";

import { useState } from "react";

function EconRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

export function ArosTokenRoi() {
  
  const [runningCalibration, setRunningCalibration] = useState(false);

  const { data: economics, isLoading, refetch } = trpc.arosTokenLedger.getEconomics.useQuery();
  const { data: byWorkflow } = trpc.arosTokenLedger.getByWorkflow.useQuery();
  const { data: calibration } = trpc.arosCalibration.getSummary.useQuery();

  const runCalibrationMutation = trpc.arosCalibration.runCalibration.useMutation({
    onSuccess: (result) => {
      setRunningCalibration(false);
      toast.success("Calibration Complete: ${result.records.length} metrics updated");
      refetch();
    },
    onError: (err) => {
      setRunningCalibration(false);
      toast.error(`Error: `);
    },
  });

  const generateInsightsMutation = trpc.arosCalibration.generateInsights.useMutation({
    onSuccess: (result) => {
      toast.success(`Calibration Insights: ${result.insights.slice(0, 100)}...`);
    },
    onError: (err) => toast.error(`Error: `),
  });

  const totalCost = economics?.totalCostUsd ?? 0;
  const totalTokens = economics?.totalTokens ?? 0;
  const tokenRoi = economics?.tokenRoi ?? 0;
  const revenue = economics?.revenueGeneratedUsd ?? 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Coins className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Token Economics & ROI</h1>
            </div>
            <p className="text-sm text-muted-foreground">Every token tracked. Every dollar attributed.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={runningCalibration}
              onClick={() => { setRunningCalibration(true); runCalibrationMutation.mutate(); }}
            >
              {runningCalibration ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Calibrating...</> : <><Target className="h-4 w-4 mr-1" /> Run Calibration</>}
            </Button>
          </div>
        </div>

        {/* Primary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Total AI Cost</p>
              <p className="text-2xl font-bold">${totalCost.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground">{totalTokens.toLocaleString()} tokens</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Revenue Generated</p>
              <p className="text-2xl font-bold">${revenue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Closed customers</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Token ROI</p>
              <p className="text-2xl font-bold">{tokenRoi > 0 ? `${tokenRoi.toFixed(0)}x` : "—"}</p>
              <p className="text-xs text-muted-foreground">Revenue / AI cost</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">Cost per Customer</p>
              <p className="text-2xl font-bold">
                {economics?.costPerCustomer ? `$${economics.costPerCustomer.toFixed(4)}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">AI compute only</p>
            </CardContent>
          </Card>
        </div>

        {/* Cost per Stage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4" /> Cost per Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <>
                  <EconRow
                    label="Cost per Opportunity"
                    value={economics?.costPerOpportunity ? `$${economics.costPerOpportunity.toFixed(6)}` : "—"}
                    sub="Discovery + scoring"
                  />
                  <EconRow
                    label="Cost per Intelligence Note"
                    value={economics?.costPerOutreach ? `$${economics.costPerOutreach.toFixed(6)}` : "—"}
                    sub="Decision note + executive brief + LinkedIn message"
                  />
                  <EconRow
                    label="Cost per Meeting"
                    value={economics?.costPerMeeting ? `$${economics.costPerMeeting.toFixed(4)}` : "—"}
                    sub="Full workflow to meeting"
                  />
                  <EconRow
                    label="Cost per Proposal"
                    value={economics?.costPerProposal ? `$${economics.costPerProposal.toFixed(4)}` : "—"}
                    sub="Full workflow to proposal"
                  />
                  <EconRow
                    label="Cost per Customer"
                    value={economics?.costPerCustomer ? `$${economics.costPerCustomer.toFixed(4)}` : "—"}
                    sub="Full workflow to close"
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* By Workflow */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Cost by Workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!byWorkflow?.length ? (
                <p className="text-sm text-muted-foreground">No workflow data yet.</p>
              ) : (
                <div className="space-y-2">
                  {byWorkflow.map(w => (
                    <div key={w.workflow} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize">{w.workflow.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{Number(w.runs).toLocaleString()} runs · {Number(w.totalTokens).toLocaleString()} tokens</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums">${Number(w.totalCost).toFixed(6)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calibration Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" /> Calibration Status
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => generateInsightsMutation.mutate()}
              >
                <Zap className="h-3 w-3 mr-1" /> AI Insights
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!calibration?.length ? (
              <p className="text-sm text-muted-foreground">Run calibration to compare predicted vs actual rates.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">Metric</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Predicted</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Actual</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Accuracy</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calibration.map(c => (
                      <tr key={c.metric} className="border-b last:border-0">
                        <td className="py-2 capitalize">{c.metric.replace(/_/g, " ")}</td>
                        <td className="py-2 text-right">{(c.predicted * 100).toFixed(1)}%</td>
                        <td className="py-2 text-right">{c.actual !== null ? `${(c.actual * 100).toFixed(1)}%` : "—"}</td>
                        <td className="py-2 text-right">{c.accuracy !== null ? `${c.accuracy.toFixed(0)}%` : "—"}</td>
                        <td className="py-2 text-right">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            c.status === "calibrated" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : c.status === "needs_adjustment" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-gray-100 text-gray-600"
                          }`}>
                            {c.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Value Summary */}
        {economics?.pipelineSummary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Pipeline Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Companies</p>
                  <p className="text-xl font-bold">{economics.pipelineSummary.companies}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Notes Delivered</p>
                  <p className="text-xl font-bold">{economics.pipelineSummary.outreach}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Meetings</p>
                  <p className="text-xl font-bold">{economics.pipelineSummary.meetings}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customers</p>
                  <p className="text-xl font-bold">{economics.pipelineSummary.customers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
