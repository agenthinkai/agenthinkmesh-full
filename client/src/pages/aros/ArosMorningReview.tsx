/**
 * ArosMorningReview.tsx — CEO Morning Editorial Review
 *
 * The single most important page in Atlas.
 * The CEO reviews tomorrow's entire Executive Intelligence publication in < 15 minutes.
 *
 * Section 6 (top): CEO Question — "If I could send only ONE brief tomorrow..."
 * Section 1: Tomorrow's Publication — all scheduled briefs as cards
 * Section 2: Full Brief — exact delivery text, no summaries
 * Section 3: Editorial Opinion — 6-question self-critique + score
 * Section 4: Publication Controls — Approve All / Selected / Reject / Regenerate / Edit / Schedule / Send
 * Section 5: Tomorrow's Summary — aggregate stats + projections
 * Section 7: Final Rule Gate — blocks Approve All if any brief lacks editorial review
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Clock,
  Edit3,
  Star,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  BarChart3,
  Users,
  TrendingUp,
  DollarSign,
  MessageSquare,
  Sparkles,
  Shield,
  Eye,
  ThumbsUp,
  ThumbsDown,
  GitCompare,
  Calendar,
  Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type EditorStatus = "DRAFT" | "READY" | "APPROVED" | "SCHEDULED" | "SENT";

interface EditorialReview {
  id: number;
  briefDraftId: number;
  isOpeningCompelling: number;
  isHiddenVariableUnique: number;
  hasMarketingLanguage: number;
  wouldCeoForward: number;
  weakOrGenericNotes: string | null;
  editorialScore: number;
  recommendation: "APPROVE" | "REGENERATE";
  reviewerNotes: string | null;
  generatedAt: number;
}

interface PublicationBrief {
  id: number;
  companyName: string;
  executiveName: string | null;
  executiveTitle: string | null;
  executiveEmail: string | null;
  strategicDecision: string | null;
  hiddenVariable: string | null;
  sss: number | null;
  esi: number | null;
  evidenceConfidence: number | null;
  briefContent: string | null;
  editorStatus: string;
  version: number;
  decisionLevel: string;
  scheduledSendTime: number;
  editorialReview: EditorialReview | null;
  tripleGateSss: number | null;
  tripleGateEsi: number | null;
  tripleGateConf: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sssColor(sss: number): string {
  if (sss >= 90) return "bg-red-500/20 text-red-300 border-red-500/40";
  if (sss >= 75) return "bg-orange-500/20 text-orange-300 border-orange-500/40";
  if (sss >= 60) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
}

function cardBorderColor(sss: number): string {
  if (sss >= 90) return "border-red-500/30 hover:border-red-400/60";
  if (sss >= 75) return "border-orange-500/30 hover:border-orange-400/60";
  if (sss >= 60) return "border-amber-500/30 hover:border-amber-400/60";
  return "border-zinc-600/30 hover:border-zinc-500/60";
}

function editorialScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 75) return "text-amber-400";
  if (score >= 60) return "text-orange-400";
  return "text-red-400";
}

function editorialScoreBg(score: number): string {
  if (score >= 90) return "bg-emerald-500/15 border-emerald-500/30 text-emerald-300";
  if (score >= 75) return "bg-amber-500/15 border-amber-500/30 text-amber-300";
  if (score >= 60) return "bg-orange-500/15 border-orange-500/30 text-orange-300";
  return "bg-red-500/15 border-red-500/30 text-red-300";
}

function decisionLevelColor(level: string): string {
  if (level === "BOARD") return "bg-purple-500/20 text-purple-300 border-purple-500/40";
  if (level === "C-SUITE") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (level === "DIVISIONAL") return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
  return "bg-zinc-500/20 text-zinc-300 border-zinc-500/40";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ── Editorial Opinion Panel ───────────────────────────────────────────────────
function EditorialOpinionPanel({
  review,
  onRegenerate,
  isGenerating,
}: {
  review: EditorialReview | null;
  onRegenerate: () => void;
  isGenerating: boolean;
}) {
  const parsedNotes = review?.reviewerNotes
    ? (() => { try { return JSON.parse(review.reviewerNotes); } catch { return null; } })()
    : null;

  if (!review) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <BookOpen className="w-10 h-10 text-zinc-600 mb-3" />
        <p className="text-zinc-400 text-sm mb-4">No editorial review yet.</p>
        <Button
          size="sm"
          onClick={onRegenerate}
          disabled={isGenerating}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          {isGenerating ? (
            <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Editorial Opinion</>
          )}
        </Button>
      </div>
    );
  }

  const checks = [
    {
      label: "Opening compelling?",
      value: !!review.isOpeningCompelling,
      analysis: parsedNotes?.openingAnalysis,
      icon: Eye,
    },
    {
      label: "Hidden Variable differentiated?",
      value: !!review.isHiddenVariableUnique,
      analysis: parsedNotes?.hiddenVariableAnalysis,
      icon: Sparkles,
    },
    {
      label: "Free of marketing language?",
      value: !review.hasMarketingLanguage,
      analysis: parsedNotes?.marketingLanguageAnalysis,
      icon: Shield,
    },
    {
      label: "CEO would forward to colleagues?",
      value: !!review.wouldCeoForward,
      analysis: parsedNotes?.forwardabilityAnalysis,
      icon: Users,
    },
    {
      label: "No weak or generic content?",
      value: !review.weakOrGenericNotes || review.weakOrGenericNotes.trim() === "",
      analysis: parsedNotes?.weaknessAnalysis || review.weakOrGenericNotes,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Score + Recommendation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`text-4xl font-bold tabular-nums ${editorialScoreColor(review.editorialScore)}`}>
            {review.editorialScore}
          </div>
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wider">Editorial Score</div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold mt-1 border ${
              review.recommendation === "APPROVE"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/15 border-red-500/30 text-red-300"
            }`}>
              {review.recommendation === "APPROVE"
                ? <><CheckCircle2 className="w-3 h-3" /> APPROVE</>
                : <><AlertTriangle className="w-3 h-3" /> REGENERATE</>
              }
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRegenerate}
          disabled={isGenerating}
          className="border-zinc-700 text-zinc-400 hover:text-white text-xs"
        >
          {isGenerating
            ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Re-reviewing…</>
            : <><RefreshCw className="w-3 h-3 mr-1" /> Re-review</>
          }
        </Button>
      </div>

      {/* 5 Checks */}
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.label} className={`rounded-lg p-3 border ${
            check.value
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-red-500/5 border-red-500/20"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {check.value
                ? <ThumbsUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                : <ThumbsDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              }
              <span className={`text-xs font-medium ${check.value ? "text-emerald-300" : "text-red-300"}`}>
                {check.label}
              </span>
            </div>
            {check.analysis && (
              <p className="text-xs text-zinc-400 ml-5 leading-relaxed">{check.analysis}</p>
            )}
          </div>
        ))}
      </div>

      {/* Overall Verdict */}
      {parsedNotes?.overallVerdict && (
        <div className="rounded-lg p-3 bg-zinc-800/60 border border-zinc-700/50">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
            Editorial Verdict
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed italic">
            "{parsedNotes.overallVerdict}"
          </p>
        </div>
      )}

      <div className="text-xs text-zinc-600">
        Reviewed {formatTime(review.generatedAt)}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ArosMorningReview() {
  const [selectedBriefId, setSelectedBriefId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generatingReviewFor, setGeneratingReviewFor] = useState<Set<number>>(new Set());
  const [autoReviewTriggered, setAutoReviewTriggered] = useState(false);

  const utils = trpc.useUtils();

  const { data: publicationData, isLoading: loadingPublication, refetch: refetchPublication } =
    trpc.arosMorningReview.getPublication.useQuery(undefined, {
      refetchInterval: 60_000,
    });

  const { data: summaryData, isLoading: loadingSummary } =
    trpc.arosMorningReview.getPublicationSummary.useQuery(undefined, {
      refetchInterval: 60_000,
    });

  const { data: recommendedData, isLoading: loadingRecommended } =
    trpc.arosMorningReview.getRecommendedOne.useQuery(undefined, {
      staleTime: 5 * 60_000,
    });

  const generateOpinion = trpc.arosMorningReview.generateEditorialOpinion.useMutation({
    onSuccess: () => {
      utils.arosMorningReview.getPublication.invalidate();
      utils.arosMorningReview.getPublicationSummary.invalidate();
    },
  });

  const approveAll = trpc.arosMorningReview.approveAll.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} brief${data.approved !== 1 ? "s" : ""} approved for dispatch`);
      utils.arosMorningReview.getPublication.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const approveSelected = trpc.arosMorningReview.approveSelected.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} brief${data.approved !== 1 ? "s" : ""} approved`);
      setSelectedIds(new Set());
      utils.arosMorningReview.getPublication.invalidate();
    },
  });

  const rejectBrief = trpc.arosMorningReview.rejectBrief.useMutation({
    onSuccess: () => {
      toast.success("Brief returned to DRAFT");
      utils.arosMorningReview.getPublication.invalidate();
    },
  });

  const regenerateBrief = trpc.arosMorningReview.regenerateBrief.useMutation({
    onSuccess: () => {
      toast.success("Brief regenerated — editorial review reset");
      utils.arosMorningReview.getPublication.invalidate();
    },
  });

  const scheduleDispatch = trpc.arosMorningReview.scheduleDispatch.useMutation({
    onSuccess: () => {
      toast.success("Brief scheduled for dispatch");
      utils.arosMorningReview.getPublication.invalidate();
    },
  });

  const sendImmediately = trpc.arosMorningReview.sendImmediately.useMutation({
    onSuccess: () => {
      toast.success("Brief sent immediately — outreach queue updated");
      utils.arosMorningReview.getPublication.invalidate();
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const briefs: PublicationBrief[] = (publicationData?.briefs ?? []) as any;
  const hasUnreviewed = publicationData?.hasUnreviewed ?? false;
  const selectedBrief = briefs.find(b => b.id === selectedBriefId) ?? briefs[0] ?? null;

  // Auto-select first brief
  useEffect(() => {
    if (briefs.length > 0 && !selectedBriefId) {
      setSelectedBriefId(briefs[0].id);
    }
  }, [briefs, selectedBriefId]);

  // Auto-generate editorial opinions for briefs that don't have one
  useEffect(() => {
    if (autoReviewTriggered || loadingPublication || briefs.length === 0) return;
    const unreviewed = briefs.filter(b => !b.editorialReview);
    if (unreviewed.length === 0) return;
    setAutoReviewTriggered(true);
    // Stagger auto-generation to avoid hammering the LLM
    unreviewed.forEach((brief, i) => {
      setTimeout(() => {
        setGeneratingReviewFor(prev => new Set(Array.from(prev).concat(brief.id)));
        generateOpinion.mutateAsync({ briefDraftId: brief.id }).finally(() => {
          setGeneratingReviewFor(prev => {
            const next = new Set(prev);
            next.delete(brief.id);
            return next;
          });
        });
      }, i * 3000);
    });
  }, [briefs, loadingPublication, autoReviewTriggered]);

  const handleGenerateOpinion = useCallback((briefId: number) => {
    setGeneratingReviewFor(prev => new Set(Array.from(prev).concat(briefId)));
    generateOpinion.mutateAsync({ briefDraftId: briefId }).finally(() => {
      setGeneratingReviewFor(prev => {
        const next = new Set(prev);
        next.delete(briefId);
        return next;
      });
    });
  }, [generateOpinion]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#080D1A] text-white">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-800/60 bg-[#0B1220]/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h1 className="text-lg font-semibold tracking-tight">Morning Editorial Review</h1>
                <span className="text-xs text-zinc-500 font-mono">
                  {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Nothing leaves AgenThink Mesh unless it has appeared here. Atlas behaves like the editor of the Financial Times.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchPublication()}
                className="border-zinc-700 text-zinc-400 hover:text-white text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
              </Button>
              {briefs.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => approveAll.mutate()}
                  disabled={approveAll.isPending || hasUnreviewed}
                  className={`text-xs font-semibold ${
                    hasUnreviewed
                      ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                  title={hasUnreviewed ? "Every brief must pass editorial review before dispatch" : "Approve all briefs"}
                >
                  {approveAll.isPending
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Approving…</>
                    : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve All</>
                  }
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">

          {/* ── Section 6: CEO Question ─────────────────────────────────────── */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <div className="flex items-start gap-3">
              <Star className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                  CEO Question
                </div>
                <div className="text-base font-medium text-white mb-3">
                  If I could send only ONE Executive Intelligence Brief tomorrow…
                </div>
                {loadingRecommended ? (
                  <div className="h-16 bg-zinc-800/60 rounded-lg animate-pulse" />
                ) : recommendedData?.recommendation ? (
                  <div className="bg-zinc-900/60 rounded-lg p-4 border border-amber-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <span className="font-semibold text-white">
                          {recommendedData.recommendation.companyName}
                        </span>
                        {recommendedData.recommendation.executiveName && (
                          <span className="text-zinc-400 text-sm ml-2">
                            — {recommendedData.recommendation.executiveName}
                          </span>
                        )}
                      </div>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs ml-auto">
                        Atlas Recommendation
                      </Badge>
                    </div>
                    {recommendedData.recommendation.strategicDecision && (
                      <div className="text-xs text-zinc-400 mb-2 italic">
                        "{recommendedData.recommendation.strategicDecision}"
                      </div>
                    )}
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {recommendedData.recommendation.explanation}
                    </p>
                    <div className="mt-2 text-xs text-zinc-500">
                      Confidence: {recommendedData.recommendation.confidence}%
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500 italic">
                    No briefs scheduled for tomorrow's dispatch yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 7: Final Rule Gate ──────────────────────────────────── */}
          {hasUnreviewed && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/8 p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-red-300">Editorial Review Required</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Every brief must pass editorial review before dispatch. Atlas is reviewing unreviewed briefs automatically.
                  Approve All is blocked until all briefs have been reviewed.
                </div>
              </div>
            </div>
          )}

          {/* ── Section 5: Tomorrow's Summary ──────────────────────────────── */}
          {summaryData && summaryData.companiesScheduled > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: "Scheduled", value: summaryData.companiesScheduled, icon: Calendar, color: "text-blue-400" },
                { label: "Avg SSS", value: summaryData.avgSss, icon: BarChart3, color: "text-orange-400" },
                { label: "Avg ESI", value: summaryData.avgEsi, icon: Sparkles, color: "text-purple-400" },
                { label: "Avg Confidence", value: `${summaryData.avgConfidence}%`, icon: Shield, color: "text-cyan-400" },
                { label: "Avg Editorial", value: summaryData.avgEditorialScore, icon: BookOpen, color: editorialScoreColor(summaryData.avgEditorialScore) },
                { label: "Response Rate", value: `${summaryData.expectedResponseRate}%`, icon: MessageSquare, color: "text-emerald-400" },
                { label: "Exp. Meetings", value: summaryData.expectedMeetings, icon: Users, color: "text-amber-400" },
                { label: "Revenue Opp.", value: formatCurrency(summaryData.expectedRevenueOpportunity), icon: DollarSign, color: "text-green-400" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-zinc-900/60 border border-zinc-800/60 p-3 text-center">
                  <stat.icon className={`w-4 h-4 mx-auto mb-1.5 ${stat.color}`} />
                  <div className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Main Content: Cards + Detail Panel ─────────────────────────── */}
          {loadingPublication ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-zinc-800/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : briefs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <BookOpen className="w-12 h-12 text-zinc-700 mb-4" />
              <h3 className="text-lg font-medium text-zinc-400 mb-2">No briefs scheduled for tomorrow</h3>
              <p className="text-sm text-zinc-600 max-w-md">
                Briefs appear here when they reach SCHEDULED or APPROVED status in the Pre-Dispatch Editor.
                The Morning Editorial Review is the final gate before dispatch.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

              {/* ── Section 1: Publication Cards ─────────────────────────── */}
              <div className="xl:col-span-2 space-y-2.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                <div className="flex items-center justify-between mb-3 sticky top-0 bg-[#080D1A] py-1">
                  <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                    Tomorrow's Publication
                  </h2>
                  <span className="text-xs text-zinc-500">{briefs.length} brief{briefs.length !== 1 ? "s" : ""}</span>
                </div>

                {briefs.map((brief, idx) => {
                  const sss = brief.sss ?? 0;
                  const isSelected = selectedBriefId === brief.id;
                  const isChecked = selectedIds.has(brief.id);
                  const review = brief.editorialReview;
                  const isGenerating = generatingReviewFor.has(brief.id);

                  return (
                    <div
                      key={brief.id}
                      onClick={() => setSelectedBriefId(brief.id)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all ${
                        isSelected
                          ? "bg-zinc-800/80 border-blue-500/50 ring-1 ring-blue-500/30"
                          : `bg-zinc-900/40 ${cardBorderColor(sss)}`
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-start gap-2.5 mb-2.5">
                        <div
                          className="w-5 h-5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center cursor-pointer"
                          style={{ borderColor: isChecked ? "#3b82f6" : "#3f3f46", background: isChecked ? "#3b82f6" : "transparent" }}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(brief.id); }}
                        >
                          {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-zinc-500 font-mono">#{idx + 1}</span>
                            <span className="font-semibold text-white text-sm truncate">{brief.companyName}</span>
                          </div>
                          <div className="text-xs text-zinc-400 truncate mt-0.5">
                            {brief.executiveName}
                            {brief.executiveTitle && <span className="text-zinc-600"> · {brief.executiveTitle}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Strategic Decision */}
                      {brief.strategicDecision && (
                        <p className="text-xs text-zinc-400 line-clamp-2 mb-2.5 ml-7">
                          {brief.strategicDecision}
                        </p>
                      )}

                      {/* Scores Row */}
                      <div className="flex items-center gap-1.5 flex-wrap ml-7">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${sssColor(sss)}`}>
                          SSS {sss}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border bg-purple-500/15 text-purple-300 border-purple-500/30">
                          ESI {brief.esi ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
                          {brief.evidenceConfidence ?? 0}%
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${decisionLevelColor(brief.decisionLevel)}`}>
                          {brief.decisionLevel}
                        </span>
                        {review && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold border ${editorialScoreBg(review.editorialScore)}`}>
                            <BookOpen className="w-2.5 h-2.5" /> {review.editorialScore}
                          </span>
                        )}
                        {isGenerating && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-zinc-500 border border-zinc-700">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Reviewing…
                          </span>
                        )}
                      </div>

                      {/* Send Time */}
                      <div className="mt-2 ml-7 text-xs text-zinc-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(brief.scheduledSendTime)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Sections 2, 3, 4: Detail Panel ──────────────────────── */}
              {selectedBrief && (
                <div className="xl:col-span-3 space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">

                  {/* Brief Header */}
                  <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedBrief.companyName}</h2>
                        <div className="text-sm text-zinc-400 mt-0.5">
                          {selectedBrief.executiveName}
                          {selectedBrief.executiveTitle && <span className="text-zinc-600"> · {selectedBrief.executiveTitle}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${sssColor(selectedBrief.sss ?? 0)}`}>
                          SSS {selectedBrief.sss ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border bg-purple-500/15 text-purple-300 border-purple-500/30">
                          ESI {selectedBrief.esi ?? 0}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${decisionLevelColor(selectedBrief.decisionLevel)}`}>
                          {selectedBrief.decisionLevel}
                        </span>
                      </div>
                    </div>

                    {/* Strategic Decision + Hidden Variable */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {selectedBrief.strategicDecision && (
                        <div className="rounded-lg bg-zinc-800/60 p-3">
                          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Strategic Decision</div>
                          <p className="text-sm text-zinc-300">{selectedBrief.strategicDecision}</p>
                        </div>
                      )}
                      {selectedBrief.hiddenVariable && (
                        <div className="rounded-lg bg-zinc-800/60 p-3">
                          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Hidden Variable</div>
                          <p className="text-sm text-zinc-300">{selectedBrief.hiddenVariable}</p>
                        </div>
                      )}
                    </div>

                    {/* Section 4: Publication Controls */}
                    <div className="flex items-center gap-2 flex-wrap border-t border-zinc-800/60 pt-4">
                      {selectedIds.size > 0 && (
                        <Button
                          size="sm"
                          onClick={() => approveSelected.mutate({ briefIds: Array.from(selectedIds) })}
                          disabled={approveSelected.isPending}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Approve {selectedIds.size} Selected
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectBrief.mutate({ briefDraftId: selectedBrief.id })}
                        disabled={rejectBrief.isPending}
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => regenerateBrief.mutate({ briefDraftId: selectedBrief.id })}
                        disabled={regenerateBrief.isPending}
                        className="border-zinc-700 text-zinc-400 hover:text-white text-xs"
                      >
                        {regenerateBrief.isPending
                          ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Regenerating…</>
                          : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate</>
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => scheduleDispatch.mutate({ briefDraftId: selectedBrief.id })}
                        disabled={scheduleDispatch.isPending}
                        className="border-zinc-700 text-zinc-400 hover:text-white text-xs"
                      >
                        <Calendar className="w-3.5 h-3.5 mr-1.5" /> Schedule
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (confirm(`Send "${selectedBrief.companyName}" brief immediately?`)) {
                            sendImmediately.mutate({ briefDraftId: selectedBrief.id });
                          }
                        }}
                        disabled={sendImmediately.isPending}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs ml-auto"
                      >
                        {sendImmediately.isPending
                          ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending…</>
                          : <><Zap className="w-3.5 h-3.5 mr-1.5" /> Send Immediately</>
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Section 2: Full Brief */}
                  <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Eye className="w-4 h-4 text-blue-400" />
                      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                        Full Brief — Exactly As Delivered
                      </h3>
                    </div>
                    {selectedBrief.briefContent ? (
                      <div className="space-y-3">
                        {selectedBrief.briefContent.split("\n\n").map((para, i) => {
                          if (para.startsWith("SUBJECT:")) {
                            return (
                              <div key={i} className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-3">
                                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Subject Line</div>
                                <p className="text-sm font-semibold text-white">{para.replace("SUBJECT:", "").trim()}</p>
                              </div>
                            );
                          }
                          return (
                            <p key={i} className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {para}
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-500 italic text-center py-8">
                        No brief content generated yet.
                      </div>
                    )}
                  </div>

                  {/* Section 3: Editorial Opinion */}
                  <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                        Editorial Opinion
                      </h3>
                      {selectedBrief.editorialReview && (
                        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded border ${editorialScoreBg(selectedBrief.editorialReview.editorialScore)}`}>
                          Score: {selectedBrief.editorialReview.editorialScore}/100
                        </span>
                      )}
                    </div>
                    <EditorialOpinionPanel
                      review={selectedBrief.editorialReview}
                      onRegenerate={() => handleGenerateOpinion(selectedBrief.id)}
                      isGenerating={generatingReviewFor.has(selectedBrief.id)}
                    />
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
