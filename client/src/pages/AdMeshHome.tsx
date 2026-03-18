import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ── Agent registry (inline for fast render) ──────────────────────────────────
const AGENTS = [
  { id: "ingestor",   name: "Ingestor",      wave: 1, icon: "📥", color: "#60A5FA", role: "Competitive Intelligence Loader" },
  { id: "analyzer",  name: "Analyzer",      wave: 1, icon: "🔍", color: "#34D399", role: "Ad Pattern Extractor" },
  { id: "strategist",name: "Strategist",    wave: 1, icon: "🎯", color: "#A78BFA", role: "Creative Strategy Engine" },
  { id: "copywriter",name: "Copywriter",    wave: 2, icon: "✍️", color: "#F59E0B", role: "Multilingual Ad Generator" },
  { id: "scoring",   name: "Scoring",       wave: 2, icon: "📊", color: "#EC4899", role: "Ad Performance Predictor" },
  { id: "video",     name: "VideoProducer", wave: 2, icon: "🎬", color: "#F97316", role: "Storyboard & Video Director" },
  { id: "performance",name:"Performance",   wave: 2, icon: "📈", color: "#14B8A6", role: "Campaign Intelligence Analyst" },
];

const VOICE_PRESETS = [
  { id: "premium", label: "Premium / Luxury", emoji: "💎", tone: "Aspirational, refined, exclusive" },
  { id: "value",   label: "Value / Deals",    emoji: "🔥", tone: "Urgent, direct, deal-focused" },
  { id: "family",  label: "Family",           emoji: "👨‍👩‍👧‍👦", tone: "Warm, trusted, inclusive" },
  { id: "youth",   label: "Youth / Gen-Z",    emoji: "⚡", tone: "Bold, energetic, culturally fluent" },
  { id: "b2b",     label: "B2B Enterprise",   emoji: "🏢", tone: "Professional, ROI-focused" },
];

const GCC_MARKETS = ["Kuwait", "Saudi Arabia", "UAE", "Qatar", "Bahrain", "Oman"];

export default function AdMeshHome() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  // Form state
  const [brandName, setBrandName] = useState("X-cite");
  const [brandVoice, setBrandVoice] = useState("value");
  const [category, setCategory] = useState("Consumer Electronics");
  const [market, setMarket] = useState("Kuwait");
  const [competitors, setCompetitors] = useState("Eureka, Sharaf DG, iStyle");
  const [mode] = useState<"demo" | "live">("demo");
  const [isRunning, setIsRunning] = useState(false);

  const startRun = trpc.admesh.startRun.useMutation({
    onSuccess: (data) => {
      navigate(`/admesh/run/${data.runId}`);
    },
    onError: (err) => {
      setIsRunning(false);
      console.error("Failed to start AdMesh:", err.message);
    },
  });

  const handleRun = () => {
    if (!user) {
      window.location.href = getLoginUrl("/admesh");
      return;
    }
    if (!brandName.trim()) {
      alert("Brand name is required");
      return;
    }
    setIsRunning(true);
    const competitorList = competitors.split(",").map((c) => c.trim()).filter(Boolean);
    startRun.mutate({ brandName: brandName.trim(), brandVoice, category, market, competitors: competitorList, languages: "en,ar", mode });
  };

  const loadXciteDemo = () => {
    setBrandName("X-cite");
    setBrandVoice("value");
    setCategory("Consumer Electronics");
    setMarket("Kuwait");
    setCompetitors("Eureka, Sharaf DG, iStyle");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-[#0D0D14]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center text-lg">🎯</div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">AdMesh</h1>
              <p className="text-xs text-white/50">AI Creative Intelligence · GCC Enterprise</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-orange-500/40 text-orange-400 text-xs">Demo Mode</Badge>
            <Badge variant="outline" className="border-white/20 text-white/50 text-xs">7 Agents · 2 Waves</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ── Left: Input Form ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Hero */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🎯</span>
              <h2 className="text-2xl font-bold">Creative Intelligence Engine</h2>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              7 specialist agents analyse your competitors, craft a winning strategy, generate 10 bilingual ads (English + Arabic Gulf dialect), produce storyboards, and score everything — in under 60 seconds.
            </p>
          </div>

          {/* Demo loader */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
            <span className="text-orange-400 text-sm font-medium">⚡ X-cite Demo preloaded</span>
            <span className="text-white/40 text-xs">Kuwait · Consumer Electronics · Eureka, Sharaf DG, iStyle</span>
            <button onClick={loadXciteDemo} className="ml-auto text-xs text-orange-400 hover:text-orange-300 underline">Reset</button>
          </div>

          {/* Brand inputs */}
          <Card className="bg-[#13131A] border-white/10">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Brand Configuration</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Brand Name *</Label>
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. X-cite"
                    className="bg-[#0D0D14] border-white/10 text-white placeholder:text-white/30 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Category</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Consumer Electronics"
                    className="bg-[#0D0D14] border-white/10 text-white placeholder:text-white/30 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">Market</Label>
                <div className="flex flex-wrap gap-2">
                  {GCC_MARKETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMarket(m)}
                      className={`px-3 py-1 rounded-full text-xs border transition-all ${
                        market === m
                          ? "bg-orange-500/20 border-orange-500/60 text-orange-300"
                          : "border-white/10 text-white/50 hover:border-white/30"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-white/60">Competitors (comma-separated)</Label>
                <Textarea
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  placeholder="e.g. Eureka, Sharaf DG, iStyle"
                  rows={2}
                  className="bg-[#0D0D14] border-white/10 text-white placeholder:text-white/30 text-sm resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Voice */}
          <Card className="bg-[#13131A] border-white/10">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Brand Voice</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {VOICE_PRESETS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setBrandVoice(v.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      brandVoice === v.id
                        ? "border-orange-500/60 bg-orange-500/10"
                        : "border-white/10 hover:border-white/20 bg-transparent"
                    }`}
                  >
                    <span className="text-xl mt-0.5">{v.emoji}</span>
                    <div>
                      <p className={`text-sm font-medium ${brandVoice === v.id ? "text-orange-300" : "text-white/80"}`}>{v.label}</p>
                      <p className="text-xs text-white/40 mt-0.5">{v.tone}</p>
                    </div>
                    {brandVoice === v.id && (
                      <span className="ml-auto text-orange-400 text-xs mt-1">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Languages */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-[#13131A]">
            <span className="text-sm text-white/60">Languages:</span>
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">🇬🇧 English (5 ads)</Badge>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30">🇸🇦 Arabic Gulf (5 ads)</Badge>
            <span className="ml-auto text-xs text-white/30">RTL rendering included</span>
          </div>

          {/* Run Button */}
          <Button
            onClick={handleRun}
            disabled={isRunning || startRun.isPending}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-400 hover:to-pink-500 border-0 text-white shadow-lg shadow-orange-500/20"
          >
            {isRunning || startRun.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Launching AdMesh...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                🚀 Run AdMesh
                <span className="text-white/60 text-sm font-normal">· ~45 seconds</span>
              </span>
            )}
          </Button>

          {!user && (
            <p className="text-center text-xs text-white/40">
              You'll be asked to sign in before the run starts.
            </p>
          )}
        </div>

        {/* ── Right: Agent Registry ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Agent Pipeline</h3>

          {/* Wave 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/40 px-2">Wave 1 · Parallel</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            {AGENTS.filter((a) => a.wave === 1).map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#13131A] border border-white/5">
                <span className="text-lg">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90">{agent.name}</p>
                  <p className="text-xs text-white/40 truncate">{agent.role}</p>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
              </div>
            ))}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-1">
              <div className="w-px h-4 bg-white/20" />
              <span className="text-white/30 text-xs">↓ sequential</span>
              <div className="w-px h-4 bg-white/20" />
            </div>
          </div>

          {/* Wave 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/40 px-2">Wave 2 · Sequential</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            {AGENTS.filter((a) => a.wave === 2).map((agent, idx) => (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#13131A] border border-white/5">
                <span className="text-xs text-white/30 w-4 text-center font-mono">{idx + 1}</span>
                <span className="text-lg">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90">{agent.name}</p>
                  <p className="text-xs text-white/40 truncate">{agent.role}</p>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
              </div>
            ))}
          </div>

          {/* Output preview */}
          <div className="p-4 rounded-lg border border-white/10 bg-[#13131A] space-y-2 mt-2">
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Output</p>
            {[
              { icon: "🔍", label: "Competitor insights" },
              { icon: "🎯", label: "Creative strategy brief" },
              { icon: "📝", label: "10 ads (5 EN + 5 AR)" },
              { icon: "🎬", label: "2 video storyboards" },
              { icon: "📊", label: "Ad scoring + top picks" },
              { icon: "📈", label: "Performance recommendations" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-white/50">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="space-y-2">
            <button
              onClick={() => navigate("/admesh/history")}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-white/10 hover:border-white/20 text-sm text-white/60 hover:text-white/80 transition-all"
            >
              <span>📋 Run History</span>
              <span className="text-white/30">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
