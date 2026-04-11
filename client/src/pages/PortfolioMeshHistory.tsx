/**
 * PortfolioMesh History — list of all past allocation runs
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
            <p className="text-slate-400 text-sm">All your past allocation runs</p>
          </div>
          <Button onClick={() => navigate("/portfolio-mesh")} className="bg-blue-600 hover:bg-blue-500 text-white">
            + New Run
          </Button>
        </div>

        {isLoading && (
          <div className="text-center py-16 text-slate-500">Loading runs…</div>
        )}

        {!isLoading && (!runs || runs.length === 0) && (
          <div className="text-center py-16">
            <p className="text-slate-500 mb-4">No runs yet. Start your first allocation run.</p>
            <Button onClick={() => navigate("/portfolio-mesh")} className="bg-blue-600 hover:bg-blue-500 text-white">
              Start First Run
            </Button>
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
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-200 font-medium text-sm truncate">{run.ipsName}</span>
                      <Badge className={`text-xs ${statusColor(run.status)}`}>{run.status}</Badge>
                      {run.ipsCompliant !== null && (
                        <Badge className={`text-xs ${run.ipsCompliant ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30" : "bg-red-600/20 text-red-300 border-red-500/30"}`}>
                          {run.ipsCompliant ? "IPS ✓" : "IPS ✗"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {run.macroRegime && <span className="capitalize">Regime: {run.macroRegime}</span>}
                      {run.cioExpectedReturn !== null && (
                        <span className="text-emerald-400">Return: {(run.cioExpectedReturn * 100).toFixed(2)}%</span>
                      )}
                      {run.cioExpectedVolatility !== null && (
                        <span className="text-amber-400">Vol: {(run.cioExpectedVolatility * 100).toFixed(2)}%</span>
                      )}
                      {run.cioSharpe !== null && (
                        <span className="text-blue-400">Sharpe: {run.cioSharpe.toFixed(3)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 shrink-0">
                    {new Date(run.createdAt).toLocaleDateString()}
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
