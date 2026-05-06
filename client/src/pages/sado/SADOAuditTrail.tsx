import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Lock, Activity, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  HIGH:   { color: "bg-red-500/10 text-red-400 border-red-500/20",       icon: <AlertTriangle className="w-3 h-3" /> },
  MEDIUM: { color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
  LOW:    { color: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: <Info className="w-3 h-3" /> },
  INFO:   { color: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: <Info className="w-3 h-3" /> },
};

const RESULT_ICON: Record<string, React.ReactNode> = {
  success:     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  escalated:   <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  intercepted: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  allowed:     <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />,
};

export default function SADOAuditTrail() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const auditQ = trpc.sado.getAuditTrail.useQuery({
    limit: 50,
    severityFilter: severityFilter !== "all" ? severityFilter : undefined,
    actionFilter: actionFilter !== "all" ? actionFilter : undefined,
  });
  const rows = auditQ.data ?? [];

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100">
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/sado">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <Lock className="w-5 h-5 text-blue-400" />
          <div>
            <h1 className="text-base font-semibold text-white">Audit Trail</h1>
            <p className="text-xs text-slate-400">Append-only · OpenTelemetry trace IDs · Immutable log</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-300">
              {rows.length} entries
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-[oklch(0.14_0.03_255)] border-slate-700 text-slate-300">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent className="bg-[oklch(0.14_0.03_255)] border-slate-700">
              {["all", "HIGH", "MEDIUM", "LOW", "INFO"].map(v => (
                <SelectItem key={v} value={v} className="text-xs text-slate-300">{v === "all" ? "All Severities" : v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-48 h-8 text-xs bg-[oklch(0.14_0.03_255)] border-slate-700 text-slate-300">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent className="bg-[oklch(0.14_0.03_255)] border-slate-700">
              {["all", "AGENT_STARTED", "SCHEMA_EXTRACTED", "ENTITY_MAPPED", "COLUMN_CLASSIFIED", "DRIFT_DETECTED", "REWRITE_GENERATED", "TRANSFER_INTERCEPTED", "TRANSFER_ALLOWED", "GRAPH_UPDATED", "ESCALATION_CREATED"].map(v => (
                <SelectItem key={v} value={v} className="text-xs text-slate-300">{v === "all" ? "All Actions" : v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Audit log */}
        <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Lock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No audit entries yet. Run the demo from the Command Centre.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {rows.map((row, i) => {
                  const sev = SEVERITY_CONFIG[row.severity ?? "INFO"] ?? SEVERITY_CONFIG.INFO;
                  return (
                    <div key={row.id ?? i} className="px-5 py-3 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                          {RESULT_ICON[row.result ?? "success"] ?? <Activity className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-200">{row.agentName}</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0 bg-slate-800 border-slate-700 text-slate-400">
                              {row.action}
                            </Badge>
                            <Badge variant="outline" className={`text-xs px-1.5 py-0 flex items-center gap-1 ${sev.color}`}>
                              {sev.icon} {row.severity}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">{row.entity}</div>
                          {row.details && (
                            <div className="text-xs text-slate-500 mt-1 leading-relaxed">{row.details}</div>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                            <span>{new Date(row.timestamp ?? 0).toLocaleString()}</span>
                            {row.traceId && <span className="font-mono">trace:{row.traceId}</span>}
                            {row.confidence !== null && <span>conf:{Math.round((row.confidence ?? 0) * 100)}%</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
