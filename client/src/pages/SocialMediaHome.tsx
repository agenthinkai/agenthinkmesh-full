// ─── Social Media Intelligence Hub ───────────────────────────────────────────
// Entry page at /social — 5 GCC social media agent workflows

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type WorkflowType =
  | "arabic_localizer"
  | "cross_publisher"
  | "brand_safety"
  | "influencer_discovery"
  | "crisis_detection";

interface Workflow {
  id: WorkflowType;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  badge: string;
  agents: string[];
  protocol: string;
}

const WORKFLOWS: Workflow[] = [
  {
    id: "arabic_localizer",
    name: "Arabic Content Localizer",
    tagline: "Authentic Gulf Arabic — not just translation",
    description:
      "Localise your English social content into Kuwaiti, Saudi, and Emirati dialects with cultural nuance, native slang, and brand alignment. Three dialect specialists run in parallel.",
    icon: "🔤",
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
    badge: "Kimi · Long-Context",
    agents: ["Dialect Analyst", "Gulf Copywriter", "Quality Checker"],
    protocol: "Kimi",
  },
  {
    id: "cross_publisher",
    name: "Cross-Platform Publisher",
    tagline: "One post → 5 platform-native formats",
    description:
      "Write once, publish everywhere. Reformats your content for Instagram, LinkedIn, X, TikTok, and Snapchat — each with platform-native tone, character limits, hashtags, and GCC audience insights.",
    icon: "📱",
    color: "from-blue-500/20 to-indigo-500/10 border-blue-500/30",
    badge: "OpenClaw · Multi-Platform",
    agents: ["Content Strategist", "Platform Formatter", "Publishing Scheduler"],
    protocol: "OpenClaw",
  },
  {
    id: "brand_safety",
    name: "Brand Safety Guardian",
    tagline: "NemoClaw guardrails before posts go live",
    description:
      "Scans every post for brand guideline violations, cultural insensitivity, competitor mentions, and Shariah compliance issues before publishing. Outputs PUBLISH / HOLD / REJECT with a cleaned version.",
    icon: "🛡️",
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/30",
    badge: "NemoClaw · Guardrails",
    agents: ["Content Scanner", "Shariah Compliance Checker", "Safety Decision Agent"],
    protocol: "NemoClaw",
  },
  {
    id: "influencer_discovery",
    name: "Influencer Discovery",
    tagline: "Find GCC influencers — Shariah-safe, high-engagement",
    description:
      "Discovers GCC influencers by niche, engagement rate, platform, and Shariah-safe flag. Generates a campaign brief with budget estimates, deliverables, and KPIs — ready to send to your media agency.",
    icon: "🌟",
    color: "from-purple-500/20 to-pink-500/10 border-purple-500/30",
    badge: "OpenClaw · Discovery",
    agents: ["Influencer Matcher", "Campaign Brief Generator"],
    protocol: "OpenClaw",
  },
  {
    id: "crisis_detection",
    name: "Crisis Detection & Escalation",
    tagline: "Detect viral risk before it spreads",
    description:
      "Analyses brand mentions for sentiment, viral risk, and crisis indicators. Classifies severity (Watch/Alert/Critical/Emergency), recommends whether to pause posting, and generates Arabic + English response drafts.",
    icon: "⚠️",
    color: "from-red-500/20 to-rose-500/10 border-red-500/30",
    badge: "NemoClaw · Crisis",
    agents: ["Sentiment Analyzer", "Crisis Classifier", "Response Strategist"],
    protocol: "NemoClaw",
  },
];

const MARKETS = ["Kuwait", "Saudi Arabia", "UAE", "Bahrain", "Qatar", "Oman", "GCC (All)"];
const DIALECTS = ["kuwaiti", "saudi", "emirati"];
const PLATFORMS = ["instagram", "linkedin", "x", "tiktok", "snapchat"];

export default function SocialMediaHome() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [selected, setSelected] = useState<WorkflowType | null>(null);
  const [brandName, setBrandName] = useState("X-cite");
  const [market, setMarket] = useState("Kuwait");
  const [sourceContent, setSourceContent] = useState(
    "X-cite — Kuwait's #1 electronics destination. Shop the latest smartphones, laptops, and home appliances. Free delivery on orders above KWD 20."
  );
  const [selectedDialects, setSelectedDialects] = useState<string[]>(["kuwaiti", "saudi", "emirati"]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "linkedin", "x", "tiktok", "snapchat"]);
  const [brandGuidelines, setBrandGuidelines] = useState("Professional tone, no competitor mentions, Shariah-compliant, family-friendly");
  const [niche, setNiche] = useState("Consumer Electronics");
  const [minFollowers, setMinFollowers] = useState(10000);
  const [requireShariahSafe, setRequireShariahSafe] = useState(true);
  const [brandMentions, setBrandMentions] = useState(
    "@xcite your service is terrible! Waited 3 hours and no one helped me.\nThis is the worst experience I've had. Never again!\nJust had an amazing experience at X-cite — staff were so helpful!\nX-cite prices are way too high compared to competitors\nBoycott X-cite! They don't care about customers"
  );

  const startRun = trpc.socialMedia.startRun.useMutation({
    onSuccess: (data) => {
      navigate(`/social/run/${data.workflowType}/${data.runId}`);
    },
  });

  const handleRun = () => {
    if (!selected) return;
    if (!user) {
      window.location.href = getLoginUrl("/social");
      return;
    }
    startRun.mutate({
      workflowType: selected,
      brandName,
      market,
      sourceContent: selected === "arabic_localizer" ? sourceContent : undefined,
      targetDialects: selected === "arabic_localizer" ? selectedDialects : undefined,
      postContent: selected === "cross_publisher" ? sourceContent : undefined,
      platforms: selected === "cross_publisher" ? selectedPlatforms : undefined,
      contentToCheck: selected === "brand_safety" ? sourceContent : undefined,
      brandGuidelines: selected === "brand_safety" ? brandGuidelines : undefined,
      niche: selected === "influencer_discovery" ? niche : undefined,
      minFollowers: selected === "influencer_discovery" ? minFollowers : undefined,
      requireShariahSafe: selected === "influencer_discovery" ? requireShariahSafe : undefined,
      brandMentions: selected === "crisis_detection" ? brandMentions : undefined,
    });
  };

  const toggleDialect = (d: string) =>
    setSelectedDialects((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const togglePlatform = (p: string) =>
    setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const selectedWorkflow = WORKFLOWS.find((w) => w.id === selected);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d0d14]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/")}
                className="text-white/40 hover:text-white/70 text-sm transition-colors"
              >
                ← AgenThinkMesh
              </button>
              <span className="text-white/20">/</span>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-lg">
                  📣
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Social Media Intelligence</h1>
                  <p className="text-xs text-white/50">GCC-native social agents · OpenClaw · NemoClaw · Kimi</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-xs">5 Agents</Badge>
              <Badge className="bg-white/10 text-white/60 border-white/20 text-xs">GCC-Native</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Workflow Selector */}
          <div className="lg:col-span-2 space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-1">Select a workflow</h2>
              <p className="text-sm text-white/50">
                Five GCC social media intelligence workflows — each powered by specialist agents.
              </p>
            </div>

            {WORKFLOWS.map((wf) => (
              <div
                key={wf.id}
                onClick={() => setSelected(wf.id)}
                className={`relative rounded-xl border p-5 cursor-pointer transition-all bg-gradient-to-br ${wf.color} ${
                  selected === wf.id
                    ? "ring-2 ring-white/40 scale-[1.01]"
                    : "hover:scale-[1.005] hover:ring-1 hover:ring-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl mt-0.5">{wf.icon}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white text-base">{wf.name}</h3>
                        <Badge className="bg-white/10 text-white/60 border-white/20 text-[10px] px-2 py-0">
                          {wf.protocol}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/60 mb-2 italic">{wf.tagline}</p>
                      <p className="text-sm text-white/70 leading-relaxed">{wf.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {wf.agents.map((a) => (
                          <span
                            key={a}
                            className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 transition-all ${
                      selected === wf.id
                        ? "border-white bg-white"
                        : "border-white/30"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Right: Config Panel */}
          <div className="space-y-4">
            <Card className="bg-[#0d0d14] border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-white/80">Brand Config</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-white/60 mb-1.5 block">Brand Name</Label>
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. X-cite"
                    className="bg-white/5 border-white/10 text-white text-sm h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/60 mb-1.5 block">Market</Label>
                  <Select value={market} onValueChange={setMarket}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a2e] border-white/10">
                      {MARKETS.map((m) => (
                        <SelectItem key={m} value={m} className="text-white/80 hover:text-white">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Workflow-specific config */}
            {selected === "arabic_localizer" && (
              <Card className="bg-[#0d0d14] border-emerald-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-emerald-300">Localizer Config</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5 block">Source Content (English)</Label>
                    <Textarea
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                      rows={4}
                      className="bg-white/5 border-white/10 text-white text-sm resize-none"
                      placeholder="Paste your English post here..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60 mb-2 block">Target Dialects</Label>
                    <div className="space-y-2">
                      {DIALECTS.map((d) => (
                        <div key={d} className="flex items-center gap-2">
                          <Checkbox
                            id={d}
                            checked={selectedDialects.includes(d)}
                            onCheckedChange={() => toggleDialect(d)}
                            className="border-white/30"
                          />
                          <label htmlFor={d} className="text-sm text-white/70 capitalize cursor-pointer">
                            {d === "kuwaiti" ? "🇰🇼 Kuwaiti" : d === "saudi" ? "🇸🇦 Saudi" : "🇦🇪 Emirati"}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selected === "cross_publisher" && (
              <Card className="bg-[#0d0d14] border-blue-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-blue-300">Publisher Config</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5 block">Post Content</Label>
                    <Textarea
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                      rows={4}
                      className="bg-white/5 border-white/10 text-white text-sm resize-none"
                      placeholder="Paste your post here..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60 mb-2 block">Target Platforms</Label>
                    <div className="space-y-2">
                      {PLATFORMS.map((p) => (
                        <div key={p} className="flex items-center gap-2">
                          <Checkbox
                            id={p}
                            checked={selectedPlatforms.includes(p)}
                            onCheckedChange={() => togglePlatform(p)}
                            className="border-white/30"
                          />
                          <label htmlFor={p} className="text-sm text-white/70 capitalize cursor-pointer">
                            {p === "instagram" ? "📸 Instagram" : p === "linkedin" ? "💼 LinkedIn" : p === "x" ? "𝕏 X (Twitter)" : p === "tiktok" ? "🎵 TikTok" : "👻 Snapchat"}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selected === "brand_safety" && (
              <Card className="bg-[#0d0d14] border-amber-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-amber-300">Safety Config</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5 block">Content to Check</Label>
                    <Textarea
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                      rows={4}
                      className="bg-white/5 border-white/10 text-white text-sm resize-none"
                      placeholder="Paste the post to check..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5 block">Brand Guidelines</Label>
                    <Textarea
                      value={brandGuidelines}
                      onChange={(e) => setBrandGuidelines(e.target.value)}
                      rows={2}
                      className="bg-white/5 border-white/10 text-white text-sm resize-none"
                      placeholder="e.g. Professional tone, no competitor mentions..."
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {selected === "influencer_discovery" && (
              <Card className="bg-[#0d0d14] border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-purple-300">Discovery Config</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5 block">Niche / Category</Label>
                    <Input
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      placeholder="e.g. Consumer Electronics"
                      className="bg-white/5 border-white/10 text-white text-sm h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5 block">
                      Min. Followers: {minFollowers.toLocaleString()}
                    </Label>
                    <input
                      type="range"
                      min={1000}
                      max={1000000}
                      step={1000}
                      value={minFollowers}
                      onChange={(e) => setMinFollowers(Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="shariah"
                      checked={requireShariahSafe}
                      onCheckedChange={(v) => setRequireShariahSafe(!!v)}
                      className="border-white/30"
                    />
                    <label htmlFor="shariah" className="text-sm text-white/70 cursor-pointer">
                      ☪️ Require Shariah-safe influencers only
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {selected === "crisis_detection" && (
              <Card className="bg-[#0d0d14] border-red-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-red-300">Crisis Config</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-white/60 mb-1.5 block">Brand Mentions / Comments</Label>
                    <Textarea
                      value={brandMentions}
                      onChange={(e) => setBrandMentions(e.target.value)}
                      rows={6}
                      className="bg-white/5 border-white/10 text-white text-sm resize-none"
                      placeholder="Paste recent brand mentions, comments, or tweets here..."
                    />
                    <p className="text-[10px] text-white/30 mt-1">One mention per line</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Run Button */}
            <Button
              onClick={handleRun}
              disabled={!selected || startRun.isPending}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold h-12 text-base disabled:opacity-40"
            >
              {startRun.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </span>
              ) : selected ? (
                `Run ${selectedWorkflow?.name ?? "Workflow"} →`
              ) : (
                "Select a workflow to continue"
              )}
            </Button>

            {/* Agent Registry Preview */}
            <Card className="bg-[#0d0d14] border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs text-white/50 uppercase tracking-wider">Agent Registry</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {WORKFLOWS.flatMap((wf) =>
                    wf.agents.map((a) => (
                      <div key={`${wf.id}-${a}`} className="flex items-center justify-between">
                        <span className="text-xs text-white/60">{a}</span>
                        <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full">
                          {wf.protocol}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
