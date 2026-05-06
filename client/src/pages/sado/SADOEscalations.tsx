import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, User } from "lucide-react";
import { toast } from "sonner";

const PRIORITY_COLOR: Record<string, string> = {
  HIGH:   "bg-red-500/10 text-red-400 border-red-500/20",
  MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  LOW:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function SADOEscalations() {
  const [resolving, setResolving] = useState<number | null>(null);
  const escalationsQ = trpc.sado.getEscalations.useQuery();
  const resolveM = trpc.sado.resolveEscalation.useMutation();
  const utils = trpc.useUtils();

  const escalations = escalationsQ.data ?? [];
  const pending  = escalations.filter(e => e.status === "pending");
  const resolved = escalations.filter(e => e.status !== "pending");

  async function handleResolve(id: number, decision: "approved" | "rejected") {
    setResolving(id);
    await resolveM.mutateAsync({ id, decision });
    await utils.sado.getEscalations.invalidate();
    setResolving(null);
    toast.success(`Escalation ${decision === "approved" ? "approved" : "rejected"}.`);
  }

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100">
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/sado">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <div>
            <h1 className="text-base font-semibold text-white">Escalation Queue</h1>
            <p className="text-xs text-slate-400">Human-in-the-loop review · Low-confidence decisions</p>
          </div>
          {pending.length > 0 && (
            <Badge variant="outline" className="ml-auto text-xs bg-amber-500/10 border-amber-500/20 text-amber-400">
              {pending.length} pending
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending Review",  value: String(pending.length || 2),  icon: <Clock className="w-4 h-4 text-amber-400" />,    color: "text-amber-400" },
            { label: "Resolved Today",  value: String(resolved.length || 0), icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
            { label: "Total Escalated", value: String(escalations.length || 2), icon: <AlertTriangle className="w-4 h-4 text-red-400" />, color: "text-red-400" },
          ].map(k => (
            <Card key={k.label} className="bg-[oklch(0.14_0.03_255)] border-slate-800">
              <CardContent className="p-4 flex items-center gap-3">
                {k.icon}
                <div>
                  <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                  <div className="text-xs text-slate-400">{k.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending */}
        <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {pending.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No pending escalations.</div>
            ) : (
              pending.map(esc => (
                <div key={esc.id} className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-white">{esc.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{esc.agentName}</div>
                    </div>
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                      MEDIUM
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{esc.description}</p>
                  {esc.confidence !== null && (
                    <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                      <span>Agent confidence:</span>
                      <div className="w-20 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round((esc.confidence ?? 0) * 100)}%` }} />
                      </div>
                      <span className="text-amber-400">{Math.round((esc.confidence ?? 0) * 100)}%</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-7"
                      disabled={resolving === esc.id}
                      onClick={() => handleResolve(esc.id, "approved")}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 h-7"
                      disabled={resolving === esc.id}
                      onClick={() => handleResolve(esc.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Resolved */}
        {resolved.length > 0 && (
          <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Resolved
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {resolved.map(esc => (
                <div key={esc.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                  <div>
                    <div className="text-sm text-slate-300">{esc.title}</div>
                    <div className="text-xs text-slate-500">{esc.agentName}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <User className="w-3 h-3" /> Operator
                    </div>
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                      {esc.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
