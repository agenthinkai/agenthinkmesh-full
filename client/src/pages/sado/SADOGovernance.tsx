import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, XCircle, Globe } from "lucide-react";

const RULE_LABELS: Record<string, { label: string; jurisdiction: string; color: string }> = {
  PDPL_SA_ART29_001:          { label: "PDPL SA Art.29",     jurisdiction: "Saudi Arabia", color: "text-green-400" },
  CITRA_KW_DATA_RESIDENCY_001: { label: "CITRA KW Residency", jurisdiction: "Kuwait",       color: "text-blue-400" },
  INTERNAL_POLICY_001:         { label: "Internal Policy",    jurisdiction: "UAE",          color: "text-purple-400" },
};

export default function SADOGovernance() {
  const alertsQ = trpc.sado.getGovernanceAlerts.useQuery();
  const alerts = alertsQ.data ?? [];

  const intercepted = alerts.filter(a => a.action === "INTERCEPTED");
  const allowed     = alerts.filter(a => a.action === "ALLOWED");

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100">
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/sado">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <Shield className="w-5 h-5 text-blue-400" />
          <div>
            <h1 className="text-base font-semibold text-white">Governance Engine</h1>
            <p className="text-xs text-slate-400">GCC data residency · PDPL SA · CITRA KW · Transfer interception</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Transfers Evaluated", value: String(alerts.length || 3),          icon: <Globe className="w-4 h-4 text-blue-400" />,     color: "text-blue-400" },
            { label: "Blocked",             value: String(intercepted.length || 2),     icon: <XCircle className="w-4 h-4 text-red-400" />,    color: "text-red-400" },
            { label: "Allowed",             value: String(allowed.length || 1),         icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
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

        {/* Policy rules */}
        <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm text-slate-300">Active Policy Rules</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {Object.entries(RULE_LABELS).map(([id, rule]) => (
              <div key={id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                <div>
                  <div className={`text-sm font-medium ${rule.color}`}>{rule.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Rule ID: {id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-300">
                    {rule.jurisdiction}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                    Active
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Transfer events */}
        <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm text-slate-300">Transfer Events</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No transfer events yet. Run the demo from the Command Centre.
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => {
                  const isBlocked = alert.action === "INTERCEPTED";
                  const rule = RULE_LABELS[alert.ruleId ?? ""] ?? { label: alert.ruleId, jurisdiction: "—", color: "text-slate-400" };
                  return (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-lg border ${isBlocked ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isBlocked
                            ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            : <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                          <div>
                            <div className="text-sm font-medium text-white">
                              {alert.sourceCountry} → {alert.destinationCountry}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{alert.dataClassification}</div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${isBlocked ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}
                        >
                          {isBlocked ? "BLOCKED" : "ALLOWED"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span>Rule: <span className={rule.color}>{rule.label}</span></span>
                            <span>{new Date(alert.createdAt ?? 0).toLocaleTimeString()}</span>
                      </div>
                        {alert.description && (
                            <div className="mt-2 text-xs text-slate-400 bg-slate-900/50 rounded p-2">{alert.description}</div>
                        )}
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
