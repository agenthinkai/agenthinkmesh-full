/**
 * SharedReport — read-only public view of a shared deal screening or comparison report.
 * Route: /reports/:token
 * No auth required. Rate-limited server-side.
 */
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, AlertTriangle, Copy, Check, Shield, Clock } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonaVote {
  persona: string;
  vote: string;
  confidence: number;
  rationale: string;
}

interface SingleDealData {
  type: "single_deal";
  dealName: string;
  verdict: string;
  confidenceScore: string | number;
  yesCount: number;
  noCount: number;
  votes: PersonaVote[];
  conditionsToProceed: string[];
  blockingIssues: string[];
  gccVetoTriggered: boolean;
  createdAt: string | Date;
}

interface RankedDeal {
  dealName: string;
  rank: number;
  overallScore: number;
  verdict: string;
  consensusScore: number;
  badges: string[];
}

interface ComparisonData {
  type: "comparison";
  dealNames: string[];
  rankedDeals: RankedDeal[];
  comparisonSummary: {
    keyTradeoffs: string[];
    recommendedDeal: string;
    recommendationRationale: string;
  };
  dealAnalyses: unknown[];
  totalAmountUsd: string;
  createdAt: string | Date;
}

type ReportData = SingleDealData | ComparisonData;

// ── Verdict helpers ───────────────────────────────────────────────────────────

function verdictColor(v: string) {
  if (v === "APPROVED") return "text-emerald-400";
  if (v === "APPROVED_WITH_CONDITIONS") return "text-amber-400";
  if (v === "REJECTED") return "text-red-400";
  if (v === "VETOED") return "text-red-600";
  return "text-gray-400";
}

function verdictIcon(v: string) {
  if (v === "APPROVED") return <CheckCircle className="w-5 h-5 text-emerald-400" />;
  if (v === "APPROVED_WITH_CONDITIONS") return <AlertTriangle className="w-5 h-5 text-amber-400" />;
  return <XCircle className="w-5 h-5 text-red-400" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SharedReport() {
  const [, params] = useRoute("/reports/:token");
  const token = params?.token ?? "";
  const [copied, setCopied] = useState(false);

  // Fetch the report
  const { data, isLoading, error } = trpc.shareReport.get.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // Log the view once data loads
  const logView = trpc.shareReport.logView.useMutation();
  useEffect(() => {
    if (data && token) {
      logView.mutate({ token });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  const handleCopy = async () => {
    if (!data) return;
    const rd = data.reportData as unknown as ReportData;
    let text = "";
    if (rd.type === "single_deal") {
      text = `DEAL SCREENING REPORT — ${rd.dealName}\n`;
      text += `Verdict: ${rd.verdict}\n`;
      text += `Consensus: ${Math.round(Number(rd.confidenceScore) * 100)}%\n`;
      text += `Yes: ${rd.yesCount} | No: ${rd.noCount}\n\n`;
      if (rd.conditionsToProceed?.length) {
        text += `CONDITIONS TO PROCEED:\n${rd.conditionsToProceed.map((c: string) => `• ${c}`).join("\n")}\n\n`;
      }
      if (rd.blockingIssues?.length) {
        text += `BLOCKING ISSUES:\n${rd.blockingIssues.map((i: string) => `• ${i}`).join("\n")}\n\n`;
      }
    } else {
      text = `DEAL COMPARISON REPORT\n`;
      text += `Deals: ${rd.dealNames.join(", ")}\n\n`;
      text += `RANKING:\n${rd.rankedDeals.map((d: RankedDeal) => `${d.rank}. ${d.dealName} — Score: ${d.overallScore}/10 — ${d.verdict}`).join("\n")}\n\n`;
      text += `RECOMMENDED: ${rd.comparisonSummary.recommendedDeal}\n${rd.comparisonSummary.recommendationRationale}\n\n`;
      if (rd.comparisonSummary.keyTradeoffs?.length) {
        text += `KEY TRADEOFFS:\n${rd.comparisonSummary.keyTradeoffs.map((t: string) => `• ${t}`).join("\n")}`;
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Error states ──────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center text-gray-400">Invalid report link.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00d4aa] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 font-mono text-sm">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const msg = error.message ?? "This report link is invalid, expired, or has been revoked.";
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center px-4">
        <Card className="bg-[#0f1629] border-red-500/30 max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-white font-bold text-lg mb-2">Report Unavailable</h2>
            <p className="text-gray-400 text-sm">{msg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const rd = data.reportData as unknown as ReportData;
  const expiresIn = Math.max(0, Math.ceil((data.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));

  // ── Single Deal View ──────────────────────────────────────────────────────

  if (rd.type === "single_deal") {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white">
        {/* Header */}
        <div className="border-b border-white/10 bg-[#0f1629]/80 backdrop-blur px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#00d4aa]" />
              <span className="font-mono text-xs text-[#00d4aa] tracking-widest uppercase">AgenThinkMesh · Shared Report</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Expires in {expiresIn}d · {data.viewCount} views</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="border-[#00d4aa]/40 text-[#00d4aa] hover:bg-[#00d4aa]/10 font-mono text-xs"
              >
                {copied ? <><Check className="w-3.5 h-3.5 mr-1" />COPIED</> : <><Copy className="w-3.5 h-3.5 mr-1" />COPY</>}
              </Button>
            </div>
          </div>
        </div>

        {/* Report content */}
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          {/* Title */}
          <div>
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Deal Screening Report</p>
            <h1 className="text-2xl font-bold text-white">{rd.dealName}</h1>
            <p className="text-xs text-gray-500 mt-1">
              Screened {new Date(rd.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Verdict card */}
          <Card className="bg-[#0f1629] border-white/10">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3 mb-4">
                {verdictIcon(rd.verdict)}
                <span className={`text-xl font-bold ${verdictColor(rd.verdict)}`}>
                  {rd.verdict.replace(/_/g, " ")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{Math.round(Number(rd.confidenceScore) * 100)}%</div>
                  <div className="text-xs text-gray-500 mt-1">Consensus</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-400">{rd.yesCount}</div>
                  <div className="text-xs text-gray-500 mt-1">Yes Votes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{rd.noCount}</div>
                  <div className="text-xs text-gray-500 mt-1">No Votes</div>
                </div>
              </div>
              {rd.gccVetoTriggered && (
                <div className="mt-4 px-3 py-2 bg-red-900/30 border border-red-500/30 rounded text-xs text-red-300 font-mono">
                  ⚠ COUNCIL VETO TRIGGERED — Hard block detected by regulatory or legal agent
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conditions */}
          {rd.conditionsToProceed?.length > 0 && (
            <Card className="bg-[#0f1629] border-amber-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono text-amber-400 uppercase tracking-widest">Conditions to Proceed</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {rd.conditionsToProceed.map((c: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-amber-400 mt-0.5">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Blocking issues */}
          {rd.blockingIssues?.length > 0 && (
            <Card className="bg-[#0f1629] border-red-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono text-red-400 uppercase tracking-widest">Blocking Issues</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {rd.blockingIssues.map((issue: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Agent votes */}
          {rd.votes?.length > 0 && (
            <Card className="bg-[#0f1629] border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-mono text-[#00d4aa] uppercase tracking-widest">Council Votes</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {rd.votes.map((v: PersonaVote, i: number) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono shrink-0 ${
                          v.vote?.includes("YES") ? "border-emerald-500/50 text-emerald-400" :
                          v.vote?.includes("NO") ? "border-red-500/50 text-red-400" :
                          "border-gray-500/50 text-gray-400"
                        }`}
                      >
                        {v.vote}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-gray-400 mb-0.5">{v.persona}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{v.rationale}</p>
                      </div>
                      <span className="text-xs text-gray-600 shrink-0">{Math.round(v.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <Separator className="bg-white/10" />
          <p className="text-xs text-center text-gray-600">
            This is a read-only shared report generated by AgenThinkMesh Council of 10.
            Link expires in {expiresIn} day{expiresIn !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>
    );
  }

  // ── Comparison View ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0f1629]/80 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#00d4aa]" />
            <span className="font-mono text-xs text-[#00d4aa] tracking-widest uppercase">AgenThinkMesh · Shared Comparison</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Expires in {expiresIn}d · {data.viewCount} views</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="border-[#00d4aa]/40 text-[#00d4aa] hover:bg-[#00d4aa]/10 font-mono text-xs"
            >
              {copied ? <><Check className="w-3.5 h-3.5 mr-1" />COPIED</> : <><Copy className="w-3.5 h-3.5 mr-1" />COPY</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Title */}
        <div>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Deal Comparison Report</p>
          <h1 className="text-2xl font-bold text-white">{rd.dealNames.join(" vs ")}</h1>
          <p className="text-xs text-gray-500 mt-1">
            Compared {new Date(rd.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Recommendation */}
        <Card className="bg-[#0f1629] border-[#00d4aa]/30">
          <CardContent className="pt-6 pb-6">
            <p className="text-xs font-mono text-[#00d4aa] uppercase tracking-widest mb-2">IC Recommendation</p>
            <p className="text-lg font-bold text-white mb-2">{rd.comparisonSummary.recommendedDeal}</p>
            <p className="text-sm text-gray-400">{rd.comparisonSummary.recommendationRationale}</p>
          </CardContent>
        </Card>

        {/* Rankings */}
        <Card className="bg-[#0f1629] border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono text-[#00d4aa] uppercase tracking-widest">Deal Rankings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {rd.rankedDeals.map((deal: RankedDeal) => (
              <div key={deal.rank} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
                <span className="text-2xl font-bold text-gray-600 w-8 text-center">#{deal.rank}</span>
                <div className="flex-1">
                  <p className="font-semibold text-white">{deal.dealName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-mono ${verdictColor(deal.verdict)}`}>{deal.verdict.replace(/_/g, " ")}</span>
                    {deal.badges?.map((b: string) => (
                      <Badge key={b} variant="outline" className="text-xs border-[#00d4aa]/30 text-[#00d4aa]">{b}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">{deal.overallScore.toFixed(1)}</div>
                  <div className="text-xs text-gray-500">/ 10</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Key tradeoffs */}
        {rd.comparisonSummary.keyTradeoffs?.length > 0 && (
          <Card className="bg-[#0f1629] border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono text-amber-400 uppercase tracking-widest">Key Tradeoffs</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {rd.comparisonSummary.keyTradeoffs.map((t: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Separator className="bg-white/10" />
        <p className="text-xs text-center text-gray-600">
          This is a read-only shared comparison generated by AgenThinkMesh Council of 10.
          Link expires in {expiresIn} day{expiresIn !== 1 ? "s" : ""}.
        </p>
      </div>
    </div>
  );
}
