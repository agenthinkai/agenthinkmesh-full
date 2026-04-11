/**
 * PortfolioMesh History — list of all past allocation runs
 * Upgraded: benchmark badge, expected return, volatility, Sharpe, memo link
 */
import { useLocation } from "wouter";
import SiteNav from "@/components/SiteNav";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function statusColor(status: string) {
  if (status === "complete") return "bg-emerald-600/20 text-emerald-300 border-emerald-500/30";
  if (status === "error")    return "bg-red-600/20    text-red-300    border-red-500/30";
  return "bg-amber-600/20 text-amber-300 border-amber-500/30";
}

export default function PortfolioMeshHistory() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: runs, isLoading } = trpc.portfolioMesh.listRuns.useQuery(undefined, { enabled: !!user });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <SiteNav />
        <p className="text-slate-400 mt-20">Please sign in to view history.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1629] text-slate-100">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 py-8 pt-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 mb-1">PortfolioMesh History</h1>
            <p className="text-slate-400 text-sm">All past allocation runs — click any row to view the full CIO memo</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/portfolio-mesh/demo")}
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              ⚡ Demo
            </Button>
            <Button onClick={() => navigate("/portfolio-mesh")} className="bg-blue-600 hover:bg-blue-500 text-white">
              + New Run
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-16 text-slate-500">Loading runs…</div>
        )}

        {!isLoading && (!runs || runs.length === 0) && (
          <div className="text-center py-16">
            <p className="text-slate-500 mb-4">No runs yet. Start your first allocation run.</p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/portfolio-mesh/demo")}
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              >
                ⚡ Try Demo Mode
              </Button>
              <Button onClick={() => navigate("/portfolio-mesh")} className="bg-blue-600 hover:bg-blue-500 text-white">
                Start First Run
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {runs?.map(run => (
            <Card
              key={run.id}
              className="bg-slate-900/60 border-white/10 hover:border-white/20 transition-all cursor-pointer"
              onClick={() => navigate(`/portfolio-mesh/run/${run.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Name + status badges */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-slate-200 font-medium text-sm truncate">{run.ipsName}</span>
                      <Badge className={`text-xs ${statusColor(run.status)}`}>{run.status}</Badge>
                      {run.ipsCompliant !== null && (
                        <Badge className={`text-xs ${run.ipsCompliant ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30" : "bg-red-600/20 text-red-300 border-red-500/30"}`}>
                          {run.ipsCompliant ? "IPS ✓" : "IPS ✗"}
                        </Badge>
                      )}
                      {run.isBenchmark && (
                        <Badge className="text-xs bg-violet-600/20 text-violet-300 border-violet-500/30">
                          ◉ {run.benchmarkLabel ?? "Benchmark"}
                        </Badge>
                      )}
                      {run.hasMemo && (
                        <Badge className="text-xs bg-blue-600/20 text-blue-300 border-blue-500/30">
                          Board Memo
                        </Badge>
                      )}
                    </div>

                    {/* Row 2: Key metrics */}
                    <div className="flex items-center gap-4 text-xs flex-wrap">
                      {run.macroRegime && (
                        <span className="text-slate-500 capitalize">
                          Regime: <span className="text-slate-300">{run.macroRegime}</span>
                        </span>
                      )}
                      {run.cioExpectedReturn !== null && (
                        <span className="text-emerald-400 font-medium">
                          Return: {(run.cioExpectedReturn * 100).toFixed(2)}%
                        </span>
                      )}
                      {run.cioExpectedVolatility !== null && (
                        <span className="text-amber-400 font-medium">
                          Vol: {(run.cioExpectedVolatility * 100).toFixed(2)}%
                        </span>
                      )}
                      {run.cioSharpe !== null && (
                        <span className="text-blue-400 font-medium">
                          Sharpe: {run.cioSharpe.toFixed(3)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: date + memo link */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-slate-500">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </span>
                    {run.hasMemo && (
                      <span
                        className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                        onClick={e => { e.stopPropagation(); navigate(`/portfolio-mesh/run/${run.id}`); }}
                      >
                        View Memo →
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
