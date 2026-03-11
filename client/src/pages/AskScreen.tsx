import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";

const NAVY_950 = "#0B1629";
const NAVY_900 = "#0F1E38";
const NAVY_800 = "#152340";
const CYAN = "#00D4FF";
const BLUE = "#0080FF";
const SKY = "#40B8FF";
const INDIGO = "#4060FF";
const WHITE = "#F0F4FA";
const MUTED = "#8BA3C4";

const EXAMPLE_PROMPTS = [
  { icon: "🔬", text: "Simulate 500 GCC consumers' reaction to a new fintech product at AED 99/month" },
  { icon: "📊", text: "Screen this Series A deal: SaaS, $2M ARR, 180% NRR, Dubai-based, seeking $8M" },
  { icon: "🏥", text: "Analyse pricing sensitivity for a telehealth subscription across UAE, KSA, and Qatar" },
  { icon: "⚖️", text: "What are the regulatory risks of launching a crypto lending product in the GCC?" },
  { icon: "📈", text: "Identify the top 3 underserved customer segments for Islamic wealth management in 2025" },
  { icon: "🤖", text: "Competitive intelligence: who are the top 5 AI agent platforms targeting MENA enterprises?" },
];

const AGENT_STEPS = [
  { color: CYAN, name: "Intent Classifier", desc: "Understands your query and selects the right agent mix" },
  { color: BLUE, name: "Research Analyst", desc: "Gathers relevant data and key findings" },
  { color: SKY, name: "Risk Analyst", desc: "Identifies risks and sentiment signals" },
  { color: INDIGO, name: "Segment Analyst", desc: "Maps insights to customer segments" },
  { color: "#A040FF", name: "Report Writer", desc: "Synthesises everything into an executive brief" },
];

export default function AskScreen() {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const search = useSearch();
  const { isAuthenticated } = useAuth();

  // File attachment state
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill from ?refine= param (coming from Result screen's "New Analysis" button)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const refine = params.get("refine");
    if (refine) {
      setQuery(decodeURIComponent(refine));
    }
  }, [search]);

  const uploadFile = trpc.mesh.uploadAttachment.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      alert("File too large. Maximum size is 16MB.");
      return;
    }
    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);
      const result = await uploadFile.mutateAsync({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64Data: base64,
      });
      setAttachedFile({ name: file.name, url: result.url, size: file.size });
    } catch (err) {
      console.error("Upload failed", err);
      alert("File upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const analyze = trpc.mesh.analyze.useMutation({
    onSuccess: (data) => {
      navigate(`/result/${data.taskId}`);
    },
  });

  const handleSubmit = () => {
    if (!query.trim()) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    analyze.mutate({
      query: query.trim(),
      fileUrl: attachedFile?.url ?? null,
      fileName: attachedFile?.name ?? null,
    });
  };

  const handleExample = (text: string) => {
    setQuery(text);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${NAVY_950} 0%, ${NAVY_900} 50%, ${NAVY_800} 100%)`,
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      overflowX: "hidden",
    }}>
      {/* Ambient background glows */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "15%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${CYAN}12 0%, transparent 70%)`, filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "10%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${INDIGO}12 0%, transparent 70%)`, filter: "blur(60px)" }} />
      </div>

      {/* Navbar */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: `1px solid ${CYAN}20`,
        background: `${NAVY_950}CC`,
        backdropFilter: "blur(12px)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <Logo />
        </a>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/portfolio" style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            Portfolio
          </a>
          <a href="/turnaround" style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            Turnaround
          </a>
          <a href="/history" style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            History
          </a>
          <a href="/mesh" style={{ color: MUTED, fontSize: 14, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = WHITE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            Advanced
          </a>
          {isAuthenticated ? (
            <a href="/mesh" style={{
              color: WHITE, fontSize: 14, textDecoration: "none",
              padding: "7px 18px", borderRadius: 8,
              background: `linear-gradient(135deg, ${CYAN}30, ${BLUE}30)`,
              border: `1px solid ${CYAN}50`,
            }}>Dashboard</a>
          ) : (
            <a href={getLoginUrl()} style={{
              color: WHITE, fontSize: 14, textDecoration: "none",
              padding: "7px 18px", borderRadius: 8,
              background: `linear-gradient(135deg, ${CYAN}30, ${BLUE}30)`,
              border: `1px solid ${CYAN}50`,
            }}>Sign in</a>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main style={{
        position: "relative", zIndex: 1,
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
        maxWidth: 760, margin: "0 auto", width: "100%",
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 16px", borderRadius: 100,
          background: `${CYAN}12`, border: `1px solid ${CYAN}30`,
          marginBottom: 28,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: CYAN, boxShadow: `0 0 8px ${CYAN}`, display: "inline-block" }} />
          <span style={{ color: CYAN, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
            112 specialist agents · Mesh Online
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(32px, 6vw, 52px)",
          fontWeight: 800,
          color: WHITE,
          textAlign: "center",
          lineHeight: 1.15,
          marginBottom: 14,
          fontFamily: "'Playfair Display', serif",
        }}>
          Describe any business task.
          <br />
          <span style={{ background: `linear-gradient(90deg, ${CYAN}, ${BLUE}, ${SKY})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            The Mesh handles the rest.
          </span>
        </h1>

        <p style={{ color: MUTED, fontSize: 16, textAlign: "center", marginBottom: 36, lineHeight: 1.6, maxWidth: 560 }}>
          AgenThinkMesh activates the right specialist agents across Finance, Legal, Healthcare, and GCC Wealth — delivering institutional-grade results in seconds.
        </p>

        {/* Input area */}
        <div style={{
          width: "100%",
          background: `${NAVY_800}CC`,
          border: `1px solid ${CYAN}30`,
          borderRadius: 16,
          padding: 20,
          backdropFilter: "blur(12px)",
          boxShadow: `0 0 40px ${CYAN}10`,
          marginBottom: 24,
        }}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
            placeholder="Describe your task — e.g. Screen a Series A deal, Simulate consumer reactions, Analyse pricing sensitivity..."
            style={{
              width: "100%",
              minHeight: 120,
              background: "transparent",
              border: "none",
              outline: "none",
              color: WHITE,
              fontSize: 16,
              lineHeight: 1.6,
              resize: "none",
              fontFamily: "'Inter', sans-serif",
              boxSizing: "border-box",
            }}
            disabled={analyze.isPending}
          />

          {/* Attached file chip */}
          {attachedFile && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 12px",
              background: `${CYAN}15`, border: `1px solid ${CYAN}40`,
              borderRadius: 8, marginBottom: 10,
              maxWidth: "100%",
            }}>
              <span style={{ fontSize: 14 }}>📎</span>
              <span style={{ color: CYAN, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                {attachedFile.name}
              </span>
              <span style={{ color: MUTED, fontSize: 11 }}>
                ({(attachedFile.size / 1024).toFixed(0)} KB)
              </span>
              <button
                onClick={() => setAttachedFile(null)}
                style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                title="Remove attachment"
              >✕</button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={analyze.isPending || uploading}
                title="Attach a document (PDF, DOCX, XLSX, PPTX)"
                style={{
                  background: "none", border: `1px solid ${CYAN}30`,
                  borderRadius: 8, padding: "6px 10px",
                  cursor: analyze.isPending || uploading ? "not-allowed" : "pointer",
                  color: uploading ? CYAN : MUTED,
                  fontSize: 16, lineHeight: 1,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 6,
                }}
                onMouseEnter={e => { if (!analyze.isPending && !uploading) e.currentTarget.style.borderColor = `${CYAN}80`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${CYAN}30`; }}
              >
                {uploading ? (
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${MUTED}`, borderTopColor: CYAN, display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <span>📎</span>
                )}
                <span style={{ fontSize: 12 }}>{uploading ? "Uploading…" : "Attach"}</span>
              </button>
              <span style={{ color: MUTED, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {analyze.isPending ? "Activating mesh…" : "⌘ + Enter to analyse"}
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={analyze.isPending || !query.trim()}
              style={{
                padding: "10px 28px",
                borderRadius: 10,
                border: "none",
                cursor: analyze.isPending || !query.trim() ? "not-allowed" : "pointer",
                background: analyze.isPending || !query.trim()
                  ? `${NAVY_800}`
                  : `linear-gradient(135deg, ${CYAN}, ${BLUE})`,
                color: analyze.isPending || !query.trim() ? MUTED : NAVY_950,
                fontWeight: 700,
                fontSize: 15,
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {analyze.isPending ? (
                <>
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: `2px solid ${MUTED}`, borderTopColor: CYAN,
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Analysing…
                </>
              ) : (
                <>⚡ Analyse via Mesh</>
              )}
            </button>
          </div>
        </div>

        {/* Agent pipeline visual */}
        {analyze.isPending && (
          <div style={{
            width: "100%",
            background: `${NAVY_800}80`,
            border: `1px solid ${CYAN}20`,
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 24,
          }}>
            <div style={{ color: MUTED, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12, letterSpacing: "0.08em" }}>
              MESH ROUTING
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {AGENT_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: step.color,
                    boxShadow: `0 0 8px ${step.color}`,
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.3}s`,
                    flexShrink: 0,
                  }} />
                  <span style={{ color: step.color, fontSize: 13, fontWeight: 600, minWidth: 160 }}>{step.name}</span>
                  <span style={{ color: MUTED, fontSize: 12 }}>{step.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {analyze.isError && (
          <div style={{
            width: "100%",
            background: "#FF404010",
            border: "1px solid #FF404040",
            borderRadius: 10,
            padding: "12px 16px",
            color: "#FF8080",
            fontSize: 14,
            marginBottom: 16,
          }}>
            ⚠ {typeof analyze.error?.message === "string" ? analyze.error.message : analyze.error ? JSON.stringify(analyze.error) : "Something went wrong. Please try again."}
          </div>
        )}

        {/* Example prompts */}
        {!analyze.isPending && (
          <>
            <div style={{ color: MUTED, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", marginBottom: 14 }}>
              TRY AN EXAMPLE
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 10,
              width: "100%",
            }}>
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => handleExample(ex.text)}
                  style={{
                    background: `${NAVY_800}80`,
                    border: `1px solid ${CYAN}20`,
                    borderRadius: 10,
                    padding: "12px 16px",
                    color: MUTED,
                    fontSize: 13,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    lineHeight: 1.5,
                    display: "flex", gap: 10, alignItems: "flex-start",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${CYAN}50`;
                    e.currentTarget.style.color = WHITE;
                    e.currentTarget.style.background = `${NAVY_800}`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `${CYAN}20`;
                    e.currentTarget.style.color = MUTED;
                    e.currentTarget.style.background = `${NAVY_800}80`;
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{ex.icon}</span>
                  <span>{ex.text}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
