import { toast } from "sonner";
/**
 * InfraSimDashboard.tsx
 * Governed Infrastructure Stress Simulation v2 — Main Dashboard
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Activity,
  BarChart3,
  ChevronRight,
  Clock,
  Cpu,
  Layers,
  Plus,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "APPROVE")
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-mono">APPROVE</Badge>;
  if (decision === "CONDITIONAL")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-mono">CONDITIONAL</Badge>;
  if (decision === "PENDING")
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs font-mono">PENDING</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-mono">REJECT</Badge>;
}

export default function InfraSimDashboard() {
  const [, navigate] = useLocation();

  const { data: cases, isLoading, refetch } = trpc.infraSim.listCases.useQuery();

  const seedHelios = trpc.infraSim.seedHeliosNorth.useMutation({
    onSuccess: (data) => {
      if (data.alreadyExists) {
        toast.success("Helios-North already loaded: Opening existing case");
      } else {
        toast.success("Helios-North loaded: IC Memo seeded from PDF");
      }
      refetch();
      navigate(`/infra-sim/case/${data.caseId}`);
    },
    onError: (e) => toast.error(`Failed to seed: ${e.message}`),
  });

  return (
    <div className="min-h-screen bg-[#0B1629] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d1a2e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h1 className="text-base font-bold text-white">Infrastructure Stress Simulation</h1>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">v2</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Governed consensus infrastructure · Monte Carlo IRR · Council of 10 deliberation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-slate-300 hover:bg-white/5 text-xs gap-1.5"
              disabled={seedHelios.isPending}
              onClick={() => seedHelios.mutate()}
            >
              {seedHelios.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Load Helios-North Demo
                </>
              )}
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
              onClick={() => navigate("/infra-sim/new")}
            >
              <Plus className="w-3.5 h-3.5" />
              New Case
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Feature Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: <Cpu className="w-4 h-4 text-blue-400" />, label: "Monte Carlo Engine", desc: "Up to 90k scenarios" },
            { icon: <Shield className="w-4 h-4 text-emerald-400" />, label: "Council of 10", desc: "5-round deliberation" },
            { icon: <Activity className="w-4 h-4 text-amber-400" />, label: "Continuous Monitoring", desc: "Thesis integrity tracking" },
            { icon: <Layers className="w-4 h-4 text-purple-400" />, label: "Portfolio Contagion", desc: "Cross-deal dependency" },
          ].map(({ icon, label, desc }) => (
            <Card key={label} className="bg-[#0d1a2e] border-white/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {icon}
                  <span className="text-xs font-semibold text-white">{label}</span>
                </div>
                <p className="text-xs text-slate-500">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cases List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Simulation Cases</h2>
            <span className="text-xs text-slate-500 font-mono">{cases?.length ?? 0} cases</span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-white/3 animate-pulse" />
              ))}
            </div>
          ) : !cases || cases.length === 0 ? (
            <Card className="bg-[#0d1a2e] border-dashed border-white/10">
              <CardContent className="p-12 text-center">
                <BarChart3 className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                <p className="text-sm font-semibold text-slate-400 mb-2">No simulation cases yet</p>
                <p className="text-xs text-slate-600 mb-6 max-w-sm mx-auto">
                  Load the Helios-North demo case from the IC Memo, or create a new case from scratch.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs gap-1.5"
                    disabled={seedHelios.isPending}
                    onClick={() => seedHelios.mutate()}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Load Helios-North Demo
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5"
                    onClick={() => navigate("/infra-sim/new")}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Case
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            cases.map((c: any) => (
              <div
                key={c.id}
                className="group rounded-xl border border-white/5 bg-[#0d1a2e] hover:border-blue-500/30 hover:bg-[#0f1e35] transition-all cursor-pointer p-5"
                onClick={() => navigate(`/infra-sim/case/${c.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">{c.title}</h3>
                      <DecisionBadge decision={c.icDecision ?? "PENDING"} />
                      {c.monitoringActive && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs gap-1">
                          <Activity className="w-2.5 h-2.5" />
                          Monitoring
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                      <span>{c.assetClass}</span>
                      {c.geography && <><span>·</span><span>{c.geography}</span></>}
                      {c.totalCapexGbpM && <><span>·</span><span>£{parseFloat(c.totalCapexGbpM).toLocaleString()}M</span></>}
                      <span>·</span>
                      <span>Base IRR {parseFloat(c.baseIrrPct ?? "0").toFixed(1)}%</span>
                      <span>·</span>
                      <span>Fund min {parseFloat(c.fundMinIrrPct ?? "15").toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-slate-600 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(c.createdAt ?? Date.now()).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{c.status}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
