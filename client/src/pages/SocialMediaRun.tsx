// ─── Social Media Intelligence Run Page ──────────────────────────────────────
// Live SSE pipeline run page for all 5 social media workflows

import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkflowType =
  | "arabic_localizer"
  | "cross_publisher"
  | "brand_safety"
  | "influencer_discovery"
  | "crisis_detection";

interface AgentStep {
  agentId: string;
  agentName: string;
  status: "pending" | "running" | "complete" | "failed";
  output?: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
}

interface PipelineEvent {
  type: string;
  agentId?: string;
  agentName?: string;
  output?: Record<string, unknown>;
  error?: string;
  steps?: Array<{ agentId: string; agentName: string }>;
  blackboard?: Record<string, unknown>;
  workflowType?: string;
  brandName?: string;
}

const WORKFLOW_META: Record<WorkflowType, { name: string; icon: string; color: string; decisionKey: string }> = {
  arabic_localizer: { name: "Arabic Content Localizer", icon: "🔤", color: "emerald", decisionKey: "localizationComplete" },
  cross_publisher: { name: "Cross-Platform Publisher", icon: "📱", color: "blue", decisionKey: "publishingReady" },
  brand_safety: { name: "Brand Safety Guardian", icon: "🛡️", color: "amber", decisionKey: "safetyDecision" },
  influencer_discovery: { name: "Influencer Discovery", icon: "🌟", color: "purple", decisionKey: "campaignBriefReady" },
  crisis_detection: { name: "Crisis Detection", icon: "⚠️", color: "red", decisionKey: "crisisSeverity" },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-white/30",
  running: "text-yellow-400",
  complete: "text-emerald-400",
  failed: "text-red-400",
};

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  running: "◉",
  complete: "●",
  failed: "✕",
};

export default function SocialMediaRun() {
  const params = useParams<{ runType: string; runId: string }>();
  const [, navigate] = useLocation();
  const runType = (params.runType ?? "arabic_localizer") as WorkflowType;
  const runId = params.runId ?? "";

  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [blackboard, setBlackboard] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<"connecting" | "running" | "complete" | "error">("connecting");
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const meta = WORKFLOW_META[runType] ?? WORKFLOW_META.arabic_localizer;

  useEffect(() => {
    if (!runId) return;

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const es = new EventSource(`/api/social/stream/${runType}/${runId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: PipelineEvent = JSON.parse(e.data);

        if (event.type === "pipeline_start" && event.steps) {
          setSteps(
            event.steps.map((s) => ({
              agentId: s.agentId,
              agentName: s.agentName,
              status: "pending",
            }))
          );
          setStatus("running");
        }

        if (event.type === "agent_start" && event.agentId) {
          setSteps((prev) =>
            prev.map((s) =>
              s.agentId === event.agentId
                ? { ...s, status: "running", startedAt: Date.now() }
                : s
            )
          );
        }

        if (event.type === "agent_complete" && event.agentId) {
          setSteps((prev) =>
            prev.map((s) =>
              s.agentId === event.agentId
                ? { ...s, status: "complete", output: event.output, completedAt: Date.now() }
                : s
            )
          );
        }

        if (event.type === "agent_failed" && event.agentId) {
          setSteps((prev) =>
            prev.map((s) =>
              s.agentId === event.agentId
                ? { ...s, status: "failed", completedAt: Date.now() }
                : s
            )
          );
        }

        if (event.type === "pipeline_complete" && event.blackboard) {
          setBlackboard(event.blackboard as Record<string, unknown>);
          setStatus("complete");
          es.close();
          if (timerRef.current) clearInterval(timerRef.current);
        }

        if (event.type === "pipeline_error") {
          setErrorMsg(event.error ?? "Pipeline failed");
          setStatus("error");
          es.close();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      if (status !== "complete") {
        setErrorMsg("Connection lost. The pipeline may still be running.");
        setStatus("error");
      }
      es.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };

    return () => {
      es.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runId, runType]);

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d0d14]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/social")}
                className="text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                ← Social Media Intelligence
              </button>
              <span className="text-white/20">/</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <h1 className="text-base font-bold text-white">{meta.name}</h1>
                  <p className="text-xs text-white/40">Run #{runId}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40 font-mono">{elapsed}s</span>
              <Badge
                className={
                  status === "complete"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : status === "error"
                    ? "bg-red-500/20 text-red-300 border-red-500/30"
                    : status === "running"
                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                    : "bg-white/10 text-white/50 border-white/20"
                }
              >
                {status === "connecting" ? "Connecting…" : status === "running" ? "Running" : status === "complete" ? "Complete" : "Error"}
              </Badge>
            </div>
          </div>

          {/* Progress bar */}
          {steps.length > 0 && (
            <div className="mt-3">
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-white/30">{completedCount}/{steps.length} agents complete</span>
                <span className="text-[10px] text-white/30">{progress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Pipeline Rail */}
          <div className="space-y-3">
            <h2 className="text-xs text-white/40 uppercase tracking-wider mb-4">Agent Pipeline</h2>
            {steps.length === 0 && status === "connecting" && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            )}
            {steps.map((step, idx) => (
              <div
                key={step.agentId}
                className={`rounded-xl border p-4 transition-all ${
                  step.status === "running"
                    ? "border-yellow-500/40 bg-yellow-500/5"
                    : step.status === "complete"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : step.status === "failed"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-white/10 bg-white/3"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-mono ${STATUS_COLORS[step.status]}`}>
                    {step.status === "running" ? (
                      <span className="inline-block animate-spin">◉</span>
                    ) : (
                      STATUS_ICONS[step.status]
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/30 font-mono">{String(idx + 1).padStart(2, "0")}</span>
                      <span className="text-sm font-medium text-white truncate">{step.agentName}</span>
                    </div>
                    {step.status === "running" && (
                      <p className="text-[10px] text-yellow-400/70 mt-0.5 animate-pulse">Processing…</p>
                    )}
                    {step.status === "complete" && step.output && (
                      <p className="text-[10px] text-emerald-400/70 mt-0.5 truncate">
                        {typeof step.output.summary === "string"
                          ? step.output.summary
                          : "Output ready"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Output */}
          <div className="lg:col-span-2 space-y-6">
            {status === "connecting" && (
              <div className="flex items-center justify-center h-64 text-white/30">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-pink-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">Connecting to pipeline…</p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
                <h3 className="text-red-300 font-bold mb-2">Pipeline Error</h3>
                <p className="text-sm text-red-200/70">{errorMsg}</p>
                <Button
                  onClick={() => navigate("/social")}
                  className="mt-4 bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/30"
                  variant="outline"
                >
                  ← Back to Social Media Hub
                </Button>
              </div>
            )}

            {/* Live step outputs while running */}
            {status === "running" && (
              <div className="space-y-4">
                {steps
                  .filter((s) => s.status === "complete" && s.output)
                  .map((step) => (
                    <Card key={step.agentId} className="bg-[#0d0d14] border-white/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-white/70 flex items-center gap-2">
                          <span className="text-emerald-400">●</span>
                          {step.agentName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs text-white/50 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                          {typeof step.output?.summary === "string"
                            ? step.output.summary
                            : JSON.stringify(step.output, null, 2).slice(0, 500)}
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}

            {/* Final output sections */}
            {status === "complete" && (
              <div className="space-y-6">
                {/* Arabic Localizer Output */}
                {runType === "arabic_localizer" && (
                  <>
                    <DecisionBanner
                      icon="🔤"
                      title="Localisation Complete"
                      subtitle="3 Gulf Arabic dialect versions ready"
                      color="emerald"
                    />
                    {(["kuwaiti", "saudi", "emirati"] as const).map((dialect) => {
                      const key = `${dialect}Version`;
                      const content = blackboard[key] as string | undefined;
                      return content ? (
                        <Card key={dialect} className="bg-[#0d0d14] border-emerald-500/20">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-emerald-300 flex items-center gap-2">
                              {dialect === "kuwaiti" ? "🇰🇼 Kuwaiti Arabic" : dialect === "saudi" ? "🇸🇦 Saudi Arabic" : "🇦🇪 Emirati Arabic"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p dir="rtl" className="text-sm text-white/80 leading-relaxed font-arabic text-right">
                              {content}
                            </p>
                          </CardContent>
                        </Card>
                      ) : null;
                    })}
                    {blackboard.qualityNotes && (
                      <Card className="bg-[#0d0d14] border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white/60">Quality Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/60">{String(blackboard.qualityNotes)}</p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Cross Publisher Output */}
                {runType === "cross_publisher" && (
                  <>
                    <DecisionBanner
                      icon="📱"
                      title="Publishing Ready"
                      subtitle="5 platform-native formats generated"
                      color="blue"
                    />
                    {(["instagram", "linkedin", "x", "tiktok", "snapchat"] as const).map((platform) => {
                      const key = `${platform}Post`;
                      const content = blackboard[key] as string | undefined;
                      return content ? (
                        <Card key={platform} className="bg-[#0d0d14] border-blue-500/20">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-blue-300">
                              {platform === "instagram" ? "📸 Instagram" : platform === "linkedin" ? "💼 LinkedIn" : platform === "x" ? "𝕏 X (Twitter)" : platform === "tiktok" ? "🎵 TikTok" : "👻 Snapchat"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-white/80 whitespace-pre-wrap">{content}</p>
                          </CardContent>
                        </Card>
                      ) : null;
                    })}
                    {blackboard.schedulingRecommendation && (
                      <Card className="bg-[#0d0d14] border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white/60">Scheduling Recommendation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/60">{String(blackboard.schedulingRecommendation)}</p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Brand Safety Output */}
                {runType === "brand_safety" && (
                  <>
                    <SafetyDecisionBanner decision={blackboard.safetyDecision as string} />
                    {blackboard.issues && (
                      <Card className="bg-[#0d0d14] border-amber-500/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-amber-300">Issues Found</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/70 whitespace-pre-wrap">{String(blackboard.issues)}</p>
                        </CardContent>
                      </Card>
                    )}
                    {blackboard.cleanedVersion && (
                      <Card className="bg-[#0d0d14] border-emerald-500/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-emerald-300">Cleaned Version</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/80 whitespace-pre-wrap">{String(blackboard.cleanedVersion)}</p>
                        </CardContent>
                      </Card>
                    )}
                    {blackboard.shariahFlag && (
                      <Card className="bg-[#0d0d14] border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white/60">Shariah Compliance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/60">{String(blackboard.shariahFlag)}</p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Influencer Discovery Output */}
                {runType === "influencer_discovery" && (
                  <>
                    <DecisionBanner
                      icon="🌟"
                      title="Campaign Brief Ready"
                      subtitle={`${(blackboard.influencers as unknown[])?.length ?? 0} influencers matched`}
                      color="purple"
                    />
                    {Array.isArray(blackboard.influencers) && blackboard.influencers.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(blackboard.influencers as Array<Record<string, unknown>>).map((inf, i) => (
                          <Card key={i} className="bg-[#0d0d14] border-purple-500/20">
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-bold text-white text-sm">{String(inf.name ?? "")}</p>
                                  <p className="text-xs text-white/50">{String(inf.platform ?? "")} · {String(inf.niche ?? "")}</p>
                                </div>
                                {!!inf.shariahSafe && (
                                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                                    ☪️ Halal
                                  </Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                  <p className="text-white/40">Followers</p>
                                  <p className="text-white font-mono">{Number(inf.followers ?? 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 text-center">
                                  <p className="text-white/40">Engagement</p>
                                  <p className="text-white font-mono">{String(inf.engagementRate ?? "")}%</p>
                                </div>
                              </div>
                              <p className="text-xs text-white/50 mt-2">Est. fee: {String(inf.estimatedFee ?? "")}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    {blackboard.campaignBrief && (
                      <Card className="bg-[#0d0d14] border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white/60">Campaign Brief</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/70 whitespace-pre-wrap">{String(blackboard.campaignBrief)}</p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Crisis Detection Output */}
                {runType === "crisis_detection" && (
                  <>
                    <CrisisBanner severity={blackboard.crisisSeverity as string} />
                    {blackboard.sentimentBreakdown && (
                      <Card className="bg-[#0d0d14] border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white/60">Sentiment Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/70 whitespace-pre-wrap">{String(blackboard.sentimentBreakdown)}</p>
                        </CardContent>
                      </Card>
                    )}
                    {blackboard.pauseRecommendation && (
                      <Card className={`bg-[#0d0d14] ${String(blackboard.pauseRecommendation).toLowerCase().includes("pause") ? "border-red-500/30" : "border-emerald-500/30"}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white/60">Posting Recommendation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm font-bold text-white">{String(blackboard.pauseRecommendation)}</p>
                        </CardContent>
                      </Card>
                    )}
                    {blackboard.englishResponse && (
                      <Card className="bg-[#0d0d14] border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white/60">English Response Draft</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-white/80 whitespace-pre-wrap">{String(blackboard.englishResponse)}</p>
                        </CardContent>
                      </Card>
                    )}
                    {blackboard.arabicResponse && (
                      <Card className="bg-[#0d0d14] border-white/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-white/60">Arabic Response Draft</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p dir="rtl" className="text-sm text-white/80 whitespace-pre-wrap font-arabic text-right">
                            {String(blackboard.arabicResponse)}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Back button */}
                <div className="pt-4">
                  <Button
                    onClick={() => navigate("/social")}
                    variant="outline"
                    className="bg-white/5 border-white/20 text-white/70 hover:bg-white/10"
                  >
                    ← Run Another Workflow
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DecisionBanner({
  icon,
  title,
  subtitle,
  color,
}: {
  icon: string;
  title: string;
  subtitle: string;
  color: "emerald" | "blue" | "purple";
}) {
  const colorMap = {
    emerald: "from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-300",
    blue: "from-blue-500/20 to-indigo-500/10 border-blue-500/40 text-blue-300",
    purple: "from-purple-500/20 to-pink-500/10 border-purple-500/40 text-purple-300",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-6 ${colorMap[color]}`}>
      <div className="flex items-center gap-4">
        <span className="text-4xl">{icon}</span>
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="text-sm opacity-70 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function SafetyDecisionBanner({ decision }: { decision?: string }) {
  const d = (decision ?? "HOLD").toUpperCase();
  const isPublish = d.includes("PUBLISH");
  const isReject = d.includes("REJECT");
  const color = isPublish
    ? "from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-300"
    : isReject
    ? "from-red-500/20 to-rose-500/10 border-red-500/40 text-red-300"
    : "from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-300";
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-6 ${color}`}>
      <div className="flex items-center gap-4">
        <span className="text-4xl">{isPublish ? "✅" : isReject ? "🚫" : "⏸️"}</span>
        <div>
          <h2 className="text-2xl font-black">{d}</h2>
          <p className="text-sm opacity-70 mt-0.5">Brand Safety Guardian decision</p>
        </div>
      </div>
    </div>
  );
}

function CrisisBanner({ severity }: { severity?: string }) {
  const s = (severity ?? "WATCH").toUpperCase();
  const isEmergency = s.includes("EMERGENCY");
  const isCritical = s.includes("CRITICAL");
  const isAlert = s.includes("ALERT");
  const color = isEmergency || isCritical
    ? "from-red-500/20 to-rose-500/10 border-red-500/40 text-red-300"
    : isAlert
    ? "from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-300"
    : "from-blue-500/20 to-indigo-500/10 border-blue-500/40 text-blue-300";
  const icon = isEmergency ? "🚨" : isCritical ? "⚠️" : isAlert ? "🔔" : "👁️";
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-6 ${color}`}>
      <div className="flex items-center gap-4">
        <span className="text-4xl">{icon}</span>
        <div>
          <h2 className="text-2xl font-black">{s}</h2>
          <p className="text-sm opacity-70 mt-0.5">Crisis severity classification</p>
        </div>
      </div>
    </div>
  );
}
