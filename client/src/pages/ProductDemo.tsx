import { useEffect, useRef, useState, useCallback } from "react";

// ─── Audio URLs (CDN-hosted via manus-storage) ───────────────────────────────
const AUDIO_URLS: Record<string, string> = {
  scene1: "/manus-storage/scene1_4d165d06.mp3",
  scene2: "/manus-storage/scene2_7f5fcdbf.mp3",
  scene3: "/manus-storage/scene3_8e74ace1.mp3",
  scene4: "/manus-storage/scene4_01e4cb6a.mp3",
  scene5: "/manus-storage/scene5_25555127.mp3",
  scene6: "/manus-storage/scene6_7a6e3245.mp3",
  scene7: "/manus-storage/scene7_c778232c.mp3",
  scene8: "/manus-storage/scene8_1cc2f8bd.mp3",
};

// ─── Scene Data ───────────────────────────────────────────────────────────────
interface SceneConfig {
  id: string;
  title: string;
  subtitle?: string;
  component: "hook" | "intro" | "input" | "council" | "verdict" | "memo" | "advanced" | "cta";
}

const SCENES: SceneConfig[] = [
  { id: "scene1", title: "The Problem", component: "hook" },
  { id: "scene2", title: "The Platform", component: "intro" },
  { id: "scene3", title: "Submit a Deal", component: "input" },
  { id: "scene4", title: "Council Activates", component: "council" },
  { id: "scene5", title: "The Verdict", component: "verdict" },
  { id: "scene6", title: "IC Memo", component: "memo" },
  { id: "scene7", title: "Advanced Features", component: "advanced" },
  { id: "scene8", title: "Start Today", component: "cta" },
];

// ─── Agent Data ───────────────────────────────────────────────────────────────
const AGENTS = [
  { id: "gcc_reg", name: "GCC Regional Analyst", vote: "YES", confidence: 88, delay: 0 },
  { id: "gcc_shariah", name: "Shariah Compliance Officer", vote: "YES", confidence: 92, delay: 300 },
  { id: "gcc_financial", name: "Financial Modeler", vote: "YES", confidence: 79, delay: 600 },
  { id: "gcc_geo", name: "Geopolitical Risk Advisor", vote: "CONDITIONAL", confidence: 71, delay: 900 },
  { id: "gcc_market", name: "Market Intelligence Agent", vote: "YES", confidence: 84, delay: 1200 },
  { id: "gcc_legal", name: "Legal & Regulatory Counsel", vote: "YES", confidence: 86, delay: 1500 },
  { id: "gcc_esg", name: "ESG & Impact Analyst", vote: "YES", confidence: 77, delay: 1800 },
  { id: "gcc_ops", name: "Operational Due Diligence", vote: "YES", confidence: 81, delay: 2100 },
  { id: "gcc_exit", name: "Exit Strategy Architect", vote: "YES", confidence: 83, delay: 2400 },
  { id: "gcc_devil", name: "Devil's Advocate", vote: "NO", confidence: 65, delay: 2700 },
];

const MEMO_SECTIONS = [
  "Executive Summary",
  "3 Reasons to Invest",
  "3 Reasons NOT to Invest",
  "Financial Model Analysis",
  "Shariah Compliance Status",
  "Geopolitical Risk Assessment",
  "Market Sizing & Competitive Moat",
  "Monte Carlo Return Scenarios",
  "Pattern Match: Similar Deals",
  "IC Recommendation",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SceneHook({ active }: { active: boolean }) {
  return (
    <div className="scene-content flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-1000 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="text-6xl font-bold text-white mb-6 leading-tight">
          <span className="block">Days of review.</span>
          <span className="block text-amber-400">Millions wasted.</span>
        </div>
        <div className="text-2xl text-slate-300 max-w-2xl leading-relaxed">
          What if ten specialized AI agents could evaluate any deal in under{" "}
          <span className="text-amber-400 font-semibold">60 seconds</span> — and give you a better answer?
        </div>
      </div>
      <div className={`mt-12 grid grid-cols-3 gap-8 transition-all duration-1000 delay-500 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        {[
          { label: "Hours Saved", value: "200+", sub: "per deal" },
          { label: "Analyst Cost", value: "$0", sub: "vs $2,000/deal" },
          { label: "Time to Verdict", value: "< 60s", sub: "end-to-end" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="text-4xl font-bold text-amber-400 mb-1">{stat.value}</div>
            <div className="text-slate-200 font-medium">{stat.label}</div>
            <div className="text-slate-500 text-sm">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneIntro({ active }: { active: boolean }) {
  return (
    <div className="scene-content flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-800 ${active ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
        <div className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-4">Introducing</div>
        <div className="text-7xl font-bold text-white mb-4">AgenThinkMesh</div>
        <div className="text-2xl text-amber-400 font-medium mb-8">The Multi-Agent Investment Decision Council</div>
        <div className="text-lg text-slate-300 max-w-2xl leading-relaxed mb-12">
          Built for GCC institutional investors, global venture capital, and private equity teams.
        </div>
      </div>
      <div className={`grid grid-cols-3 gap-6 max-w-3xl transition-all duration-800 delay-400 ${active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        {[
          { label: "GCC Institutional", icon: "🏛️", desc: "Shariah-compliant, regional focus" },
          { label: "Global VC", icon: "🌐", desc: "Growth-stage, global lens" },
          { label: "India PE/VC", icon: "📈", desc: "Emerging market specialist" },
        ].map((lens) => (
          <div key={lens.label} className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-left">
            <div className="text-3xl mb-3">{lens.icon}</div>
            <div className="text-white font-semibold mb-1">{lens.label}</div>
            <div className="text-slate-400 text-sm">{lens.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneInput({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) { setStep(0); return; }
    const timers = [
      setTimeout(() => setStep(1), 400),
      setTimeout(() => setStep(2), 1200),
      setTimeout(() => setStep(3), 2200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return (
    <div className="scene-content flex flex-col items-center justify-center h-full px-8">
      <div className={`text-center mb-10 transition-all duration-600 ${active ? "opacity-100" : "opacity-0"}`}>
        <div className="text-4xl font-bold text-white mb-2">Submit a Deal</div>
        <div className="text-slate-400">Three ways to get started</div>
      </div>
      <div className="grid grid-cols-3 gap-6 max-w-4xl w-full">
        {[
          {
            label: "Guided Form",
            icon: "📋",
            desc: "7 structured fields",
            fields: ["Company Name", "Sector", "Stage", "Ask Size", "Revenue", "Team Size", "Region"],
            highlight: step >= 1,
          },
          {
            label: "Expert Brief",
            icon: "✍️",
            desc: "Free-text paste",
            fields: ["Paste your own brief, term sheet, or one-pager"],
            highlight: step >= 2,
          },
          {
            label: "Data Room",
            icon: "📁",
            desc: "Upload documents",
            fields: ["PDF, DOCX, XLSX, ZIP", "Up to 50 files · 20 MB each", "Auto-extracted by AI"],
            highlight: step >= 3,
          },
        ].map((mode) => (
          <div
            key={mode.label}
            className={`rounded-2xl border p-6 transition-all duration-500 ${
              mode.highlight
                ? "bg-amber-500/15 border-amber-500/50 shadow-lg shadow-amber-500/10"
                : "bg-white/5 border-white/10"
            }`}
          >
            <div className="text-3xl mb-3">{mode.icon}</div>
            <div className="text-white font-bold text-lg mb-1">{mode.label}</div>
            <div className="text-amber-400 text-sm mb-4">{mode.desc}</div>
            <ul className="space-y-1">
              {mode.fields.map((f) => (
                <li key={f} className="text-slate-400 text-xs flex items-start gap-1">
                  <span className="text-amber-500 mt-0.5">›</span> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={`mt-8 text-slate-400 text-sm transition-all duration-600 delay-700 ${step >= 3 ? "opacity-100" : "opacity-0"}`}>
        Today we're evaluating a <span className="text-amber-400 font-medium">Series B fintech from Riyadh</span>
      </div>
    </div>
  );
}

function SceneCouncil({ active }: { active: boolean }) {
  const [visibleAgents, setVisibleAgents] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!active) { setVisibleAgents(new Set()); setAnalyzing(false); return; }
    setAnalyzing(true);
    const timers = AGENTS.map((agent) =>
      setTimeout(() => {
        setVisibleAgents((prev) => new Set(Array.from(prev).concat(agent.id)));
      }, agent.delay + 500)
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return (
    <div className="scene-content flex flex-col items-center justify-center h-full px-8">
      <div className={`text-center mb-8 transition-all duration-600 ${active ? "opacity-100" : "opacity-0"}`}>
        <div className="text-4xl font-bold text-white mb-2">Council Activates</div>
        <div className="text-slate-400">
          {analyzing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              10 agents deliberating in parallel
            </span>
          ) : "10 specialized agents"}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3 max-w-5xl w-full">
        {AGENTS.map((agent) => {
          const visible = visibleAgents.has(agent.id);
          const voteColor =
            agent.vote === "YES" ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" :
            agent.vote === "NO" ? "text-red-400 border-red-500/40 bg-red-500/10" :
            "text-amber-400 border-amber-500/40 bg-amber-500/10";
          return (
            <div
              key={agent.id}
              className={`rounded-xl border p-3 transition-all duration-500 ${
                visible
                  ? `${voteColor} opacity-100 scale-100`
                  : "bg-white/3 border-white/5 opacity-30 scale-95"
              }`}
            >
              <div className="text-xs text-slate-400 mb-2 leading-tight">{agent.name}</div>
              {visible ? (
                <>
                  <div className={`text-sm font-bold mb-1 ${
                    agent.vote === "YES" ? "text-emerald-400" :
                    agent.vote === "NO" ? "text-red-400" : "text-amber-400"
                  }`}>{agent.vote}</div>
                  <div className="text-xs text-slate-500">{agent.confidence}% conf.</div>
                </>
              ) : (
                <div className="flex gap-0.5 mt-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SceneVerdict({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return (
    <div className="scene-content flex flex-col items-center justify-center h-full px-8">
      <div className={`text-center mb-10 transition-all duration-600 ${active ? "opacity-100" : "opacity-0"}`}>
        <div className="text-4xl font-bold text-white mb-2">Weighted Consensus</div>
        <div className="text-slate-400">Every vote counts — weighted by domain expertise</div>
      </div>

      {/* Score bar */}
      <div className={`w-full max-w-2xl mb-8 transition-all duration-600 delay-300 ${phase >= 1 ? "opacity-100" : "opacity-0"}`}>
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Consensus Score</span>
          <span className="text-amber-400 font-bold text-lg">81 / 100</span>
        </div>
        <div className="h-4 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-1500 ease-out"
            style={{ width: phase >= 2 ? "81%" : "0%" }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>REJECTED &lt;50</span>
          <span>CONDITIONAL 50–75</span>
          <span>APPROVED &gt;75</span>
        </div>
      </div>

      {/* Verdict badge */}
      <div className={`transition-all duration-800 ${phase >= 3 ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
          <div className="relative bg-emerald-500/20 border-2 border-emerald-500 rounded-3xl px-16 py-8 text-center">
            <div className="text-emerald-400 text-sm font-semibold tracking-widest uppercase mb-2">Council Verdict</div>
            <div className="text-6xl font-black text-emerald-400 mb-2">APPROVED</div>
            <div className="text-slate-400">8 YES · 1 CONDITIONAL · 1 NO</div>
          </div>
        </div>
      </div>

      {/* Threshold legend */}
      <div className={`mt-8 flex gap-6 transition-all duration-600 delay-500 ${phase >= 2 ? "opacity-100" : "opacity-0"}`}>
        {[
          { label: "APPROVED", range: "> 75", color: "text-emerald-400" },
          { label: "CONDITIONAL", range: "50–75", color: "text-amber-400" },
          { label: "REJECTED", range: "< 50", color: "text-red-400" },
        ].map((v) => (
          <div key={v.label} className="text-center">
            <div className={`text-sm font-bold ${v.color}`}>{v.label}</div>
            <div className="text-xs text-slate-500">{v.range}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneMemo({ active }: { active: boolean }) {
  const [visibleSections, setVisibleSections] = useState(0);

  useEffect(() => {
    if (!active) { setVisibleSections(0); return; }
    const interval = setInterval(() => {
      setVisibleSections((prev) => {
        if (prev >= MEMO_SECTIONS.length) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 280);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="scene-content flex flex-col items-center justify-center h-full px-8">
      <div className={`text-center mb-8 transition-all duration-600 ${active ? "opacity-100" : "opacity-0"}`}>
        <div className="text-4xl font-bold text-white mb-2">IC Memo Generated</div>
        <div className="text-slate-400">16-section Investment Committee report — instantly</div>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-3xl w-full">
        {MEMO_SECTIONS.map((section, i) => (
          <div
            key={section}
            className={`flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 transition-all duration-400 ${
              i < visibleSections ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
            }`}
          >
            <div className="w-6 h-6 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center text-amber-400 text-xs font-bold flex-shrink-0">
              {i + 1}
            </div>
            <span className="text-slate-200 text-sm">{section}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneAdvanced({ active }: { active: boolean }) {
  return (
    <div className="scene-content flex flex-col items-center justify-center h-full px-8">
      <div className={`text-center mb-10 transition-all duration-600 ${active ? "opacity-100" : "opacity-0"}`}>
        <div className="text-4xl font-bold text-white mb-2">Go Deeper</div>
        <div className="text-slate-400">Advanced workflows for serious investors</div>
      </div>
      <div className="grid grid-cols-2 gap-6 max-w-4xl w-full">
        {[
          {
            icon: "📊",
            title: "CFO Deep Dive",
            desc: "Granular financial stress testing across 6 dimensions — cash flow, burn, unit economics, cap table, sensitivity, and exit scenarios.",
            delay: "delay-100",
          },
          {
            icon: "⚖️",
            title: "Deal Comparison",
            desc: "Submit two deals simultaneously. The council evaluates both and produces a side-by-side comparative IC Memo with a ranked recommendation.",
            delay: "delay-200",
          },
          {
            icon: "🔧",
            title: "Decision Upgrade Protocol",
            desc: "For rejected deals: the system identifies exactly which conditions, if met, would flip the verdict to APPROVED. A roadmap to investability.",
            delay: "delay-300",
          },
          {
            icon: "📚",
            title: "Deal History & Pipeline",
            desc: "Every evaluation stored. Searchable by sector, stage, verdict. Export to PDF. Share via secure link. Move deals through pipeline stages.",
            delay: "delay-400",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className={`bg-white/5 border border-white/10 rounded-2xl p-6 transition-all duration-700 ${feature.delay} ${
              active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="text-3xl mb-3">{feature.icon}</div>
            <div className="text-white font-bold text-lg mb-2">{feature.title}</div>
            <div className="text-slate-400 text-sm leading-relaxed">{feature.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneCTA({ active }: { active: boolean }) {
  return (
    <div className="scene-content flex flex-col items-center justify-center h-full text-center px-8">
      <div className={`transition-all duration-1000 ${active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
        <div className="text-slate-400 text-sm font-semibold tracking-widest uppercase mb-6">Ready to start?</div>
        <div className="text-7xl font-black text-white mb-4">
          Agen<span className="text-amber-400">Think</span>Mesh
        </div>
        <div className="flex items-center justify-center gap-8 text-2xl font-bold text-amber-400 mb-10">
          <span>10 Agents</span>
          <span className="text-white/20">·</span>
          <span>1 Verdict</span>
          <span className="text-white/20">·</span>
          <span>60 Seconds</span>
        </div>
        <div className="text-xl text-slate-300 mb-12">
          Start your free evaluation today.
        </div>
        <a
          href="/deal-screener"
          className="inline-block bg-amber-500 hover:bg-amber-400 text-black font-bold text-xl px-12 py-5 rounded-2xl transition-all duration-200 hover:scale-105 shadow-2xl shadow-amber-500/30"
        >
          Launch Deal Screener →
        </a>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductDemo() {
  const [currentScene, setCurrentScene] = useState(-1); // -1 = not started
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sceneStartTimeRef = useRef<number>(0);

  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const playScene = useCallback(
    async (sceneIndex: number) => {
      if (sceneIndex >= SCENES.length) {
        setIsPlaying(false);
        setCurrentScene(SCENES.length); // show end state
        return;
      }

      setCurrentScene(sceneIndex);
      const sceneId = SCENES[sceneIndex].id;
      const audioUrl = AUDIO_URLS[sceneId];

      stopProgress();

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const audio = new Audio(audioUrl);
      audio.muted = isMuted;
      audioRef.current = audio;

      sceneStartTimeRef.current = Date.now();

      audio.addEventListener("timeupdate", () => {
        if (audio.duration) {
          const sceneProgress = audio.currentTime / audio.duration;
          const overallProgress = (sceneIndex + sceneProgress) / SCENES.length;
          setProgress(overallProgress * 100);
        }
      });

      audio.addEventListener("ended", () => {
        // Small pause between scenes
        setTimeout(() => playScene(sceneIndex + 1), 600);
      });

      audio.addEventListener("error", () => {
        // If audio fails, advance after 4 seconds
        setTimeout(() => playScene(sceneIndex + 1), 4000);
      });

      try {
        await audio.play();
      } catch {
        // Autoplay blocked — advance after 4 seconds
        setTimeout(() => playScene(sceneIndex + 1), 4000);
      }
    },
    [isMuted, stopProgress]
  );

  const handleStart = useCallback(() => {
    setIsPlaying(true);
    setProgress(0);
    playScene(0);
  }, [playScene]);

  const handlePause = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const handleRestart = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    stopProgress();
    setCurrentScene(-1);
    setIsPlaying(false);
    setProgress(0);
  }, [stopProgress]);

  const handleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  const handleSceneJump = useCallback(
    (index: number) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      stopProgress();
      setIsPlaying(true);
      playScene(index);
    },
    [playScene, stopProgress]
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      stopProgress();
    };
  }, [stopProgress]);

  const renderScene = (scene: SceneConfig, active: boolean) => {
    switch (scene.component) {
      case "hook": return <SceneHook active={active} />;
      case "intro": return <SceneIntro active={active} />;
      case "input": return <SceneInput active={active} />;
      case "council": return <SceneCouncil active={active} />;
      case "verdict": return <SceneVerdict active={active} />;
      case "memo": return <SceneMemo active={active} />;
      case "advanced": return <SceneAdvanced active={active} />;
      case "cta": return <SceneCTA active={active} />;
      default: return null;
    }
  };

  const isFinished = currentScene >= SCENES.length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d0d1a] to-[#0a0a0f]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Main demo container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col" style={{ minHeight: "100vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-black text-sm">A</span>
            </div>
            <span className="text-white font-bold">AgenThinkMesh</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-sm">Deal Screener Demo</span>
          </div>
          <div className="flex items-center gap-2">
            {currentScene >= 0 && !isFinished && (
              <button
                onClick={handleMute}
                className="text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 text-sm"
              >
                {isMuted ? "🔇 Unmute" : "🔊 Mute"}
              </button>
            )}
            {currentScene >= 0 && (
              <button
                onClick={handleRestart}
                className="text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 text-sm"
              >
                ↺ Restart
              </button>
            )}
            <a
              href="/deal-screener"
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Try Live →
            </a>
          </div>
        </div>

        {/* Scene viewport */}
        <div className="flex-1 relative rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden" style={{ minHeight: 520 }}>

          {/* Not started — splash */}
          {currentScene === -1 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-4">Product Demo</div>
              <div className="text-6xl font-black text-white mb-4">Deal Screener</div>
              <div className="text-xl text-slate-400 mb-10 max-w-lg">
                A 4-minute walkthrough of the world's first multi-agent investment decision council.
              </div>
              <button
                onClick={handleStart}
                className="group relative bg-amber-500 hover:bg-amber-400 text-black font-bold text-xl px-14 py-5 rounded-2xl transition-all duration-200 hover:scale-105 shadow-2xl shadow-amber-500/30"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-black/20 rounded-full flex items-center justify-center">▶</span>
                  Watch Demo
                </span>
              </button>
              <div className="mt-6 text-slate-600 text-sm">~4 minutes · Voice narration · No signup required</div>
            </div>
          )}

          {/* Active scenes */}
          {SCENES.map((scene, index) => (
            <div
              key={scene.id}
              className={`absolute inset-0 transition-all duration-700 ${
                currentScene === index
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              {renderScene(scene, currentScene === index)}
            </div>
          ))}

          {/* Finished state */}
          {isFinished && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-emerald-400 text-sm font-semibold tracking-widest uppercase mb-4">Demo Complete</div>
              <div className="text-5xl font-black text-white mb-4">Ready to evaluate?</div>
              <div className="text-xl text-slate-400 mb-10">Your first evaluation is free.</div>
              <div className="flex gap-4">
                <a
                  href="/deal-screener"
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-lg px-10 py-4 rounded-2xl transition-all hover:scale-105"
                >
                  Launch Deal Screener →
                </a>
                <button
                  onClick={handleRestart}
                  className="border border-white/20 hover:border-white/40 text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all hover:bg-white/5"
                >
                  ↺ Watch Again
                </button>
              </div>
            </div>
          )}

          {/* Scene label overlay */}
          {currentScene >= 0 && currentScene < SCENES.length && (
            <div className="absolute top-6 left-6 flex items-center gap-3">
              <div className="bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-1 text-amber-400 text-xs font-semibold">
                {currentScene + 1} / {SCENES.length}
              </div>
              <div className="text-slate-400 text-sm">{SCENES[currentScene].title}</div>
            </div>
          )}

          {/* Pause/play overlay button */}
          {currentScene >= 0 && !isFinished && (
            <button
              onClick={handlePause}
              className="absolute bottom-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 mb-2">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Scene navigation dots */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {SCENES.map((scene, index) => (
            <button
              key={scene.id}
              onClick={() => currentScene >= 0 && handleSceneJump(index)}
              disabled={currentScene < 0}
              title={scene.title}
              className={`transition-all duration-300 rounded-full ${
                currentScene === index
                  ? "w-8 h-2 bg-amber-400"
                  : index < currentScene
                  ? "w-2 h-2 bg-amber-600 hover:bg-amber-500"
                  : "w-2 h-2 bg-white/20 hover:bg-white/40"
              } disabled:cursor-not-allowed`}
            />
          ))}
        </div>

        {/* Scene labels */}
        <div className="flex items-center justify-center gap-1 mt-2">
          {SCENES.map((scene, index) => (
            <button
              key={scene.id}
              onClick={() => currentScene >= 0 && handleSceneJump(index)}
              disabled={currentScene < 0}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                currentScene === index ? "text-amber-400" : "text-slate-600 hover:text-slate-400"
              } disabled:cursor-not-allowed`}
            >
              {scene.title}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
