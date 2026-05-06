/**
 * SADOGovernance.tsx — SADO Phase A.5
 *
 * Governance Policy Detail View:
 *  - Static policy cards (PDPL SA, CITRA KW, NESA, Internal Policy)
 *  - Live transfer events from DB (seeded by runDemoCycle)
 *  - Visual hierarchy: ALLOWED (calm/green), INTERCEPTED (serious/red), ESCALATED (amber)
 *  - Request Override CTA → creates escalation + audit trail entry via sado.requestOverride
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  FileText,
  Clock,
  ArrowRight,
  Info,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useProspectMode, useProspectFromUrl } from "@/hooks/useProspectMode";

// ── Static policy definitions ─────────────────────────────────────────────────
// These represent the governance framework — independent of live transfer events.
const POLICY_CARDS = [
  {
    id: "PDPL_SA_ART29_001",
    name: "PDPL SA — Article 29",
    regulation: "Saudi Personal Data Protection Law",
    jurisdiction: "SA",
    jurisdictionLabel: "Saudi Arabia",
    jurisdictionColor: "bg-green-500/15 text-green-400 border-green-500/25",
    classificationsCovered: ["PII", "SENSITIVE"],
    action: "INTERCEPT" as const,
    summary:
      "Cross-border transfers of personal data outside the Kingdom of Saudi Arabia require prior approval from SDAIA or contractual safeguards equivalent to KSA standards. Data must remain in me-south-1 (Riyadh) or an approved jurisdiction.",
    technicalControl:
      "GovernanceAgent intercepts any outbound data payload where sourceCountry=SA and destinationCountry is not on the SDAIA approved list. Transfer is quarantined pending operator review.",
    legalBasis: "Saudi PDPL Article 29 — Cross-border Transfer Restrictions",
    lastEvaluated: "Live — evaluated on every transfer event",
    riskLevel: "HIGH",
  },
  {
    id: "CITRA_KW_DATA_RESIDENCY_001",
    name: "CITRA KW — Data Residency",
    regulation: "CITRA Decree No. 20/2014",
    jurisdiction: "KW",
    jurisdictionLabel: "Kuwait",
    jurisdictionColor: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    classificationsCovered: ["PII", "SENSITIVE"],
    action: "INTERCEPT" as const,
    summary:
      "Kuwait telecom and government subscriber data must remain within Kuwait jurisdiction. Transfers to any non-GCC destination are prohibited without a CITRA notification filed within 72 hours.",
    technicalControl:
      "GovernanceAgent blocks transfers where sourceCountry=KW and destinationCountry is outside the GCC approved zone. A CITRA notification record is created automatically.",
    legalBasis: "CITRA Decree No. 20/2014 — Telecommunications Data Residency",
    lastEvaluated: "Live — evaluated on every transfer event",
    riskLevel: "HIGH",
  },
  {
    id: "NESA_UAE_CLOUD_001",
    name: "NESA UAE — Cloud Security",
    regulation: "UAE NESA Information Assurance Standards",
    jurisdiction: "UAE",
    jurisdictionLabel: "UAE",
    jurisdictionColor: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    classificationsCovered: ["SENSITIVE", "INTERNAL"],
    action: "ESCALATE" as const,
    summary:
      "UAE critical infrastructure operators must store and process sensitive data on UAE-sovereign cloud infrastructure (G42 Cloud, UAE North Azure). Any transfer to a non-UAE cloud region requires a NESA security assessment.",
    technicalControl:
      "GovernanceAgent flags transfers from UAE-hosted sensitive data to non-UAE cloud regions. Escalation is created for operator review before transfer proceeds.",
    legalBasis: "UAE NESA IAS v3.0 — Cloud and Data Centre Security Standards",
    lastEvaluated: "Live — evaluated on every transfer event",
    riskLevel: "MEDIUM",
  },
  {
    id: "INTERNAL_POLICY_001",
    name: "Internal Enterprise Policy v2.1",
    regulation: "Internal Enterprise Data Governance Policy",
    jurisdiction: "AE",
    jurisdictionLabel: "Internal",
    jurisdictionColor: "bg-slate-500/15 text-slate-400 border-slate-500/25",
    classificationsCovered: ["INTERNAL", "PUBLIC"],
    action: "ALLOW" as const,
    summary:
      "Non-PII billing metadata and internal operational data may transfer freely within UAE-hosted infrastructure (Azure UAE North ↔ G42 Cloud Abu Dhabi). All transfers are logged for audit purposes.",
    technicalControl:
      "GovernanceAgent approves intra-UAE transfers of INTERNAL or PUBLIC classified data. Transfer is logged to the audit trail with a LOW severity entry.",
    legalBasis: "Internal Enterprise Data Governance Policy v2.1 — Section 4.2",
    lastEvaluated: "Live — evaluated on every transfer event",
    riskLevel: "LOW",
  },
] as const;

type PolicyAction = "INTERCEPT" | "ESCALATE" | "ALLOW";

// ── Visual config by action ───────────────────────────────────────────────────
const ACTION_CONFIG: Record<PolicyAction, {
  border: string; bg: string; badge: string; icon: React.ReactNode; label: string;
}> = {
  INTERCEPT: {
    border: "border-red-500/25",
    bg: "bg-red-500/5",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: <XCircle className="w-4 h-4 text-red-400" />,
    label: "INTERCEPT",
  },
  ESCALATE: {
    border: "border-amber-500/25",
    bg: "bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    label: "ESCALATE",
  },
  ALLOW: {
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    label: "ALLOW",
  },
};

const RISK_BADGE: Record<string, string> = {
  HIGH:   "bg-red-500/10 text-red-400 border-red-500/20",
  MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  LOW:    "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const RULE_META: Record<string, { label: string; jurisdiction: string; color: string }> = {
  PDPL_SA_ART29_001:           { label: "PDPL SA Art.29",     jurisdiction: "Saudi Arabia", color: "text-green-400" },
  CITRA_KW_DATA_RESIDENCY_001: { label: "CITRA KW Residency", jurisdiction: "Kuwait",       color: "text-blue-400" },
  NESA_UAE_CLOUD_001:          { label: "NESA UAE Cloud",      jurisdiction: "UAE",          color: "text-purple-400" },
  INTERNAL_POLICY_001:         { label: "Internal Policy",    jurisdiction: "UAE",          color: "text-slate-400" },
};

// ── Override dialog ───────────────────────────────────────────────────────────
interface OverrideDialogProps {
  policy: typeof POLICY_CARDS[number] | null;
  alertId: number;
  onClose: () => void;
  initialReason?: string;
}

function OverrideDialog({ policy, alertId, onClose, initialReason = "" }: OverrideDialogProps) {
  const [reason, setReason] = useState(initialReason);
  const [submitted, setSubmitted] = useState(false);
  const overrideM = trpc.sado.requestOverride.useMutation();
  const utils = trpc.useUtils();

  if (!policy) return null;

  async function handleSubmit() {
    if (!policy) return;
    await overrideM.mutateAsync({
      alertId,
      ruleId: policy.id,
      regulation: policy.regulation,
      reason: reason.trim() || undefined,
    });
    await utils.sado.getEscalations.invalidate();
    await utils.sado.getAuditTrail.invalidate();
    setSubmitted(true);
    toast.success("Override request submitted to escalation queue.");
    setTimeout(() => { onClose(); setSubmitted(false); setReason(""); }, 1500);
  }

  const cfg = ACTION_CONFIG[policy.action];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[oklch(0.14_0.03_255)] border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Lock className="w-4 h-4 text-amber-400" />
            Request Governance Override
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            This action creates an escalation entry and writes to the audit trail. The override request will be reviewed by an authorised operator before any transfer proceeds.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-emerald-400 font-medium">Override request submitted.</p>
            <p className="text-xs text-slate-500 mt-1">Routed to escalation queue for human review.</p>
          </div>
        ) : (
          <>
            {/* Policy summary */}
            <div className={`rounded-lg border p-3 ${cfg.border} ${cfg.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{policy.name}</span>
                <Badge variant="outline" className={`text-xs ${cfg.badge}`}>
                  {cfg.label}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{policy.summary}</p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                Override requests are logged permanently and cannot be deleted. Ensure you have a valid legal basis or written authorisation before proceeding.
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">
                Business justification <span className="text-slate-600">(optional but recommended)</span>
              </label>
              <Textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. SDAIA approval reference #SA-2025-0042 obtained. Transfer authorised for analytics workload in eu-central-1 under contractual safeguards."
                className="bg-slate-900/60 border-slate-700 text-slate-100 placeholder:text-slate-600 text-xs resize-none h-24 focus:border-blue-500"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-400 hover:bg-slate-800"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={overrideM.isPending}
                onClick={handleSubmit}
              >
                {overrideM.isPending ? "Submitting…" : "Submit Override Request"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SADOGovernance() {
  useProspectFromUrl();
  const { prospect } = useProspectMode();
  const alertsQ = trpc.sado.getGovernanceAlerts.useQuery();
  const alerts = alertsQ.data ?? [];

  const [overrideTarget, setOverrideTarget] = useState<{
    policy: typeof POLICY_CARDS[number];
    alertId: number;
  } | null>(null);

  // Build prospect-aware pre-fill reason
  const prospectReason = prospect
    ? prospect.prospectName
      ? `Requested by ${prospect.prospectName} — analytics workload migration to eu-central-1 for governed enterprise data review.`
      : "Requested by prospect team — analytics workload migration to eu-central-1 for governed enterprise data review."
    : "";

  const intercepted = alerts.filter(a => a.action === "INTERCEPTED");
  const allowed     = alerts.filter(a => a.action === "ALLOWED");

  // Map DB alert to its policy card
  function findPolicy(ruleId: string) {
    return POLICY_CARDS.find(p => p.id === ruleId) ?? null;
  }

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/sado">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <Shield className="w-5 h-5 text-blue-400" />
          <div className="flex-1">
            <h1 className="text-base font-semibold text-white">Governance Engine</h1>
            <p className="text-xs text-slate-400">GCC data residency · PDPL SA · CITRA KW · NESA UAE · Transfer interception</p>
          </div>
          {prospect && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
              <Shield className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-blue-300">{prospect.prospectName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Policies",      value: String(POLICY_CARDS.length),       icon: <FileText className="w-4 h-4 text-blue-400" />,        color: "text-blue-400" },
            { label: "Transfers Evaluated",  value: String(alerts.length || 3),        icon: <Globe className="w-4 h-4 text-slate-400" />,          color: "text-slate-300" },
            { label: "Blocked",              value: String(intercepted.length || 2),   icon: <XCircle className="w-4 h-4 text-red-400" />,          color: "text-red-400" },
            { label: "Allowed",              value: String(allowed.length || 1),       icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
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

        {/* ── Policy Cards ──────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-200">Active Governance Policies</h2>
            <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/20 text-blue-400 ml-1">
              {POLICY_CARDS.length} rules
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {POLICY_CARDS.map(policy => {
              const cfg = ACTION_CONFIG[policy.action];
              // Find matching DB alert for this rule (if demo has run)
              const matchingAlert = alerts.find(a => a.ruleId === policy.id);

              return (
                <div
                  key={policy.id}
                  className={`rounded-xl border p-5 transition-all ${cfg.border} ${cfg.bg}`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{cfg.icon}</div>
                      <div>
                        <div className="text-sm font-semibold text-white leading-tight">{policy.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{policy.regulation}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <Badge variant="outline" className={`text-xs ${policy.jurisdictionColor}`}>
                        {policy.jurisdictionLabel}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${cfg.badge}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Rule summary */}
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">{policy.summary}</p>

                  {/* Data classifications covered */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs text-slate-500">Covers:</span>
                    {policy.classificationsCovered.map(cls => (
                      <Badge
                        key={cls}
                        variant="outline"
                        className={`text-xs ${
                          cls === "PII"       ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          cls === "SENSITIVE" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          cls === "INTERNAL"  ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                                               "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {cls}
                      </Badge>
                    ))}
                    <Badge variant="outline" className={`text-xs ml-auto ${RISK_BADGE[policy.riskLevel]}`}>
                      {policy.riskLevel} risk
                    </Badge>
                  </div>

                  {/* Technical control */}
                  <div className="bg-slate-900/60 rounded-lg p-3 mb-3 border border-slate-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Info className="w-3 h-3 text-slate-500" />
                      <span className="text-xs text-slate-500 font-medium">Technical Control</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{policy.technicalControl}</p>
                  </div>

                  {/* Last evaluated + live event */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 flex-wrap">
                    <Clock className="w-3 h-3" />
                    <span>{policy.lastEvaluated}</span>
                    {matchingAlert && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="text-slate-400">
                          Last event: {matchingAlert.sourceCountry} → {matchingAlert.destinationCountry}
                        </span>
                        <span className="text-slate-700">·</span>
                        <span className={matchingAlert.action === "INTERCEPTED" ? "text-red-400" : "text-emerald-400"}>
                          {matchingAlert.action}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Legal basis + Request Override */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <FileText className="w-3 h-3" />
                      <span>{policy.legalBasis}</span>
                    </div>
                    {policy.action !== "ALLOW" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 hover:bg-amber-500/5 gap-1"
                        onClick={() => setOverrideTarget({
                          policy,
                          alertId: matchingAlert?.id ?? 0,
                        })}
                      >
                        <Lock className="w-3 h-3" />
                        Request Override
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Live Transfer Events ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">Live Transfer Events</h2>
            {alerts.length > 0 && (
              <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-400 ml-1">
                {alerts.length} events
              </Badge>
            )}
          </div>

          <Card className="bg-[oklch(0.14_0.03_255)] border-slate-800">
            <CardContent className="px-5 py-5">
              {alerts.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No transfer events yet. Run the demo from the Command Centre.
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map(alert => {
                    const isBlocked   = alert.action === "INTERCEPTED";
                    const isAllowed   = alert.action === "ALLOWED";
                    const rule = RULE_META[alert.ruleId ?? ""] ?? { label: alert.ruleId, jurisdiction: "—", color: "text-slate-400" };
                    const policy = findPolicy(alert.ruleId ?? "");

                    return (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-lg border transition-all ${
                          isBlocked ? "border-red-500/20 bg-red-500/5" :
                          isAllowed ? "border-emerald-500/20 bg-emerald-500/5" :
                                      "border-amber-500/20 bg-amber-500/5"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isBlocked
                              ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                              : isAllowed
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                            <div>
                              <div className="text-sm font-medium text-white flex items-center gap-2">
                                {alert.sourceCountry}
                                <ArrowRight className="w-3 h-3 text-slate-500" />
                                {alert.destinationCountry}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">{alert.dataClassification}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                isBlocked ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                isAllowed ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                            "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              }`}
                            >
                              {alert.action}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${RISK_BADGE[alert.severity]}`}>
                              {alert.severity}
                            </Badge>
                          </div>
                        </div>

                        {/* Rule + timestamp */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                          <span>Rule: <span className={rule.color}>{rule.label}</span></span>
                          <span className="text-slate-700">·</span>
                          <span>{new Date(alert.createdAt ?? 0).toLocaleTimeString()}</span>
                        </div>

                        {/* Description */}
                        {alert.description && (
                          <div className="text-xs text-slate-400 bg-slate-900/50 rounded p-2 mb-2 leading-relaxed">
                            {alert.description}
                          </div>
                        )}

                        {/* Recommended action */}
                        {alert.recommendedAction && (
                          <div className="flex items-start gap-1.5 text-xs text-slate-500">
                            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span>{alert.recommendedAction}</span>
                          </div>
                        )}

                        {/* Request Override CTA for blocked events */}
                        {isBlocked && policy && (
                          <div className="mt-3 pt-2 border-t border-slate-800/60 flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 hover:bg-amber-500/5 gap-1"
                              onClick={() => setOverrideTarget({ policy, alertId: alert.id })}
                            >
                              <Lock className="w-3 h-3" />
                              Request Override
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Navigation ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <Link href="/sado/escalations">
            <Button variant="outline" size="sm" className="text-xs border-slate-700 text-slate-400 hover:bg-slate-800 gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              View Escalation Queue
            </Button>
          </Link>
          <Link href="/sado/audit-trail">
            <Button variant="outline" size="sm" className="text-xs border-slate-700 text-slate-400 hover:bg-slate-800 gap-1">
              <Lock className="w-3 h-3 text-blue-400" />
              View Audit Trail
            </Button>
          </Link>
        </div>
      </div>

      {/* Override dialog */}
      {overrideTarget && (
        <OverrideDialog
          policy={overrideTarget.policy}
          alertId={overrideTarget.alertId}
          onClose={() => setOverrideTarget(null)}
          initialReason={prospectReason}
        />
      )}
    </div>
  );
}
