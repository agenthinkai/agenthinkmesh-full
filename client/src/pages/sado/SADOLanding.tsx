import { useState } from "react";
import { Link } from "wouter";
import { Shield, Database, GitBranch, FileCheck, ArrowRight, Lock, Users, Globe, BookLock, Briefcase, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProspectMode, useProspectFromUrl, buildProspectQuery } from "@/hooks/useProspectMode";
import ProspectModal from "@/components/sado/ProspectModal";
import { trpc } from "@/lib/trpc";

const PILLARS = [
  {
    icon: Database,
    title: "Discovery Layer",
    description:
      "MCP-compatible connectors scan source systems — ERP, CRM, data warehouses — and automatically extract schemas, classify columns, and detect PII across your enterprise data estate.",
    href: "/sado/discovery",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  {
    icon: GitBranch,
    title: "Knowledge Graph",
    description:
      "Discovered entities and relationships are mapped into a live semantic graph. Source systems, business entities, and sensitive data fields are linked and queryable in real time.",
    href: "/sado/knowledge-graph",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
  {
    icon: Globe,
    title: "Governance Engine",
    description:
      "A GCC-native policy engine enforces PDPL, CITRA, and NESA residency rules. Cross-border data transfers are intercepted, logged, and escalated before they leave the jurisdiction.",
    href: "/sado/governance",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  {
    icon: FileCheck,
    title: "Audit & Escalation Control",
    description:
      "Every agent action, governance decision, and schema change is written to an append-only audit trail. Escalations surface in a human-reviewed queue with confidence scoring.",
    href: "/sado/audit-trail",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
];

const SAFETY_BADGES = [
  { icon: Lock, label: "Read-only source access" },
  { icon: Users, label: "Human-in-the-loop approvals" },
  { icon: Globe, label: "GCC residency policy engine" },
  { icon: BookLock, label: "Append-only audit trail" },
];

export default function SADOLanding() {
  useProspectFromUrl();
  const { prospect, displayLabel, saveProspect, clearProspect } = useProspectMode();
  const [modalOpen, setModalOpen] = useState(false);

  // Live status queries for pillar badges
  const { data: sources } = trpc.sado.getSources.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: govAlerts } = trpc.sado.getGovernanceAlerts.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: escalations } = trpc.sado.getEscalations.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: auditRows } = trpc.sado.getAuditTrail.useQuery({ limit: 200 }, { refetchInterval: 30_000 });

  const sourcesCount = sources?.length ?? null;
  const pendingCount = escalations?.filter(e => e.status === "pending").length ?? null;
  const auditCount = auditRows?.length ?? null;
  const govAlertsCount = govAlerts?.length ?? null;

  const PILLAR_BADGES: Record<string, string | null | undefined> = {
    "Discovery Layer":
      sourcesCount !== null ? `${sourcesCount} source${sourcesCount !== 1 ? "s" : ""} scanned` : null,
    "Knowledge Graph": undefined, // no live count
    "Governance Engine":
      govAlertsCount !== null ? `${govAlertsCount} transfer${govAlertsCount !== 1 ? "s" : ""} evaluated` : null,
    "Audit & Escalation Control":
      pendingCount !== null
        ? `${pendingCount} pending · ${auditCount ?? "…"} entries`
        : null,
  };

  return (
    <div className="min-h-screen bg-background">
      <ProspectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        current={prospect}
        onSave={saveProspect}
        onClear={clearProspect}
      />

      {/* Hero */}
      <div className="border-b border-border bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="max-w-5xl mx-auto px-6 py-16">
          {/* Product badge row */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold tracking-wide uppercase">
                <Shield className="w-3 h-3" />
                SADO · Phase A
              </div>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Enterprise MVP
              </Badge>
            </div>

            {/* Prospect mode controls */}
            <div className="flex items-center gap-2">
              {prospect ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/40 border border-blue-500/30 text-blue-300 text-xs font-medium">
                    <Shield className="w-3 h-3 text-blue-400" />
                    Prospect Mode · {prospect.prospectName}{prospect.organization && prospect.organization !== prospect.prospectName ? ` · ${prospect.organization}` : ""}
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={clearProspect}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                    title="Clear Prospect Mode"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  className="gap-1.5 text-xs border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-700 bg-white"
                >
                  <Briefcase className="w-3 h-3" />
                  Prepare for Prospect
                </Button>
              )}
            </div>
          </div>

          <h1 className="text-4xl font-bold text-foreground tracking-tight mb-4 leading-tight">
            Sovereign Autonomous<br />
            <span className="text-blue-600">Data Operations</span>
          </h1>

          {/* Prospect tagline or default subtitle */}
          {prospect?.tagline ? (
            <p className="text-base text-blue-700 font-medium mb-2">{prospect.tagline}</p>
          ) : null}
          <p className="text-lg text-muted-foreground max-w-2xl mb-8 leading-relaxed">
            GCC-native AI readiness, data governance, and autonomous data operations platform.
            Discover your data estate, enforce residency policy, and maintain a complete audit trail —
            without exposing source systems or bypassing human oversight.
          </p>

          {/* Safety badges */}
          <div className="flex flex-wrap gap-2 mb-10">
            {SAFETY_BADGES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-border text-sm text-foreground shadow-sm"
              >
                <Icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <Link href={`/sado/command-centre${buildProspectQuery(prospect)}`}>
              <Button size="lg" className="gap-2">
                Start Demo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href={`/sado/audit-trail${buildProspectQuery(prospect)}`}>
              <Button size="lg" variant="outline" className="gap-2 bg-white">
                View Audit Trail
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* What to Expect */}
      <div className="border-b border-border bg-slate-50/60">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Demo walkthrough
            </p>
            <h2 className="text-2xl font-bold text-foreground">What to expect</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {([
              {
                step: "01",
                title: "Run Demo",
                description: "Watch the agent mesh discover systems, classify risk, and trigger governance checks.",
                href: "/sado/command-centre",
                accent: "border-blue-200 bg-white",
                numColor: "text-blue-500",
              },
              {
                step: "02",
                title: "Explore Governance",
                description: "Review residency rules, transfer controls, override requests, and escalation paths.",
                href: "/sado/governance",
                accent: "border-emerald-200 bg-white",
                numColor: "text-emerald-600",
              },
              {
                step: "03",
                title: "Export Audit Report",
                description: "Generate an executive or CISO-ready PDF showing the full compliance trail.",
                href: "/sado/audit-trail",
                accent: "border-amber-200 bg-white",
                numColor: "text-amber-600",
              },
            ] as const).map(({ step, title, description, href, accent, numColor }) => (
              <Link key={step} href={`${href}${buildProspectQuery(prospect)}`}>
                <div className={`group rounded-xl border ${accent} p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 h-full`}>
                  <div className={`text-3xl font-bold tabular-nums mb-3 ${numColor} opacity-60`}>{step}</div>
                  <h3 className="font-semibold text-foreground mb-2 text-base">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                  <div className={`flex items-center gap-1 mt-4 text-xs font-medium ${numColor} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Go <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Capability Pillars */}
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Platform Capabilities
          </p>
          <h2 className="text-2xl font-bold text-foreground">Four capability pillars</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PILLARS.map(({ icon: Icon, title, description, href, color, bg, border }) => {
            const badge = PILLAR_BADGES[title];
            return (
              <Link key={title} href={`${href}${buildProspectQuery(prospect)}`}>
                <div
                  className={`group rounded-xl border ${border} ${bg} p-6 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white border ${border} shadow-sm`}>
                      <Icon className={`w-5 h-5 ${color}`} />
                    </div>
                    {badge !== undefined && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-white/80 border border-border px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {badge ?? "Live status"}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-base">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                  <div className={`flex items-center gap-1 mt-4 text-xs font-medium ${color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Explore <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Architecture note */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="rounded-xl border border-border bg-slate-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center shadow-sm">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1 text-sm">Sovereign-ready architecture</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                SADO is designed for GCC enterprise deployment. All agent activity is logged, all governance
                decisions are explainable, and all source system access is read-only. The platform is
                deployable on-premises or in a sovereign cloud region with no dependency on external AI APIs
                in production mode.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {["Python · FastAPI", "PostgreSQL · Neo4j", "OpenTelemetry", "MCP connectors", "Kubernetes-ready"].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded bg-white border border-border text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
