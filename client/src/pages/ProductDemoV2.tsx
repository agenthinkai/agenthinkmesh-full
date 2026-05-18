import { useState, useEffect, useRef, useCallback } from "react";

// ─── CDN Screenshot URLs ──────────────────────────────────────────────────────
const SCREENSHOTS = {
  input:       "/manus-storage/scene_input_e45dc550.png",
  icHeader:    "/manus-storage/scene_gcc_ic_header_7a119a71.png",
  icVerdict:   "/manus-storage/scene_gcc_ic_verdict_2ad39976.png",
  icAgents:    "/manus-storage/scene_gcc_ic_agents_b5371829.png",
  icMemo:      "/manus-storage/scene_gcc_ic_memo_6a6e39a8.png",
  personaSetup:"/manus-storage/scene_persona_setup_6e081014.png",
};

// ─── Audio URLs (same as V1) ──────────────────────────────────────────────────
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

// ─── Scene definitions ────────────────────────────────────────────────────────
interface SceneV2 {
  id: string;
  audioId: string;
  title: string;
  subtitle: string;
  /** Which screenshot to show (null = no screenshot, use abstract bg) */
  screenshot: string | null;
  /** CSS transform-origin for zoom */
  zoomOrigin: string;
  /** Animation type */
  animation: "zoom-in" | "zoom-out" | "pan-right" | "pan-down" | "pan-up" | "fade";
  /** Overlay label shown on the screenshot */
  label?: string;
  /** Highlight box coordinates as % [top, left, width, height] */
  highlight?: [number, number, number, number];
}

const SCENES: SceneV2[] = [
  {
    id: "scene1",
    audioId: "scene1",
    title: "The Problem",
    subtitle: "Days of review. Millions wasted.",
    screenshot: null,
    zoomOrigin: "center",
    animation: "fade",
  },
  {
    id: "scene2",
    audioId: "scene2",
    title: "Choose Your Role",
    subtitle: "14 roles · 325 specialist agents",
    screenshot: SCREENSHOTS.personaSetup,
    zoomOrigin: "50% 30%",
    animation: "zoom-in",
    label: "Step 1 — Select your investment role",
  },
  {
    id: "scene3",
    audioId: "scene3",
    title: "Submit a Deal",
    subtitle: "Paste, type, or upload — any format",
    screenshot: SCREENSHOTS.input,
    zoomOrigin: "50% 60%",
    animation: "zoom-in",
    label: "Deal Input — GCC Screener",
    highlight: [52, 8, 84, 36],
  },
  {
    id: "scene4",
    audioId: "scene4",
    title: "Council Activates",
    subtitle: "10 agents deliberating in parallel",
    screenshot: SCREENSHOTS.icAgents,
    zoomOrigin: "50% 50%",
    animation: "pan-right",
    label: "Agent Breakdown — live deliberation",
  },
  {
    id: "scene5",
    audioId: "scene5",
    title: "Consensus Verdict",
    subtitle: "Weighted by domain expertise",
    screenshot: SCREENSHOTS.icVerdict,
    zoomOrigin: "50% 40%",
    animation: "zoom-in",
    label: "Consensus Verdict",
    highlight: [38, 10, 80, 22],
  },
  {
    id: "scene6",
    audioId: "scene6",
    title: "IC Memo Generated",
    subtitle: "16-section report — instantly",
    screenshot: SCREENSHOTS.icMemo,
    zoomOrigin: "50% 20%",
    animation: "pan-down",
    label: "IC Memo — full investment committee report",
  },
  {
    id: "scene7",
    audioId: "scene7",
    title: "Advanced Features",
    subtitle: "CFO deep-dive · Scenario modelling · Data room",
    screenshot: SCREENSHOTS.icHeader,
    zoomOrigin: "50% 50%",
    animation: "zoom-out",
    label: "Full IC Report — AgenThinkMesh",
  },
  {
    id: "scene8",
    audioId: "scene8",
    title: "Start Today",
    subtitle: "50 free runs · No credit card",
    screenshot: null,
    zoomOrigin: "center",
    animation: "fade",
  },
];

// ─── CSS keyframe injection ───────────────────────────────────────────────────
const STYLE_ID = "product-demo-v2-keyframes";
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pdv2-zoom-in {
      from { transform: scale(1.18); }
      to   { transform: scale(1.0); }
    }
    @keyframes pdv2-zoom-out {
      from { transform: scale(0.88); }
      to   { transform: scale(1.0); }
    }
    @keyframes pdv2-pan-right {
      from { transform: translateX(-6%) scale(1.06); }
      to   { transform: translateX(0%) scale(1.0); }
    }
    @keyframes pdv2-pan-down {
      from { transform: translateY(-6%) scale(1.06); }
      to   { transform: translateY(0%) scale(1.0); }
    }
    @keyframes pdv2-pan-up {
      from { transform: translateY(6%) scale(1.06); }
      to   { transform: translateY(0%) scale(1.0); }
    }
    @keyframes pdv2-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes pdv2-scanline {
      0%   { top: -4px; }
      100% { top: 100%; }
    }
    @keyframes pdv2-highlight-pulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(251,191,36,0.8), 0 0 24px rgba(251,191,36,0.4); }
      50%       { box-shadow: 0 0 0 4px rgba(251,191,36,1),   0 0 48px rgba(251,191,36,0.7); }
    }
    .pdv2-screenshot-wrap {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .pdv2-screenshot-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }
    .pdv2-anim-zoom-in  { animation: pdv2-zoom-in  8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
    .pdv2-anim-zoom-out { animation: pdv2-zoom-out 8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
    .pdv2-anim-pan-right{ animation: pdv2-pan-right 8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
    .pdv2-anim-pan-down { animation: pdv2-pan-down  8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
    .pdv2-anim-pan-up   { animation: pdv2-pan-up    8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
    .pdv2-anim-fade     { animation: pdv2-fade      1.2s ease forwards; }
  `;
  document.head.appendChild(style);
}

// ─── ScreenshotScene component ────────────────────────────────────────────────
function ScreenshotScene({ scene, active }: { scene: SceneV2; active: boolean }) {
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (active) setAnimKey((k) => k + 1);
  }, [active]);

  if (!scene.screenshot) return null;

  const animClass = `pdv2-anim-${scene.animation}`;

  return (
    <div className="pdv2-screenshot-wrap">
      {/* Screenshot image with animation */}
      <div
        key={animKey}
        className={animClass}
        style={{ width: "100%", height: "100%", transformOrigin: scene.zoomOrigin }}
      >
        <img src={scene.screenshot} alt={scene.title} />
      </div>

      {/* Dark gradient overlay — bottom */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Scanline effect */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(to bottom, transparent, rgba(251,191,36,0.15), transparent)",
          animation: "pdv2-scanline 4s linear infinite",
          pointerEvents: "none",
        }}
      />

      {/* Highlight box */}
      {scene.highlight && active && (
        <div
          style={{
            position: "absolute",
            top: `${scene.highlight[0]}%`,
            left: `${scene.highlight[1]}%`,
            width: `${scene.highlight[2]}%`,
            height: `${scene.highlight[3]}%`,
            borderRadius: "8px",
            animation: "pdv2-highlight-pulse 1.8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Screenshot label badge */}
      {scene.label && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "24px",
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(251,191,36,0.4)",
            borderRadius: "8px",
            padding: "6px 14px",
            fontSize: "11px",
            color: "rgba(251,191,36,0.9)",
            fontFamily: "monospace",
            letterSpacing: "0.05em",
            backdropFilter: "blur(8px)",
          }}
        >
          {scene.label}
        </div>
      )}
    </div>
  );
}

// ─── AbstractScene — for scenes without screenshots ───────────────────────────
function AbstractScene({ scene, active }: { scene: SceneV2; active: boolean }) {
  if (scene.id === "scene1") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 48px",
        }}
      >
        <div
          style={{
            transition: "all 1s ease",
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(32px)",
          }}
        >
          <div style={{ fontSize: "64px", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: "24px" }}>
            <span style={{ display: "block" }}>Days of review.</span>
            <span style={{ display: "block", color: "#fbbf24" }}>Millions wasted.</span>
          </div>
          <div style={{ fontSize: "22px", color: "#cbd5e1", maxWidth: "640px", lineHeight: 1.6 }}>
            What if ten specialized AI agents could evaluate any deal in under{" "}
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>60 seconds</span> — and give you a better answer?
          </div>
        </div>
        <div
          style={{
            marginTop: "48px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "24px",
            transition: "all 1s ease 0.5s",
            opacity: active ? 1 : 0,
            transform: active ? "translateY(0)" : "translateY(32px)",
          }}
        >
          {[
            { label: "Hours Saved", value: "200+", sub: "per deal" },
            { label: "Analyst Cost", value: "$0", sub: "vs $2,000/deal" },
            { label: "Time to Verdict", value: "< 60s", sub: "end-to-end" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <div style={{ fontSize: "36px", fontWeight: 700, color: "#fbbf24", marginBottom: "4px" }}>{s.value}</div>
              <div style={{ color: "#e2e8f0", fontWeight: 500 }}>{s.label}</div>
              <div style={{ color: "#64748b", fontSize: "13px" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // scene8 — CTA
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 48px",
      }}
    >
      <div
        style={{
          transition: "all 1s ease",
          opacity: active ? 1 : 0,
          transform: active ? "scale(1)" : "scale(0.9)",
        }}
      >
        <div style={{ color: "#fbbf24", fontSize: "13px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>
          Ready to start?
        </div>
        <div style={{ fontSize: "72px", fontWeight: 900, color: "#fff", marginBottom: "16px" }}>AgenThinkMesh</div>
        <div style={{ fontSize: "24px", color: "#fbbf24", marginBottom: "32px" }}>50 free runs · No credit card required</div>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          {["GCC Institutional", "Global VC", "India PE/VC", "Shariah-Compliant"].map((tag) => (
            <span
              key={tag}
              style={{
                background: "rgba(251,191,36,0.1)",
                border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: "999px",
                padding: "8px 20px",
                color: "#fbbf24",
                fontSize: "14px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductDemoV2() {
  const [currentScene, setCurrentScene] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSceneRef = useRef<number>(-1);
  const preloadCache = useRef<Map<number, HTMLAudioElement>>(new Map());
  const isMutedRef = useRef(false);
  const playSceneRef = useRef<(index: number) => void>(() => {});

  const preloadScene = useCallback((index: number) => {
    if (index < 0 || index >= SCENES.length) return;
    if (preloadCache.current.has(index)) return;
    const a = new Audio();
    a.preload = "auto";
    a.src = AUDIO_URLS[SCENES[index].audioId];
    preloadCache.current.set(index, a);
  }, []);

  const playScene = useCallback(
    (sceneIndex: number) => {
      if (sceneIndex >= SCENES.length) {
        setIsPlaying(false);
        setCurrentScene(SCENES.length);
        currentSceneRef.current = SCENES.length;
        return;
      }

      currentSceneRef.current = sceneIndex;
      setCurrentScene(sceneIndex);
      preloadScene(sceneIndex + 1);
      preloadScene(sceneIndex + 2);

      const cached = preloadCache.current.get(sceneIndex);
      const audio = cached ?? new Audio(AUDIO_URLS[SCENES[sceneIndex].audioId]);
      audio.muted = isMutedRef.current;

      const prev = audioRef.current;
      if (prev && prev !== audio) {
        prev.pause();
        prev.src = "";
        prev.load();
      }
      audioRef.current = audio;

      function onTimeUpdate() {
        if (audio.duration) {
          const sp = audio.currentTime / audio.duration;
          setProgress(((sceneIndex + sp) / SCENES.length) * 100);
        }
      }
      function onEnded() {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        setTimeout(() => playSceneRef.current(sceneIndex + 1), 200);
      }
      function onError() {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        setTimeout(() => playSceneRef.current(sceneIndex + 1), 3000);
      }

      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);

      audio.play().catch(() => {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
        setTimeout(() => playSceneRef.current(sceneIndex + 1), 3000);
      });
    },
    [preloadScene]
  );

  useEffect(() => {
    playSceneRef.current = playScene;
  }, [playScene]);

  const handleStart = useCallback(() => {
    setIsPlaying(true);
    setProgress(0);
    preloadScene(0);
    preloadScene(1);
    playScene(0);
  }, [playScene, preloadScene]);

  const handlePause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleRestart = useCallback(() => {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; audio.load(); }
    audioRef.current = null;
    preloadCache.current.clear();
    currentSceneRef.current = -1;
    setCurrentScene(-1);
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const handleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  const handleSceneJump = useCallback(
    (index: number) => {
      setIsPlaying(true);
      playScene(index);
    },
    [playScene]
  );

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; }
      preloadCache.current.forEach((a) => { a.src = ""; });
      preloadCache.current.clear();
    };
  }, []);

  const scene = currentScene >= 0 && currentScene < SCENES.length ? SCENES[currentScene] : null;
  const ended = currentScene >= SCENES.length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* ── Version badge ── */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          background: "rgba(251,191,36,0.15)",
          border: "1px solid rgba(251,191,36,0.4)",
          borderRadius: "999px",
          padding: "4px 16px",
          fontSize: "11px",
          color: "#fbbf24",
          letterSpacing: "0.1em",
          fontFamily: "monospace",
        }}
      >
        V2 · REAL PAGES EDITION
      </div>

      {/* ── Scene area ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        {/* Background gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 30% 50%, rgba(30,20,60,0.9) 0%, #000 70%)",
          }}
        />

        {/* Screenshot or abstract */}
        {scene && (
          scene.screenshot ? (
            <ScreenshotScene scene={scene} active={true} />
          ) : (
            <AbstractScene scene={scene} active={true} />
          )
        )}

        {/* Start screen */}
        {currentScene === -1 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 48px",
            }}
          >
            <div style={{ marginBottom: "8px", color: "#fbbf24", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              AgenThinkMesh
            </div>
            <div style={{ fontSize: "56px", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: "16px" }}>
              See the Platform<br />
              <span style={{ color: "#fbbf24" }}>In Action</span>
            </div>
            <div style={{ fontSize: "18px", color: "#94a3b8", marginBottom: "40px", maxWidth: "480px" }}>
              Real pages · Real workflow · 8 scenes with narration
            </div>
            <button
              onClick={handleStart}
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#000",
                border: "none",
                borderRadius: "12px",
                padding: "18px 48px",
                fontSize: "18px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 0 40px rgba(245,158,11,0.4)",
                transition: "transform 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              ▶ Play Demo
            </button>
            <div style={{ marginTop: "16px", color: "#475569", fontSize: "13px" }}>
              ~3 minutes · Voice narration included
            </div>
          </div>
        )}

        {/* End screen */}
        {ended && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 48px",
            }}
          >
            <div style={{ fontSize: "48px", fontWeight: 900, color: "#fff", marginBottom: "16px" }}>
              Ready to evaluate your first deal?
            </div>
            <div style={{ fontSize: "20px", color: "#fbbf24", marginBottom: "32px" }}>
              50 free runs · No credit card · Instant access
            </div>
            <div style={{ display: "flex", gap: "16px" }}>
              <a
                href="/ask"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "#000",
                  borderRadius: "10px",
                  padding: "14px 32px",
                  fontSize: "16px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Start Free →
              </a>
              <button
                onClick={handleRestart}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "10px",
                  padding: "14px 32px",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ↺ Replay
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Scene title overlay (bottom-left) ── */}
      {scene && (
        <div
          style={{
            position: "absolute",
            bottom: "100px",
            left: "40px",
            zIndex: 30,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "#fbbf24",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "6px",
              fontFamily: "monospace",
            }}
          >
            Scene {currentScene + 1} of {SCENES.length}
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: "6px" }}>
            {scene.title}
          </div>
          <div style={{ fontSize: "16px", color: "#94a3b8" }}>{scene.subtitle}</div>
        </div>
      )}

      {/* ── Controls bar ── */}
      {currentScene >= 0 && !ended && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            padding: "16px 24px",
            background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
          }}
        >
          {/* Progress bar */}
          <div
            style={{
              height: "3px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "2px",
              marginBottom: "12px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "linear-gradient(to right, #f59e0b, #10b981)",
                borderRadius: "2px",
                transition: "width 0.3s linear",
              }}
            />
          </div>

          {/* Buttons row */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Play/Pause */}
            <button
              onClick={handlePause}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                color: "#fff",
                width: "40px",
                height: "40px",
                fontSize: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            {/* Mute */}
            <button
              onClick={handleMute}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                color: isMuted ? "#ef4444" : "#fff",
                width: "40px",
                height: "40px",
                fontSize: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>

            {/* Restart */}
            <button
              onClick={handleRestart}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                color: "#fff",
                width: "40px",
                height: "40px",
                fontSize: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ↺
            </button>

            {/* Scene dots */}
            <div style={{ display: "flex", gap: "6px", marginLeft: "8px" }}>
              {SCENES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => handleSceneJump(i)}
                  title={s.title}
                  style={{
                    width: i === currentScene ? "24px" : "8px",
                    height: "8px",
                    borderRadius: "4px",
                    border: "none",
                    background: i === currentScene ? "#fbbf24" : i < currentScene ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.2)",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    padding: 0,
                  }}
                />
              ))}
            </div>

            {/* Scene name right-aligned */}
            <div style={{ marginLeft: "auto", color: "#64748b", fontSize: "12px", fontFamily: "monospace" }}>
              {scene?.title}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
