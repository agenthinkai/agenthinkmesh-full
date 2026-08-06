/**
 * LPTwinFundDetail.tsx — Read-only Fund Detail Page
 * Route: /captwin/lp-twin/fund/:id
 * CapTwin Enterprise Module — Pre-WP4 Correction
 *
 * Displays all fund profile fields. Actions: Edit, Start Simulation,
 * View Session History, Duplicate, Archive. All org-scoped.
 */

import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Edit,
  Play,
  History,
  Copy,
  Archive,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Globe,
  DollarSign,
  BarChart3,
  Shield,
  FileText,
  Info,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FundData {
  id: number;
  orgId: number;
  createdByUserId: number;
  updatedByUserId: number;
  fundName: string;
  gpName: string;
  strategy: string;
  assetClass: string | null;
  geography: string | null;
  domicile: string | null;
  currency: string;
  targetFundSizeM: string;
  economicsJson: string;
  investmentPropositionJson: string | null;
  riskLiquidityJson: string | null;
  trackRecordJson: string;
  institutionalRequirementsJson: string | null;
  evidenceStatus: "draft" | "complete" | "verified";
  version: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatCurrency(value: string | number, currency: string): string {
  const n = Number(value);
  if (isNaN(n)) return "—";
  if (n >= 1000) return `${currency} ${(n / 1000).toFixed(1)}B`;
  return `${currency} ${n.toFixed(0)}M`;
}

function safeJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

function FieldRow({ label, value, missing }: { label: string; value?: string | number | null; missing?: boolean }) {
  const isEmpty = value === null || value === undefined || value === "" || value === 0;
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border last:border-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isEmpty ? (
        <p className="text-sm text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {missing ? "Missing — required for analysis" : "Not provided"}
        </p>
      ) : (
        <p className="text-sm font-medium">{String(value)}</p>
      )}
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {children}
      </CardContent>
    </Card>
  );
}

// ── Evidence Status Badge ─────────────────────────────────────────────────────

function EvidenceBadge({ status }: { status: "draft" | "complete" | "verified" }) {
  if (status === "verified") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Verified</Badge>;
  if (status === "complete") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Complete</Badge>;
  return <Badge variant="outline" className="text-amber-400 border-amber-500/30">Draft</Badge>;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LPTwinFundDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const fundId = parseInt(params.id ?? "0", 10);

  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const { data, isLoading, error } = trpc.lpTwin.getFund.useQuery(
    { fundId },
    { enabled: fundId > 0, retry: false }
  );

  const utils = trpc.useUtils();

  const archiveMutation = trpc.lpTwin.archiveFund.useMutation({
    onSuccess: () => {
      toast.success("Fund archived");
      utils.lpTwin.listFunds.invalidate();
      navigate("/captwin/lp-twin");
    },
    onError: (err) => toast.error("Archive failed", { description: err.message }),
  });

  const duplicateMutation = trpc.lpTwin.duplicateFund.useMutation({
    onSuccess: (result) => {
      toast.success("Fund profile duplicated");
      utils.lpTwin.listFunds.invalidate();
      navigate(`/captwin/lp-twin/fund/${result.newFundId}`);
    },
    onError: (err) => toast.error("Duplicate failed", { description: err.message }),
  });

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (!fundId || isNaN(fundId)) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
        <p className="font-medium">Invalid fund ID</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate("/captwin/lp-twin")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to LP Twin
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data?.fund) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-center text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
        <p className="font-medium">Fund not found or access denied</p>
        <p className="text-sm mt-1">{error?.message ?? "This fund does not exist or belongs to another organisation."}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate("/captwin/lp-twin")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to LP Twin
        </Button>
      </div>
    );
  }

  const fund = data.fund as FundData;
  const economics = safeJson(fund.economicsJson);
  const proposition = safeJson(fund.investmentPropositionJson);
  const riskLiquidity = safeJson(fund.riskLiquidityJson);
  const trackRecord = safeJson(fund.trackRecordJson);
  const institutional = safeJson(fund.institutionalRequirementsJson);
  const isArchived = fund.archivedAt != null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <button onClick={() => navigate("/captwin/lp-twin")} className="hover:text-foreground transition-colors">
              LP Twin
            </button>
            <span>/</span>
            <span className="text-foreground">{fund.fundName}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0" onClick={() => navigate("/captwin/lp-twin")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{fund.fundName}</h1>
                  {isArchived ? (
                    <Badge variant="outline" className="text-muted-foreground border-muted">Archived</Badge>
                  ) : null}
                  <EvidenceBadge status={fund.evidenceStatus} />
                  <Badge variant="outline" className="text-xs font-mono">v{fund.version}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{fund.gpName} · {fund.strategy}</p>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => navigate(`/captwin/lp-twin/fund/${fund.id}/edit`)}
              >
                <Edit className="h-3.5 w-3.5" /> Edit Fund
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => navigate(`/captwin/lp-twin/new?fundId=${fund.id}`)}
                disabled={isArchived}
              >
                <Play className="h-3.5 w-3.5" /> Start Simulation
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => navigate(`/captwin/lp-twin?fundId=${fund.id}&tab=sessions`)}
              >
                <History className="h-3.5 w-3.5" /> Session History
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => duplicateMutation.mutate({ fundId: fund.id })}
                disabled={duplicateMutation.isPending}
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
              {!isArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => setShowArchiveDialog(true)}
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Synthetic simulation notice */}
      <div className="max-w-5xl mx-auto px-6 pt-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>SYNTHETIC SIMULATION</strong> — Fund profiles are used to generate evidence-based synthetic simulations
            against anonymised institutional archetypes. Outputs are not validated predictions of real allocator behaviour.
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Fund Identity */}
        <SectionCard title="Fund Identity" icon={<Building2 className="h-4 w-4 text-primary" />}>
          <FieldRow label="Fund Name" value={fund.fundName} missing />
          <FieldRow label="GP / Manager Name" value={fund.gpName} missing />
          <FieldRow label="Strategy" value={fund.strategy} missing />
          <FieldRow label="Asset Class" value={fund.assetClass} />
          <FieldRow label="Geography" value={fund.geography} />
          <FieldRow label="Domicile" value={fund.domicile} />
          <FieldRow label="Currency" value={fund.currency} />
        </SectionCard>

        {/* Fund Size & Timeline */}
        <SectionCard title="Fund Size & Timeline" icon={<DollarSign className="h-4 w-4 text-primary" />}>
          <FieldRow label="Target Fund Size" value={formatCurrency(fund.targetFundSizeM, fund.currency)} missing />
          <FieldRow label="First-Close Target" value={proposition.firstCloseTargetM ? formatCurrency(proposition.firstCloseTargetM as number, fund.currency) : null} />
          <FieldRow label="Final-Close Target" value={proposition.finalCloseTargetM ? formatCurrency(proposition.finalCloseTargetM as number, fund.currency) : null} />
          <FieldRow label="Fundraising Deadline" value={proposition.fundraisingDeadline as string | null} />
          <FieldRow label="Fund Term" value={proposition.fundTermYears ? `${proposition.fundTermYears} years` : null} />
          <FieldRow label="Vintage Year" value={trackRecord.vintageYear as number | null} />
        </SectionCard>

        {/* Economics */}
        <SectionCard title="Economics" icon={<BarChart3 className="h-4 w-4 text-primary" />}>
          <FieldRow label="Management Fee" value={economics.managementFeePct ? `${economics.managementFeePct}%` : null} missing />
          <FieldRow label="Carried Interest" value={economics.carryPct ? `${economics.carryPct}%` : null} missing />
          <FieldRow label="Hurdle Rate" value={economics.hurdleRatePct ? `${economics.hurdleRatePct}%` : null} />
          <FieldRow label="GP Commitment" value={economics.gpCommitmentPct ? `${economics.gpCommitmentPct}%` : null} />
          <FieldRow label="Preferred Return" value={economics.preferredReturnPct ? `${economics.preferredReturnPct}%` : null} />
        </SectionCard>

        {/* Track Record */}
        <SectionCard title="GP Track Record" icon={<CheckCircle2 className="h-4 w-4 text-primary" />}>
          <FieldRow label="Track Record (Years)" value={trackRecord.trackRecordYrs as number | null} missing />
          <FieldRow label="Prior Fund Net IRR" value={trackRecord.priorFundIRR ? `${trackRecord.priorFundIRR}%` : null} />
          <FieldRow label="Prior Fund TVPI" value={trackRecord.priorFundTVPI as number | null} />
          <FieldRow label="Realized Exits" value={trackRecord.realizedExits as string | null} />
          <FieldRow label="Unrealized Value %" value={trackRecord.unrealizedPct ? `${trackRecord.unrealizedPct}%` : null} />
          <FieldRow label="Team Stability" value={trackRecord.teamStability as string | null} />
        </SectionCard>

        {/* Investment Proposition */}
        <SectionCard title="Investment Proposition" icon={<FileText className="h-4 w-4 text-primary" />}>
          <FieldRow label="Thesis" value={proposition.thesis as string | null} />
          <FieldRow label="Target Return" value={proposition.targetReturnPct ? `${proposition.targetReturnPct}% net IRR` : null} />
          <FieldRow label="Deployment Pace" value={proposition.deploymentPace as string | null} />
          <FieldRow label="Co-Investment Rights" value={proposition.coInvestmentRights as string | null} />
          <FieldRow label="ESG Policy" value={proposition.esgPolicy as string | null} />
          <FieldRow label="Sharia Compliant" value={proposition.shariaCompliant ? "Yes" : proposition.shariaCompliant === false ? "No" : null} />
        </SectionCard>

        {/* Risk & Liquidity */}
        <SectionCard title="Risk & Liquidity" icon={<Shield className="h-4 w-4 text-primary" />}>
          <FieldRow label="Liquidity Terms" value={riskLiquidity.liquidityTerms as string | null} />
          <FieldRow label="Leverage Policy" value={riskLiquidity.leveragePolicy as string | null} />
          <FieldRow label="Currency Risk" value={riskLiquidity.currencyRisk as string | null} />
          <FieldRow label="J-Curve Profile" value={riskLiquidity.jCurveProfile as string | null} />
          <FieldRow label="Valuation Policy" value={riskLiquidity.valuationPolicy as string | null} />
        </SectionCard>

        {/* Institutional Requirements */}
        <SectionCard title="Institutional Requirements" icon={<Globe className="h-4 w-4 text-primary" />}>
          <FieldRow label="Minimum Ticket Size" value={institutional.minTicketM ? formatCurrency(institutional.minTicketM as number, fund.currency) : null} />
          <FieldRow label="Maximum Ticket Size" value={institutional.maxTicketM ? formatCurrency(institutional.maxTicketM as number, fund.currency) : null} />
          <FieldRow label="Governance Structure" value={institutional.governanceStructure as string | null} />
          <FieldRow label="Reporting Frequency" value={institutional.reportingFrequency as string | null} />
          <FieldRow label="Regulatory Status" value={institutional.regulatoryStatus as string | null} />
          <FieldRow label="Tax Considerations" value={institutional.taxConsiderations as string | null} />
        </SectionCard>

        {/* Record Metadata */}
        <SectionCard title="Record Metadata" icon={<Info className="h-4 w-4 text-primary" />}>
          <FieldRow label="Evidence Status" value={fund.evidenceStatus.charAt(0).toUpperCase() + fund.evidenceStatus.slice(1)} />
          <FieldRow label="Fund Version" value={`v${fund.version}`} />
          <FieldRow label="Created" value={formatDate(fund.createdAt)} />
          <FieldRow label="Last Updated" value={formatDate(fund.updatedAt)} />
          <FieldRow label="Created By (User ID)" value={fund.createdByUserId} />
          {isArchived ? (
            <FieldRow label="Archived" value={formatDate(fund.archivedAt!)} />
          ) : null}
        </SectionCard>

      </div>

      {/* Archive confirmation dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Fund Profile</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive <strong>{fund.fundName}</strong>. Existing sessions will remain accessible.
              You can restore the fund by editing it. This action is reversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveMutation.mutate({ fundId: fund.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
