import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TwinInstance {
  id: number;
  displayName: string;
  industry?: string | null;
  geography?: string | null;
  governanceProfile: string;
  status: string;
  runCount: number;
  blueprintId: string;
  createdAt: string | Date;
}

// ─── Governance badge ─────────────────────────────────────────────────────────
function GovBadge({ profile }: { profile: string }) {
  const colors: Record<string, string> = {
    STANDARD: "bg-slate-700 text-slate-200",
    CONFIDENTIAL: "bg-amber-900 text-amber-200",
    SOVEREIGN: "bg-emerald-900 text-emerald-200",
    CLASSIFIED: "bg-red-900 text-red-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${colors[profile] ?? "bg-slate-700 text-slate-200"}`}>
      {profile}
    </span>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-400",
    provisioning: "bg-amber-400 animate-pulse",
    suspended: "bg-red-400",
    archived: "bg-slate-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${colors[status] ?? "bg-slate-400"}`} />;
}

// ─── Twin Card ────────────────────────────────────────────────────────────────
function TwinCard({ twin }: { twin: TwinInstance }) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/60 hover:bg-slate-800 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-white text-sm">{twin.displayName}</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {twin.industry ?? "—"} · {twin.geography ?? "—"}
          </p>
        </div>
        <GovBadge profile={twin.governanceProfile} />
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center text-xs text-slate-400">
          <StatusDot status={twin.status} />
          <span className="capitalize">{twin.status}</span>
        </div>
        <span className="text-xs text-slate-500">{twin.runCount} sessions</span>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
        <Button size="sm" variant="outline" className="text-xs h-7 flex-1 border-slate-600 text-slate-300 hover:text-white">
          Run
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7 flex-1 border-slate-600 text-slate-300 hover:text-white">
          Simulate
        </Button>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/60">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EnterpriseDashboard() {
  const { user } = useAuth();
  const orgId = 1; // Default org — in production this comes from user's org membership

  const { data: stats } = trpc.enterprise.getStats.useQuery({ orgId });
  const { data: twins, isLoading } = trpc.enterprise.listTwinInstances.useQuery({ orgId });
  const { data: blueprints } = trpc.twinFactory.blueprints.list.useQuery({});
  const { data: auditLog } = trpc.enterprise.listAuditLog.useQuery({ orgId, limit: 10 });

  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filteredTwins = (twins ?? []).filter((t: TwinInstance) =>
    activeFilter === "all" ? true : t.status === activeFilter
  );

  const blueprintMap = new Map((blueprints ?? []).map((b: { blueprintId: string; name: string }) => [b.blueprintId, b.name]));

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/95 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Enterprise Decision Twin Platform</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {user?.name ?? "Admin"} · Sovereign Operations Mode
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/twin-generator">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                + New Twin
              </Button>
            </Link>
            <Link href="/admin/twin-marketplace">
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:text-white text-xs">
                Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Active Twins"
            value={stats?.activeTwins ?? "—"}
            sub="Deployed & running"
            accent="text-emerald-400"
          />
          <StatCard
            label="Total Sessions"
            value={stats?.totalSessions ?? "—"}
            sub="All time"
            accent="text-indigo-400"
          />
          <StatCard
            label="Team Members"
            value={stats?.totalMembers ?? "—"}
            sub="Across all roles"
            accent="text-amber-400"
          />
          <StatCard
            label="Pending Messages"
            value={stats?.pendingMessages ?? "—"}
            sub="Inter-twin signals"
            accent="text-red-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Twin Directory */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Twin Directory</h2>
              <div className="flex gap-1">
                {["all", "active", "provisioning", "suspended"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      activeFilter === f
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredTwins.length === 0 ? (
              <div className="border border-dashed border-slate-700 rounded-lg p-12 text-center">
                <p className="text-slate-500 text-sm mb-3">No twins deployed yet</p>
                <Link href="/admin/twin-generator">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                    Create your first Twin
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTwins.map((twin: TwinInstance) => (
                  <TwinCard key={twin.id} twin={twin} />
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Available Blueprints */}
            <div>
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3">
                Available Blueprints
              </h2>
              <div className="space-y-2">
                {(blueprints ?? []).slice(0, 6).map((bp: { blueprintId: string; name: string; industry?: string }) => (
                  <div
                    key={bp.blueprintId}
                    className="flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700 rounded"
                  >
                    <div>
                      <p className="text-xs font-medium text-white">{bp.name}</p>
                      <p className="text-xs text-slate-500">{bp.industry ?? "General"}</p>
                    </div>
                    <Link href="/admin/twin-generator">
                      <button className="text-xs text-indigo-400 hover:text-indigo-300">Deploy →</button>
                    </Link>
                  </div>
                ))}
                {(blueprints ?? []).length === 0 && (
                  <p className="text-slate-500 text-xs">No blueprints registered yet.</p>
                )}
              </div>
            </div>

            {/* Audit Log */}
            <div>
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3">
                Recent Activity
              </h2>
              <div className="space-y-1.5">
                {(auditLog ?? []).slice(0, 8).map((entry: { id: number; action: string; resourceType: string; severity: string; createdAt: string | Date }) => (
                  <div key={entry.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        entry.severity === "critical"
                          ? "bg-red-400"
                          : entry.severity === "warning"
                          ? "bg-amber-400"
                          : "bg-slate-500"
                      }`}
                    />
                    <div>
                      <span className="text-slate-300">{entry.action}</span>
                      <span className="text-slate-600 ml-1">· {entry.resourceType}</span>
                    </div>
                  </div>
                ))}
                {(auditLog ?? []).length === 0 && (
                  <p className="text-slate-500 text-xs">No activity recorded yet.</p>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3">
                Platform Links
              </h2>
              <div className="space-y-1.5">
                {[
                  { label: "Twin Generator Wizard", href: "/admin/twin-generator" },
                  { label: "Blueprint Marketplace", href: "/admin/twin-marketplace" },
                  { label: "Registry Admin", href: "/admin/registry" },
                  { label: "SAMI Defense Demo", href: "/sami-demo" },
                  { label: "Alghanim Industrial Demo", href: "/alghanim-industrial-demo" },
                  { label: "Floward E-Commerce Demo", href: "/floward-demo" },
                  { label: "UIC Financial Demo", href: "/uic-demo" },
                  { label: "Legal Case Twin Demo", href: "/legal-demo" },
                ].map((link) => (
                  <Link key={link.href} href={link.href}>
                    <div className="flex items-center justify-between p-2 rounded hover:bg-slate-800 transition-colors cursor-pointer">
                      <span className="text-xs text-slate-400 hover:text-white">{link.label}</span>
                      <span className="text-slate-600 text-xs">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
