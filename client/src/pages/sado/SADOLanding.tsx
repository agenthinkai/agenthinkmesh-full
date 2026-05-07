import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Shield, Database,  GitBranch, FileCheck, ArrowRight, Lock, Users, Globe, BookLock, Briefcase, X, HelpCircle, Link2, Check, QrCode} from "lucide-react";
import ProspectQRDialog from "@/components/sado/ProspectQRDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useProspectMode, useProspectFromUrl, buildProspectQuery } from "@/hooks/useProspectMode";
import { useProspectCopyLink } from "@/hooks/useProspectCopyLink";
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
  const { copyState, copyLink: copyProspectLink } = useProspectCopyLink();
  const [qrOpen, setQrOpen] = useState(false);

   // Page title + meta description + Open Graph tags
  useEffect(() => {
    const prospectPart = prospect?.prospectName ? `${prospect.prospectName} · ` : "";
    const pageTitle = `SADO · ${prospectPart}Sovereign Autonomous Data Operations`;
    const pageDesc = "Sovereign Autonomous Data Operations for regulated GCC enterprise data engineering, governance, audit, and escalation workflows.";

    document.title = pageTitle;

    // Helper: upsert a <meta> tag by attribute selector
    function upsertMeta(attr: string, value: string, content: string): HTMLMetaElement {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${value}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, value);
        document.head.appendChild(el);
      }
      el.content = content;
      return el;
    }

    upsertMeta("name",     "description",    pageDesc);
    upsertMeta("property", "og:title",        pageTitle);
    upsertMeta("property", "og:description",  pageDesc);
    upsertMeta("property", "og:type",         "website");
    upsertMeta("property", "og:url",           window.location.href);
    upsertMeta("property", "og:image",         `${window.location.origin}/sado-og-preview.png`);
    upsertMeta("property", "og:image:alt",     "SADO — Sovereign Autonomous Data Operations");

    return () => {
      document.title = "AgenThinkMesh";
      ["meta[name=\"description\"]", "meta[property=\"og:title\"]",
       "meta[property=\"og:description\"]", "meta[property=\"og:type\"]",
       "meta[property=\"og:url\"]",
       "meta[property=\"og:image\"]",
       "meta[property=\"og:image:alt\"]"].forEach(sel => {
        document.querySelector(sel)?.remove();
      });
    };
  }, [prospect?.prospectName]);

  // Keyboard shortcut: P → open ProspectModal (same guard pattern as other SADO pages)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if ((e.target as HTMLElement).isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (prospect) return; // already active — header controls handle it
      e.preventDefault();
      setModalOpen(true);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prospect]);

  // Live status queries for pillar badges
  const { data: graphData, dataUpdatedAt: graphUpdatedAt, isFetching: graphFetching } = trpc.sado.getKnowledgeGraph.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: sources, dataUpdatedAt: sourcesUpdatedAt, isFetching: sourcesFetching } = trpc.sado.getSources.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: govAlerts, dataUpdatedAt: govUpdatedAt, isFetching: govFetching } = trpc.sado.getGovernanceAlerts.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: escalations, dataUpdatedAt: escalationsUpdatedAt, isFetching: escalationsFetching } = trpc.sado.getEscalations.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: auditRows, dataUpdatedAt: auditUpdatedAt, isFetching: auditFetching } = trpc.sado.getAuditTrail.useQuery({ limit: 200 }, { refetchInterval: 30_000 });

  // Derive the latest successful refresh timestamp across all live queries
  const latestRefresh = Math.max(
    graphUpdatedAt ?? 0,
    sourcesUpdatedAt ?? 0,
    govUpdatedAt ?? 0,
    escalationsUpdatedAt ?? 0,
    auditUpdatedAt ?? 0,
  ) || null;

  // Relative time label — recalculated every 30 s so it stays current without a reload
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const relativeTime = (ts: number | null): string => {
    if (!ts) return "";
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "Updated just now";
    if (mins === 1) return "Updated 1 min ago";
    return `Updated ${mins} min ago`;
  };

  const graphNodeCount = graphData?.nodes?.length ?? null;
  const graphEdgeCount = graphData?.edges?.length ?? null;
  const sourcesCount = sources?.length ?? null;
  const pendingCount = escalations?.filter(e => e.status === "pending").length ?? null;
  const auditCount = auditRows?.length ?? null;
  const govAlertsCount = govAlerts?.length ?? null;

  const PILLAR_BADGES: Record<string, string | null | undefined> = {
    // null  → data loading (show "Live status" fallback)
    // undefined → data loaded but count is zero (hide badge entirely)
    // string → show badge with live count
    "Discovery Layer":
      sourcesCount === null ? null
        : sourcesCount > 0 ? `${sourcesCount} source${sourcesCount !== 1 ? "s" : ""} scanned`
        : undefined,
    "Knowledge Graph":
      graphNodeCount === null ? null
        : graphNodeCount > 0 ? `${graphNodeCount} node${graphNodeCount !== 1 ? "s" : ""} · ${graphEdgeCount ?? 0} edge${(graphEdgeCount ?? 0) !== 1 ? "s" : ""}`
        : undefined,
    "Governance Engine":
      govAlertsCount === null ? null
        : govAlertsCount > 0 ? `${govAlertsCount} transfer${govAlertsCount !== 1 ? "s" : ""} evaluated`
        : undefined,
    "Audit & Escalation Control":
      pendingCount === null && auditCount === null ? null
        : (pendingCount ?? 0) > 0 || (auditCount ?? 0) > 0
          ? `${pendingCount ?? 0} pending · ${auditCount ?? 0} entries`
          : undefined,
  };
  // Per-pillar background refetch indicator
  const PILLAR_FETCHING: Record<string, boolean> = {
    "Discovery Layer": sourcesFetching,
    "Knowledge Graph": graphFetching,
    "Governance Engine": govFetching,
    "Audit & Escalation Control": escalationsFetching || auditFetching,
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

            {/* Prospect mode controls + shortcut legend */}
            <div className="flex items-center gap-2">
              {!prospect && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-300 bg-white/60 text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-white transition-colors"
                      title="Keyboard shortcuts"
                      aria-label="Keyboard shortcuts"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    className="w-60 p-0 bg-white border border-slate-200 shadow-lg rounded-lg overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase">Keyboard Shortcuts</span>
                    </div>
                    <div className="px-3 py-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Personalise for prospect</span>
                        <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-50 text-slate-600 font-mono text-[10px]">P</kbd>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/60">
                      <span className="text-[9px] text-slate-400">Shortcuts disabled while typing or dialogs are open</span>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
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
                    onClick={copyProspectLink}
                    title="Copy shareable prospect link"
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {copyState === "copied" ? (
                      <><Check className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">Copied</span></>
                    ) : copyState === "failed" ? (
                      <><Link2 className="w-3 h-3" /><span className="text-red-400">Copy failed</span></>
                    ) : (
                      <><Link2 className="w-3 h-3" /><span>Copy link</span></>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrOpen(true)}
                    title="Show QR code for this prospect link"
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Show QR</span>
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

          {/* QR dialog — rendered outside the ternary so JSX stays valid */}
          <ProspectQRDialog
            open={qrOpen}
            onClose={() => setQrOpen(false)}
            prospectName={prospect?.prospectName ?? ""}
            prospectOrg={prospect?.organization}
            qrValue={window.location.href}
            copyState={copyState}
            onCopy={copyProspectLink}
          />

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

          {/* Prospect Mode quick-launch */}
          {!prospect && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors underline-offset-2 hover:underline"
            >
              Personalise for prospect →
              <kbd className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-mono border border-slate-300 text-slate-400 bg-transparent leading-none">[P]</kbd>
            </button>
          )}
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
          {latestRefresh ? (
            <p className="text-xs text-muted-foreground mt-1">{relativeTime(latestRefresh)}</p>
          ) : null}
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
                      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-white/80 border border-border px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {PILLAR_FETCHING[title] && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" title="Refreshing…" />
                        )}
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

      {/* Consensus Governance Engine */}
      <div className="border-t border-border bg-[oklch(0.10_0.02_255)]">
        <div className="max-w-5xl mx-auto px-6 py-14">

          {/* Section header */}
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400/70 mb-1">
              Strategic Governance Layer
            </p>
            <h2 className="text-2xl font-bold text-white">Consensus Governance Engine</h2>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
              High-risk data decisions are evaluated by a council of ten specialist AI agents before
              enforcement. Each agent contributes an independent perspective — from legal residency
              to red-team challenge — and the council reaches a weighted consensus before any
              transfer is approved, blocked, or escalated.
            </p>
            <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full border border-amber-500/25 bg-amber-500/8 text-xs text-amber-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 inline-block" />
              Strategic layer — architecture preview
            </span>
          </div>

          {/* Decision flow */}
          <div className="flex flex-wrap items-center gap-2 mb-10">
            {([
              { label: "Data Event",        color: "border-slate-700 bg-slate-800/60 text-slate-300" },
              { label: "→",                 color: "text-slate-600",                                  arrow: true },
              { label: "10-Agent Review",   color: "border-blue-500/30 bg-blue-500/8 text-blue-300" },
              { label: "→",                 color: "text-slate-600",                                  arrow: true },
              { label: "Consensus Decision",color: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300" },
              { label: "→",                 color: "text-slate-600",                                  arrow: true },
              { label: "Audit Evidence",    color: "border-violet-500/30 bg-violet-500/8 text-violet-300" },
            ] as { label: string; color: string; arrow?: boolean }[]).map(({ label, color, arrow }, i) =>
              arrow ? (
                <span key={i} className={`text-lg font-light ${color}`}>{label}</span>
              ) : (
                <span key={i} className={`px-3 py-1 rounded-lg border text-xs font-semibold tracking-wide ${color}`}>
                  {label}
                </span>
              )
            )}
          </div>

          {/* Agent chips grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {([
              { num: "01", name: "Data Residency Judge",      icon: "⚖",  accent: "border-blue-500/25   bg-blue-500/6   text-blue-300"    },
              { num: "02", name: "Privacy Officer",           icon: "🔒", accent: "border-violet-500/25 bg-violet-500/6 text-violet-300"  },
              { num: "03", name: "Security Architect",        icon: "🛡",  accent: "border-slate-500/25  bg-slate-500/6  text-slate-300"   },
              { num: "04", name: "Compliance Counsel",        icon: "📋", accent: "border-emerald-500/25 bg-emerald-500/6 text-emerald-300" },
              { num: "05", name: "Risk Quant",                icon: "📊", accent: "border-amber-500/25  bg-amber-500/6  text-amber-300"   },
              { num: "06", name: "Cloud Sovereignty Analyst", icon: "☁",  accent: "border-cyan-500/25   bg-cyan-500/6   text-cyan-300"    },
              { num: "07", name: "Lineage Auditor",           icon: "🔗", accent: "border-indigo-500/25 bg-indigo-500/6 text-indigo-300"  },
              { num: "08", name: "Business Impact Assessor", icon: "💼", accent: "border-orange-500/25 bg-orange-500/6 text-orange-300"  },
              { num: "09", name: "Red-Team Challenger",       icon: "⚡", accent: "border-red-500/25    bg-red-500/6    text-red-300"     },
              { num: "10", name: "Final Arbiter",             icon: "✦",  accent: "border-yellow-500/25 bg-yellow-500/6 text-yellow-300"  },
            ] as { num: string; name: string; icon: string; accent: string }[]).map(({ num, name, icon, accent }) => (
              <div
                key={num}
                className={`rounded-xl border ${accent} p-3.5 flex flex-col gap-1.5 select-none`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tabular-nums text-slate-600">{num}</span>
                  <span className="text-base leading-none" role="img" aria-label={name}>{icon}</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-200 leading-snug">{name}</p>
              </div>
            ))}
          </div>

          {/* Footer note + CTA */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              Each agent votes independently. The Final Arbiter synthesises all ten perspectives into
              a single enforceable decision with a full rationale chain written to the audit trail.
            </p>
            <Link href={`/sado/consensus${buildProspectQuery(prospect)}`}>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-500/30 bg-blue-500/8 text-xs font-semibold text-blue-300 hover:text-blue-200 hover:border-blue-500/50 transition-colors flex-shrink-0">
                Explore the council
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
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
