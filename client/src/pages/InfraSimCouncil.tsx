/**
 * InfraSimCouncil.tsx
 * Governed Infrastructure Stress Simulation v2 — Council Deliberation Transcript
 *
 * Shows the 5-round autonomous council deliberation with per-persona
 * votes, position evolution, dissents, and final IC recommendation.
 */

import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  Users,
} from "lucide-react";

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "APPROVE" || decision === "STRONG_YES")
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-mono">APPROVE</Badge>;
  if (decision === "CONDITIONAL" || decision === "SOFT_YES" || decision === "CONDITIONAL_YES")
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs font-mono">CONDITIONAL</Badge>;
  if (decision === "SOFT_NO")
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs font-mono">SOFT NO</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-mono">REJECT</Badge>;
}

function VoteDot({ vote }: { vote: string }) {
  const color =
    vote === "STRONG_YES" ? "bg-emerald-400" :
    vote === "SOFT_YES" || vote === "CONDITIONAL_YES" ? "bg-amber-400" :
    vote === "SOFT_NO" ? "bg-orange-400" : "bg-red-400";
  return <div className={`w-2.5 h-2.5 rounded-full ${color}`} />;
}

export default function InfraSimCouncil() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id!, 10);
  const [, navigate] = useLocation();
  const [expandedRound, setExpandedRound] = useState<number>(1);
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);

  const { data: rawData, isLoading } = trpc.infraSim.getCouncilSession.useQuery({ sessionId });
  const session = rawData ? {
    ...rawData.session,
    caseTitle: rawData.session.caseId?.toString() ?? "",
    totalVotes: rawData.rounds.reduce((acc: number, r: any) => acc + (r.votesJson ? JSON.parse(r.votesJson).length : 0), 0),
    rounds: rawData.rounds.length,
    voteBreakdown: (() => {
      const allVotes = rawData.rounds.flatMap((r: any) => r.votesJson ? JSON.parse(r.votesJson) : []);
      return {
        strongYes: allVotes.filter((v: any) => v.vote === "HARD_YES").length,
        softYes: allVotes.filter((v: any) => v.vote === "SOFT_YES").length,
        conditionalYes: 0,
        softNo: allVotes.filter((v: any) => v.vote === "SOFT_NO").length,
        hardNo: allVotes.filter((v: any) => v.vote === "HARD_NO").length,
      };
    })(),
    icRecommendation: rawData.session.debateTranscriptJson ? (() => { try { const t = JSON.parse(rawData.session.debateTranscriptJson); return t?.icRecommendation ?? null; } catch { return null; } })() : null,
    rounds_data: rawData.rounds.map((r: any) => ({
      round: r.roundNumber,
      title: r.roundType,
      votes: (r.votesJson ? JSON.parse(r.votesJson) : []).map((v: any) => ({
        ...v,
        personaName: v.personaId,
        emoji: "👤",
        summary: v.argument?.slice(0, 120) ?? "",
        fullStatement: v.argument ?? "",
        keyConditions: [],
        positionChanged: false,
      })),
    })),
  } : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/10 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-mono">Loading council session…</p>
        </div>
      </div>
    );
  }

  if (!rawData || !session) {
    return (
      <div className="min-h-screen bg-[#0B1629] flex items-center justify-center">
        <p className="text-sm text-slate-400">Session not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1629] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d1a2e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/infra-sim/case/${rawData?.session?.caseId ?? ""}`)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                <h1 className="text-sm font-semibold text-white">Council Deliberation</h1>
                <DecisionBadge decision={session.finalDecision ?? "PENDING"} />
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                {session.caseTitle} · {session.totalVotes} votes · {session.rounds} rounds ·{" "}
                {new Date(session.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Vote Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Strong YES", count: session.voteBreakdown?.strongYes ?? 0, color: "text-emerald-400" },
            { label: "Soft YES / Conditional", count: (session.voteBreakdown?.softYes ?? 0) + (session.voteBreakdown?.conditionalYes ?? 0), color: "text-amber-400" },
            { label: "Soft NO", count: session.voteBreakdown?.softNo ?? 0, color: "text-orange-400" },
            { label: "Hard NO", count: session.voteBreakdown?.hardNo ?? 0, color: "text-red-400" },
          ].map(({ label, count, color }) => (
            <Card key={label} className="bg-[#0d1a2e] border-white/5">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 font-mono mb-1">{label}</div>
                <div className={`text-2xl font-bold ${color}`}>{count}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Final IC Recommendation */}
        {session.icRecommendation && (
          <Card className="bg-gradient-to-r from-[#0d1a2e] to-[#0f1e35] border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                IC Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 mb-4">
                <DecisionBadge decision={session.finalDecision ?? "PENDING"} />
                <p className="text-sm text-slate-300 leading-relaxed">{session.icRecommendation.verdict}</p>
              </div>
              {session.icRecommendation.theBet && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-3">
                  <div className="text-xs text-blue-400 font-mono uppercase tracking-wide mb-1">The Bet</div>
                  <p className="text-sm text-white">{session.icRecommendation.theBet}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {session.icRecommendation.reasonsFor?.length > 0 && (
                  <div>
                    <div className="text-xs text-emerald-400 font-mono uppercase tracking-wide mb-2">Reasons For</div>
                    <ul className="space-y-1">
                      {session.icRecommendation.reasonsFor.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {session.icRecommendation.reasonsAgainst?.length > 0 && (
                  <div>
                    <div className="text-xs text-red-400 font-mono uppercase tracking-wide mb-2">Reasons Against</div>
                    <ul className="space-y-1">
                      {session.icRecommendation.reasonsAgainst.map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {session.icRecommendation.whatWouldChangeDecision && (
                <div className="mt-4 p-3 rounded-lg bg-white/3 border border-white/5">
                  <div className="text-xs text-slate-400 font-mono uppercase tracking-wide mb-1">What Would Change Decision</div>
                  <p className="text-xs text-slate-300">{session.icRecommendation.whatWouldChangeDecision}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Rounds */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white">Deliberation Rounds</h2>
          {session.rounds_data?.map((round: any) => (
            <Card key={round.round} className="bg-[#0d1a2e] border-white/5">
              <button
                className="w-full p-5 flex items-center justify-between hover:bg-white/3 transition-colors rounded-xl"
                onClick={() => setExpandedRound(expandedRound === round.round ? 0 : round.round)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                    <span className="text-xs text-blue-400 font-mono">{round.round}</span>
                  </div>
                  <div className="text-sm font-semibold text-white">{round.title ?? `Round ${round.round}`}</div>
                  <div className="flex items-center gap-1">
                    {round.votes?.map((v: any) => (
                      <VoteDot key={v.personaId} vote={v.vote} />
                    ))}
                  </div>
                </div>
                {expandedRound === round.round ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {expandedRound === round.round && (
                <div className="px-5 pb-5 space-y-3">
                  {round.votes?.map((v: any) => (
                    <div
                      key={v.personaId}
                      className="rounded-lg border border-white/5 bg-white/3 overflow-hidden"
                    >
                      <button
                        className="w-full p-4 flex items-start gap-3 hover:bg-white/3 transition-colors text-left"
                        onClick={() => setExpandedPersona(expandedPersona === `${round.round}-${v.personaId}` ? null : `${round.round}-${v.personaId}`)}
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-sm">
                          {v.emoji ?? "👤"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-white">{v.personaName}</span>
                            <DecisionBadge decision={v.vote} />
                            {v.positionChanged && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                                Position changed
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-2">{v.summary}</p>
                        </div>
                        {expandedPersona === `${round.round}-${v.personaId}` ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-1" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-1" />
                        )}
                      </button>
                      {expandedPersona === `${round.round}-${v.personaId}` && (
                        <div className="px-4 pb-4 pt-0 border-t border-white/5">
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{v.fullStatement}</p>
                          {v.keyConditions?.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs text-slate-500 font-mono uppercase tracking-wide mb-1">Key Conditions</div>
                              <ul className="space-y-1">
                                {v.keyConditions.map((c: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                                    <div className="w-1 h-1 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                                    {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
