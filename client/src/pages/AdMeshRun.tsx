import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ── Types (mirrored from server) ──────────────────────────────────────────────
interface AdOutput {
  language: "en" | "ar";
  adIndex: number;
  hook: string;
  body: string;
  cta: string;
  visualDirection: string;
  targetAudience: string;
  hookScore: number;
  clarityScore: number;
  brandFitScore: number;
  localRelevanceScore: number;
  ctrPotentialScore: number;
  overallScore: number;
  isTopPick: boolean;
}

interface StoryboardScene {
  sceneNumber: number;
  duration: string;
  visual: string;
  voiceover: string;
  textOverlay: string;
  transition: string;
}

interface Storyboard {
  adIndex: number;
  language: "en" | "ar";
  title: string;
  duration: string;
  scenes: StoryboardScene[];
  musicDirection: string;
  colorPalette: string;
}

interface PipelineEvent {
  type: string;
  agentId?: string;
  agentName?: string;
  wave?: number;
  output?: unknown;
  error?: string;
  competitorInsights?: unknown;
  strategy?: unknown;
  ads?: AdOutput[];
  storyboards?: Storyboard[];
  performanceInsights?: unknown;
  totalTokens?: number;
  durationMs?: number;
}

interface AgentStep {
  id: string;
  name: string;
  wave: number;
  icon: string;
  color: string;
  status: "pending" | "running" | "complete" | "failed";
  output?: unknown;
}

// ── Agent definitions ─────────────────────────────────────────────────────────
const AGENT_DEFS: AgentStep[] = [
  { id: "ingestor",    name: "Ingestor",      wave: 1, icon: "📥", color: "#60A5FA", status: "pending" },
  { id: "analyzer",   name: "Analyzer",      wave: 1, icon: "🔍", color: "#34D399", status: "pending" },
  { id: "strategist", name: "Strategist",    wave: 1, icon: "🎯", color: "#A78BFA", status: "pending" },
  { id: "copywriter", name: "Copywriter",    wave: 2, icon: "✍️", color: "#F59E0B", status: "pending" },
  { id: "scoring",    name: "Scoring",       wave: 2, icon: "📊", color: "#EC4899", status: "pending" },
  { id: "video",      name: "VideoProducer", wave: 2, icon: "🎬", color: "#F97316", status: "pending" },
  { id: "performance",name: "Performance",   wave: 2, icon: "📈", color: "#14B8A6", status: "pending" },
];

// ── Score bar component ───────────────────────────────────────────────────────
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/50">{label}</span>
        <span className="font-mono" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Ad Card ───────────────────────────────────────────────────────────────────
function AdCard({ ad, onApprove }: { ad: AdOutput; onApprove: (ad: AdOutput) => void }) {
  const [approved, setApproved] = useState(false);
  const isArabic = ad.language === "ar";

  return (
    <div className={`relative rounded-xl border p-4 space-y-3 transition-all ${
      ad.isTopPick
        ? "border-orange-500/50 bg-orange-500/5 shadow-lg shadow-orange-500/10"
        : "border-white/10 bg-[#13131A]"
    }`}>
      {ad.isTopPick && (
        <div className="absolute -top-2.5 left-4">
          <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 border-0">⭐ Top Pick</Badge>
        </div>
      )}

      {/* Language + score */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={`text-xs ${isArabic ? "border-green-500/40 text-green-400" : "border-blue-500/40 text-blue-400"}`}>
          {isArabic ? "🇸🇦 Arabic Gulf" : "🇬🇧 English"} · Ad {ad.adIndex}
        </Badge>
        {ad.overallScore > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="text-xs text-white/40">Score</div>
            <div className={`text-sm font-bold font-mono ${ad.overallScore >= 85 ? "text-green-400" : ad.overallScore >= 70 ? "text-yellow-400" : "text-red-400"}`}>
              {ad.overallScore}
            </div>
          </div>
        )}
      </div>

      {/* Ad content — RTL for Arabic */}
      <div dir={isArabic ? "rtl" : "ltr"} className={`space-y-2 ${isArabic ? "text-right font-arabic" : ""}`}>
        <p className="text-sm font-semibold text-white leading-snug">{ad.hook}</p>
        <p className="text-xs text-white/60 leading-relaxed">{ad.body}</p>
        <div className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
          <span className="px-3 py-1 rounded-full bg-white/10 text-xs text-white/80 font-medium">{ad.cta}</span>
          {ad.targetAudience && (
            <span className="text-xs text-white/30">→ {ad.targetAudience}</span>
          )}
        </div>
      </div>

      {/* Visual direction */}
      {ad.visualDirection && (
        <div className="text-xs text-white/40 italic border-t border-white/5 pt-2">
          🎨 {ad.visualDirection}
        </div>
      )}

      {/* Scores */}
      {ad.overallScore > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-white/5 pt-3">
          <ScoreBar label="Hook" value={ad.hookScore} color="#F59E0B" />
          <ScoreBar label="Clarity" value={ad.clarityScore} color="#60A5FA" />
          <ScoreBar label="Brand Fit" value={ad.brandFitScore} color="#A78BFA" />
          <ScoreBar label="Local" value={ad.localRelevanceScore} color="#34D399" />
          <ScoreBar label="CTR Potential" value={ad.ctrPotentialScore} color="#EC4899" />
        </div>
      )}

      {/* Approve button */}
      <div className="flex justify-end pt-1">
        <button
          onClick={() => { setApproved(!approved); onApprove(ad); }}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
            approved
              ? "bg-green-500/20 border-green-500/40 text-green-400"
              : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/60"
          }`}
        >
          {approved ? "✓ Approved" : "Approve"}
        </button>
      </div>
    </div>
  );
}

// ── Storyboard Card ───────────────────────────────────────────────────────────
function StoryboardCard({ sb }: { sb: Storyboard }) {
  const [expanded, setExpanded] = useState(false);
  const isArabic = sb.language === "ar";

  return (
    <div className="rounded-xl border border-orange-500/30 bg-[#13131A] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-base">🎬</div>
          <div>
            <p className="text-sm font-semibold text-white">{sb.title}</p>
            <p className="text-xs text-white/40">{sb.duration} · {sb.scenes.length} scenes · {isArabic ? "Arabic" : "English"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${isArabic ? "border-green-500/40 text-green-400" : "border-blue-500/40 text-blue-400"}`}>
            {isArabic ? "🇸🇦 AR" : "🇬🇧 EN"}
          </Badge>
          <span className="text-white/40 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          {/* Music + palette */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2 rounded-lg bg-white/5">
              <p className="text-white/40 mb-1">🎵 Music</p>
              <p className="text-white/70">{sb.musicDirection}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <p className="text-white/40 mb-1">🎨 Palette</p>
              <p className="text-white/70">{sb.colorPalette}</p>
            </div>
          </div>

          {/* Scenes */}
          <div className="space-y-3">
            {sb.scenes.map((scene) => (
              <div key={scene.sceneNumber} className="flex gap-3 p-3 rounded-lg bg-white/5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400">
                  {scene.sceneNumber}
                </div>
                <div className="flex-1 space-y-1.5 text-xs" dir={isArabic ? "rtl" : "ltr"}>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">⏱</span>
                    <span className="text-white/60">{scene.duration}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-white/40">{scene.transition}</span>
                  </div>
                  <p className="text-white/80"><span className="text-white/40">🎥 </span>{scene.visual}</p>
                  {scene.voiceover && (
                    <p className="text-white/60 italic"><span className="text-white/30">🎙 </span>"{scene.voiceover}"</p>
                  )}
                  {scene.textOverlay && (
                    <p className="text-orange-300/80"><span className="text-white/30">📝 </span>{scene.textOverlay}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Run Page ─────────────────────────────────────────────────────────────
export default function AdMeshRun() {
  const params = useParams<{ runId: string }>();
  const [, navigate] = useLocation();
  const runId = parseInt(params.runId ?? "0", 10);

  const [agents, setAgents] = useState<AgentStep[]>(AGENT_DEFS.map((a) => ({ ...a })));
  const [status, setStatus] = useState<"connecting" | "running" | "complete" | "failed">("connecting");
  const [competitorInsights, setCompetitorInsights] = useState<unknown>(null);
  const [strategy, setStrategy] = useState<unknown>(null);
  const [ads, setAds] = useState<AdOutput[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [performanceInsights, setPerformanceInsights] = useState<unknown>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [activeTab, setActiveTab] = useState<"pipeline" | "ads" | "storyboards" | "performance">("pipeline");
  const [approvedAds, setApprovedAds] = useState<Set<number>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  const approveAd = trpc.admesh.approveAd.useMutation();

  const handleApprove = useCallback((ad: AdOutput) => {
    setApprovedAds((prev) => {
      const next = new Set(prev);
      if (next.has(ad.adIndex)) next.delete(ad.adIndex);
      else next.add(ad.adIndex);
      return next;
    });
    // Find the DB ad id — we'll use adIndex as proxy since we don't have the DB id here
    // The mutation will be called from the parent with the actual DB id after fetch
  }, []);

  const updateAgent = useCallback((agentId: string, update: Partial<AgentStep>) => {
    setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, ...update } : a));
  }, []);

  useEffect(() => {
    if (!runId) return;

    const es = new EventSource(`/api/admesh/stream/${runId}`);
    eventSourceRef.current = es;
    setStatus("running");

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as PipelineEvent;

        if (event.type === "pipeline_start") {
          // Initialize all agents as pending
          setAgents(AGENT_DEFS.map((a) => ({ ...a, status: "pending" })));
        }

        if (event.type === "agent_start" && event.agentId) {
          updateAgent(event.agentId, { status: "running" });
        }

        if (event.type === "agent_complete" && event.agentId) {
          updateAgent(event.agentId, { status: "complete", output: event.output });
        }

        if (event.type === "agent_failed" && event.agentId) {
          updateAgent(event.agentId, { status: "failed" });
        }

        if (event.type === "pipeline_complete") {
          setStatus("complete");
          if (event.competitorInsights) setCompetitorInsights(event.competitorInsights);
          if (event.strategy) setStrategy(event.strategy);
          if (event.ads) setAds(event.ads);
          if (event.storyboards) setStoryboards(event.storyboards);
          if (event.performanceInsights) setPerformanceInsights(event.performanceInsights);
          if (event.totalTokens) setTotalTokens(event.totalTokens);
          if (event.durationMs) setDurationMs(event.durationMs);
          // Auto-switch to ads tab when complete
          setActiveTab("ads");
          es.close();
        }

        if (event.type === "pipeline_failed") {
          setStatus("failed");
          es.close();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (status !== "complete") setStatus("failed");
      es.close();
    };

    return () => { es.close(); };
  }, [runId]);

  const enAds = ads.filter((a) => a.language === "en").sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
  const arAds = ads.filter((a) => a.language === "ar").sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
  const topPicks = ads.filter((a) => a.isTopPick);

  const strategyObj = strategy as {
    winningAngle?: string;
    strategyBullets?: string[];
    avoidList?: string[];
    keyMessage?: string;
    arabicInsight?: string;
    mediaRecommendation?: string;
  } | null;

  const perfObj = performanceInsights as {
    overallRating?: string;
    ctrAnalysis?: string;
    roasAnalysis?: string;
    cpmAnalysis?: string;
    topInsights?: string[];
    nextRecommendations?: { priority: string; action: string; expectedImpact: string }[];
    budgetAllocation?: Record<string, string>;
    forecastedCTR?: string;
    forecastedROAS?: string;
  } | null;

  const compObj = competitorInsights as {
    brandsLoaded?: string[];
    totalAds?: number;
    source?: string;
    ads?: { brand: string; headline: string; format: string; offer: string }[];
  } | null;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-[#0D0D14] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admesh")} className="text-white/40 hover:text-white/70 text-sm">← AdMesh</button>
            <span className="text-white/20">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center text-xs">🎯</div>
              <span className="text-sm font-medium">Run #{runId}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === "running" && (
              <div className="flex items-center gap-1.5 text-xs text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                Pipeline running
              </div>
            )}
            {status === "complete" && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Complete · {(durationMs / 1000).toFixed(1)}s · {totalTokens.toLocaleString()} tokens
              </div>
            )}
            {status === "failed" && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Pipeline failed
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* ── Tab Navigation ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-white/10 pb-0">
          {[
            { id: "pipeline", label: "Pipeline", icon: "⚡" },
            { id: "ads", label: `Ads ${ads.length > 0 ? `(${ads.length})` : ""}`, icon: "📝" },
            { id: "storyboards", label: `Storyboards ${storyboards.length > 0 ? `(${storyboards.length})` : ""}`, icon: "🎬" },
            { id: "performance", label: "Performance", icon: "📈" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? "border-orange-500 text-white font-medium"
                  : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Pipeline Tab ───────────────────────────────────────────────── */}
        {activeTab === "pipeline" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Rail */}
            <div className="lg:col-span-1 space-y-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Agent Pipeline</h3>

              {/* Wave 1 */}
              <div className="space-y-2">
                <p className="text-xs text-white/30 px-1">Wave 1 · Parallel</p>
                {agents.filter((a) => a.wave === 1).map((agent) => (
                  <div key={agent.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    agent.status === "running" ? "border-white/30 bg-white/5 shadow-sm" :
                    agent.status === "complete" ? "border-green-500/30 bg-green-500/5" :
                    agent.status === "failed" ? "border-red-500/30 bg-red-500/5" :
                    "border-white/5 bg-[#13131A]"
                  }`}>
                    <span className="text-base">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90">{agent.name}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {agent.status === "pending" && <span className="w-2 h-2 rounded-full bg-white/20 block" />}
                      {agent.status === "running" && <span className="w-2 h-2 rounded-full bg-orange-400 block animate-pulse" />}
                      {agent.status === "complete" && <span className="text-green-400 text-xs">✓</span>}
                      {agent.status === "failed" && <span className="text-red-400 text-xs">✗</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center py-1">
                <span className="text-white/20 text-xs">↓</span>
              </div>

              {/* Wave 2 */}
              <div className="space-y-2">
                <p className="text-xs text-white/30 px-1">Wave 2 · Sequential</p>
                {agents.filter((a) => a.wave === 2).map((agent) => (
                  <div key={agent.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    agent.status === "running" ? "border-white/30 bg-white/5 shadow-sm" :
                    agent.status === "complete" ? "border-green-500/30 bg-green-500/5" :
                    agent.status === "failed" ? "border-red-500/30 bg-red-500/5" :
                    "border-white/5 bg-[#13131A]"
                  }`}>
                    <span className="text-base">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/90">{agent.name}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {agent.status === "pending" && <span className="w-2 h-2 rounded-full bg-white/20 block" />}
                      {agent.status === "running" && <span className="w-2 h-2 rounded-full bg-orange-400 block animate-pulse" />}
                      {agent.status === "complete" && <span className="text-green-400 text-xs">✓</span>}
                      {agent.status === "failed" && <span className="text-red-400 text-xs">✗</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Output Panel */}
            <div className="lg:col-span-2 space-y-4">
              {/* Strategy (shows as soon as strategist completes) */}
              {strategyObj && (
                <Card className="bg-[#13131A] border-purple-500/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <h3 className="text-sm font-semibold text-purple-300">Creative Strategy</h3>
                    </div>
                    {strategyObj.winningAngle && (
                      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <p className="text-sm text-white font-medium">"{strategyObj.winningAngle}"</p>
                      </div>
                    )}
                    {strategyObj.strategyBullets && (
                      <ul className="space-y-1.5">
                        {strategyObj.strategyBullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                            <span className="text-purple-400 mt-0.5">→</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {strategyObj.arabicInsight && (
                      <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-xs text-green-300">
                        🇸🇦 {strategyObj.arabicInsight}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Competitor Insights */}
              {compObj && (
                <Card className="bg-[#13131A] border-blue-500/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔍</span>
                      <h3 className="text-sm font-semibold text-blue-300">Competitor Intelligence</h3>
                      <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 ml-auto">
                        {compObj.source}
                      </Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {compObj.brandsLoaded?.map((b) => (
                        <Badge key={b} className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">{b}</Badge>
                      ))}
                      <span className="text-xs text-white/40 self-center">{compObj.totalAds} ads loaded</span>
                    </div>
                    {compObj.ads && (
                      <div className="space-y-1.5">
                        {compObj.ads.slice(0, 3).map((ad, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-white/50 p-2 rounded bg-white/5">
                            <span className="font-medium text-white/70 w-20 flex-shrink-0">{ad.brand}</span>
                            <span className="truncate flex-1">{ad.headline}</span>
                            <span className="text-white/30 flex-shrink-0">{ad.format}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Status when nothing yet */}
              {!strategyObj && !compObj && status === "running" && (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full border-2 border-orange-500/40 border-t-orange-500 animate-spin" />
                  <p className="text-white/50 text-sm">Agents are working...</p>
                  <p className="text-white/30 text-xs">Wave 1 running in parallel</p>
                </div>
              )}

              {status === "complete" && ads.length > 0 && (
                <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 text-center space-y-2">
                  <p className="text-green-400 font-semibold">✓ Pipeline Complete</p>
                  <p className="text-white/50 text-sm">{ads.length} ads generated · {storyboards.length} storyboards · {(durationMs / 1000).toFixed(1)}s</p>
                  <Button onClick={() => setActiveTab("ads")} className="bg-orange-500 hover:bg-orange-400 text-white border-0 text-sm mt-2">
                    View Ads →
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Ads Tab ────────────────────────────────────────────────────── */}
        {activeTab === "ads" && (
          <div className="space-y-6">
            {ads.length === 0 && status === "running" && (
              <div className="text-center py-16 text-white/40">Copywriter agent is generating ads...</div>
            )}

            {/* Top Picks Banner */}
            {topPicks.length > 0 && (
              <div className="p-4 rounded-xl border border-orange-500/40 bg-orange-500/5">
                <p className="text-sm font-semibold text-orange-300 mb-1">⭐ Top 2 Picks — Selected for Video Production</p>
                <div className="flex gap-2 flex-wrap">
                  {topPicks.map((ad) => (
                    <Badge key={`${ad.language}-${ad.adIndex}`} className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                      {ad.language === "ar" ? "🇸🇦 AR" : "🇬🇧 EN"} Ad {ad.adIndex}: "{ad.hook.substring(0, 40)}..." · Score {ad.overallScore}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* English Ads */}
            {enAds.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                  🇬🇧 English Ads
                  <span className="text-white/30 font-normal">({enAds.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {enAds.map((ad) => (
                    <AdCard key={`en-${ad.adIndex}`} ad={ad} onApprove={handleApprove} />
                  ))}
                </div>
              </div>
            )}

            {/* Arabic Ads */}
            {arAds.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-green-300 flex items-center gap-2">
                  🇸🇦 Arabic Gulf Ads
                  <span className="text-white/30 font-normal">({arAds.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {arAds.map((ad) => (
                    <AdCard key={`ar-${ad.adIndex}`} ad={ad} onApprove={handleApprove} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Storyboards Tab ────────────────────────────────────────────── */}
        {activeTab === "storyboards" && (
          <div className="space-y-4">
            {storyboards.length === 0 && status === "running" && (
              <div className="text-center py-16 text-white/40">VideoProducer agent is creating storyboards...</div>
            )}
            {storyboards.length === 0 && status === "complete" && (
              <div className="text-center py-16 text-white/40">No storyboards generated for this run.</div>
            )}
            {storyboards.map((sb, i) => (
              <StoryboardCard key={i} sb={sb} />
            ))}
          </div>
        )}

        {/* ── Performance Tab ────────────────────────────────────────────── */}
        {activeTab === "performance" && (
          <div className="space-y-4">
            {!perfObj && status === "running" && (
              <div className="text-center py-16 text-white/40">Performance agent is analysing metrics...</div>
            )}
            {!perfObj && status === "complete" && (
              <div className="text-center py-16 text-white/40">No performance data available.</div>
            )}

            {perfObj && (
              <>
                {/* Rating banner */}
                <div className={`p-4 rounded-xl border text-center ${
                  perfObj.overallRating === "Strong" ? "border-green-500/40 bg-green-500/5" :
                  perfObj.overallRating === "Average" ? "border-yellow-500/40 bg-yellow-500/5" :
                  "border-red-500/40 bg-red-500/5"
                }`}>
                  <p className={`text-lg font-bold ${
                    perfObj.overallRating === "Strong" ? "text-green-400" :
                    perfObj.overallRating === "Average" ? "text-yellow-400" : "text-red-400"
                  }`}>{perfObj.overallRating} Performance</p>
                  <div className="flex justify-center gap-6 mt-2 text-sm text-white/60">
                    <span>Forecasted CTR: <strong className="text-white">{perfObj.forecastedCTR}</strong></span>
                    <span>Forecasted ROAS: <strong className="text-white">{perfObj.forecastedROAS}</strong></span>
                  </div>
                </div>

                {/* Analysis grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "CTR Analysis", text: perfObj.ctrAnalysis, icon: "📊" },
                    { label: "ROAS Analysis", text: perfObj.roasAnalysis, icon: "💰" },
                    { label: "CPM Analysis", text: perfObj.cpmAnalysis, icon: "📉" },
                  ].map((item) => (
                    <Card key={item.label} className="bg-[#13131A] border-white/10">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-xs font-semibold text-white/60 flex items-center gap-1.5">{item.icon} {item.label}</p>
                        <p className="text-xs text-white/70 leading-relaxed">{item.text}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Insights */}
                {perfObj.topInsights && (
                  <Card className="bg-[#13131A] border-teal-500/30">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-sm font-semibold text-teal-300">💡 Top Insights</p>
                      <ul className="space-y-1.5">
                        {perfObj.topInsights.map((ins, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                            <span className="text-teal-400 mt-0.5">→</span>
                            <span>{ins}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                {perfObj.nextRecommendations && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white/70">Next Recommendations</h3>
                    {perfObj.nextRecommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#13131A] border border-white/10">
                        <Badge className={`text-xs flex-shrink-0 mt-0.5 ${
                          rec.priority === "High" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                          rec.priority === "Medium" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" :
                          "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        }`}>{rec.priority}</Badge>
                        <div className="flex-1">
                          <p className="text-sm text-white/80">{rec.action}</p>
                          <p className="text-xs text-green-400 mt-0.5">Expected: {rec.expectedImpact}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Budget allocation */}
                {perfObj.budgetAllocation && (
                  <Card className="bg-[#13131A] border-white/10">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-semibold text-white/70">Recommended Budget Allocation</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(perfObj.budgetAllocation).map(([platform, pct]) => (
                          <div key={platform} className="text-center p-3 rounded-lg bg-white/5">
                            <p className="text-lg font-bold text-orange-400">{pct}</p>
                            <p className="text-xs text-white/50 capitalize mt-1">{platform}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
