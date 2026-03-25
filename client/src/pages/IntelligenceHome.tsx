/**
 * IntelligenceHome — Core analysis page for AgenThinkMesh Intelligence Agent
 * Matches the existing navy/silver/mono design system
 */
import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import SiteNav from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Brand tokens (match existing site) ────────────────────────────────────────
const NAVY_950 = "#080D1A";
const NAVY_900 = "#0B1629";
const NAVY_800 = "#0F1E38";
const NAVY_700 = "#162847";
const SILVER_50 = "#F0F4FA";
const SILVER_100 = "#E2E8F0";
const SILVER_300 = "#94A3B8";
const SILVER_400 = "#64748B";
const SILVER_500 = "#475569";
const BLUE = "#7BA3D4";
const CYAN = "#38BDF8";
const GOLD = "#F59E0B";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', sans-serif";

// ── Example institutions ───────────────────────────────────────────────────────
const EXAMPLES = [
  {
    institution: "NBIM",
    domain: "Sovereign Wealth Fund",
    aum: "$1.6T",
    text: `NBIM has deployed an internal LLM-based document analysis tool built on Azure OpenAI. The tool processes ESG reports from portfolio companies at scale. They are exploring agentic workflows for equity research but have not committed to a vendor. The CTO mentioned at Oslo FinTech Forum that they prefer building internal capabilities over buying off-the-shelf solutions. Their data science team has grown from 12 to 47 in 18 months. Recent LinkedIn posts from NBIM engineers mention fine-tuning experiments on Norwegian financial text.`,
  },
  {
    institution: "Mubadala Investment Company",
    domain: "Sovereign Wealth Fund",
    aum: "$300B",
    text: `Mubadala has announced a strategic partnership with Microsoft to deploy Azure AI services across their portfolio companies. The fund's technology arm, Mubadala Capital, is evaluating AI-driven deal sourcing tools. At the Abu Dhabi Finance Week, their CIO stated that AI is central to their 2030 strategy. They have invested in G42, the UAE's leading AI company, and are exploring co-development of Arabic LLMs. Their recent job postings include ML Engineers and AI Product Managers with Arabic NLP experience.`,
  },
  {
    institution: "ADQ",
    domain: "Sovereign Wealth Fund",
    aum: "$157B",
    text: `ADQ has partnered with IBM to implement AI-driven supply chain optimisation across their food and agriculture portfolio. Their healthcare vertical is piloting AI diagnostics tools in partnership with Cleveland Clinic Abu Dhabi. ADQ's digital infrastructure arm is building a sovereign data centre with AI inference capabilities. The fund recently hired a Chief AI Officer from Google DeepMind. They are actively seeking AI vendors with proven GCC deployment experience and Arabic language capabilities.`,
  },
];

// ── Module & lens config ──────────────────────────────────────────────────────
const MODULES = [
  { id: "use_cases", label: "Use Cases", icon: "🎯" },
  { id: "tech_stack", label: "Tech Stack", icon: "⚙️" },
  { id: "build_buy", label: "Build/Buy", icon: "🏗️" },
  { id: "gtm_signals", label: "GTM Signals", icon: "📡" },
  { id: "coverage_gaps", label: "Coverage Gaps", icon: "🔍" },
  { id: "next_moves", label: "Next Moves", icon: "🚀" },
];

const LENSES = [
  { id: "gcc", label: "GCC Lens", icon: "🌍" },
  { id: "shariah", label: "Shariah Compliance", icon: "☪️" },
  { id: "sovereign", label: "Sovereign AI", icon: "🏛️" },
  { id: "arabic_nlp", label: "Arabic NLP", icon: "ع" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function TagBadge({ label, color = BLUE }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: MONO, fontWeight: 600, letterSpacing: "0.08em",
      color, background: `${color}18`, border: `1px solid ${color}35`,
      borderRadius: 4, padding: "2px 8px", display: "inline-block",
    }}>{label}</span>
  );
}

function MaturityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Production: "#4ADE80", Pilot: "#F59E0B", Exploring: "#38BDF8", Unknown: "#64748B",
  };
  const c = colors[level] ?? "#64748B";
  return <TagBadge label={level} color={c} />;
}

function PriorityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = { High: "#F87171", Medium: "#F59E0B", Low: "#4ADE80" };
  return <TagBadge label={level} color={colors[level] ?? "#64748B"} />;
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, string> = { High: "#4ADE80", Medium: "#F59E0B", Low: "#F87171" };
  return <TagBadge label={level} color={colors[level] ?? "#64748B"} />;
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: NAVY_800, border: `1px solid rgba(123,163,212,0.18)`,
      borderRadius: 12, padding: "20px 24px", marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, color: BLUE, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: MONO, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function ResultPanel({ result, onTrack }: { result: Record<string, unknown>; onTrack: () => void }) {
  const r = result as {
    institution?: string; domain?: string; aum?: string; executive_summary?: string;
    use_cases?: Array<{ title: string; description: string; maturity: string }>;
    tech_stack?: Array<{ vendor: string; category: string; evidence: string }>;
    build_buy_stance?: { stance: string; confidence: string; rationale: string };
    gtm_signals?: Array<{ signal: string; implication: string }>;
    coverage_gaps?: string[];
    recommended_next_moves?: Array<{ action: string; priority: string; rationale: string }>;
    gcc_lens?: { regulatory_alignment: string; sovereign_ai_stance: string; localisation_score: number };
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: SILVER_50, margin: 0, letterSpacing: "-0.02em" }}>{r.institution}</h2>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {r.domain && <TagBadge label={r.domain} color={BLUE} />}
            {r.aum && <TagBadge label={`AUM: ${r.aum}`} color={GOLD} />}
          </div>
        </div>
        <button
          onClick={onTrack}
          style={{
            padding: "8px 18px", background: `rgba(123,163,212,0.12)`, border: `1px solid ${BLUE}40`,
            borderRadius: 8, color: BLUE, fontSize: 12, fontWeight: 700, cursor: "pointer",
            fontFamily: MONO, letterSpacing: "0.06em", transition: "all 0.2s", flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(123,163,212,0.22)`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(123,163,212,0.12)`; }}
        >
          + Track Institution
        </button>
      </div>

      {/* Executive Summary */}
      {r.executive_summary && (
        <SectionCard title="Executive Summary" icon="📋">
          <p style={{ fontSize: 14, color: SILVER_100, lineHeight: 1.75, margin: 0 }}>{r.executive_summary}</p>
        </SectionCard>
      )}

      {/* Use Cases */}
      {r.use_cases && r.use_cases.length > 0 && (
        <SectionCard title="AI Use Cases" icon="🎯">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {r.use_cases.map((uc, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: BLUE, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: SILVER_50 }}>{uc.title}</span>
                    <MaturityBadge level={uc.maturity} />
                  </div>
                  <p style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.65, margin: 0 }}>{uc.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Tech Stack */}
      {r.tech_stack && r.tech_stack.length > 0 && (
        <SectionCard title="Technology Stack" icon="⚙️">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {r.tech_stack.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: `rgba(123,163,212,0.06)`, borderRadius: 8, border: `1px solid rgba(123,163,212,0.12)` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: CYAN }}>{t.vendor}</span>
                    <TagBadge label={t.category} color={SILVER_400} />
                  </div>
                  <p style={{ fontSize: 12, color: SILVER_400, margin: 0, fontStyle: "italic" }}>{t.evidence}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Build/Buy */}
      {r.build_buy_stance && (
        <SectionCard title="Build / Buy Stance" icon="🏗️">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: SILVER_50 }}>{r.build_buy_stance.stance}</span>
            <ConfidenceBadge level={r.build_buy_stance.confidence} />
          </div>
          <p style={{ fontSize: 13, color: SILVER_300, lineHeight: 1.65, margin: 0 }}>{r.build_buy_stance.rationale}</p>
        </SectionCard>
      )}

      {/* GTM Signals */}
      {r.gtm_signals && r.gtm_signals.length > 0 && (
        <SectionCard title="GTM Signals" icon="📡">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {r.gtm_signals.map((s, i) => (
              <div key={i} style={{ borderLeft: `3px solid ${CYAN}`, paddingLeft: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: SILVER_50, marginBottom: 4 }}>{s.signal}</div>
                <div style={{ fontSize: 12, color: SILVER_300 }}>{s.implication}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Coverage Gaps */}
      {r.coverage_gaps && r.coverage_gaps.length > 0 && (
        <SectionCard title="Coverage Gaps" icon="🔍">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {r.coverage_gaps.map((g, i) => (
              <span key={i} style={{ fontSize: 12, color: "#F87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "4px 10px" }}>{g}</span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Recommended Next Moves */}
      {r.recommended_next_moves && r.recommended_next_moves.length > 0 && (
        <SectionCard title="Recommended Next Moves" icon="🚀">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {r.recommended_next_moves.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `rgba(123,163,212,0.15)`, border: `1px solid ${BLUE}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: BLUE, fontFamily: MONO, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: SILVER_50 }}>{m.action}</span>
                    <PriorityBadge level={m.priority} />
                  </div>
                  <p style={{ fontSize: 12, color: SILVER_300, margin: 0 }}>{m.rationale}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* GCC Lens */}
      {r.gcc_lens && (
        <SectionCard title="GCC Lens" icon="🌍">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ padding: "12px 14px", background: `rgba(123,163,212,0.06)`, borderRadius: 8, border: `1px solid rgba(123,163,212,0.12)` }}>
              <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Regulatory Alignment</div>
              <div style={{ fontSize: 13, color: SILVER_100 }}>{r.gcc_lens.regulatory_alignment}</div>
            </div>
            <div style={{ padding: "12px 14px", background: `rgba(123,163,212,0.06)`, borderRadius: 8, border: `1px solid rgba(123,163,212,0.12)` }}>
              <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Sovereign AI Stance</div>
              <div style={{ fontSize: 13, color: SILVER_100 }}>{r.gcc_lens.sovereign_ai_stance}</div>
            </div>
            <div style={{ padding: "12px 14px", background: `rgba(123,163,212,0.06)`, borderRadius: 8, border: `1px solid rgba(123,163,212,0.12)` }}>
              <div style={{ fontSize: 10, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Localisation Score</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: NAVY_700, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(r.gcc_lens.localisation_score / 10) * 100}%`, background: `linear-gradient(90deg, ${BLUE}, ${CYAN})`, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: SILVER_50, fontFamily: MONO }}>{r.gcc_lens.localisation_score}/10</span>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IntelligenceHome() {
  const { isAuthenticated, loading } = useAuth();
  const loginUrl = getLoginUrl("/intelligence");

  const [institution, setInstitution] = useState("");
  const [domain, setDomain] = useState("");
  const [aum, setAum] = useState("");
  const [text, setText] = useState("");
  const [modules, setModules] = useState<string[]>(MODULES.map(m => m.id));
  const [lens, setLens] = useState<string[]>(["gcc"]);
  const [isInternal, setIsInternal] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [lastAnalysisId, setLastAnalysisId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyseMutation = trpc.intelligence.analyse.useMutation({
    onSuccess: (data) => {
      setResult(data.result as Record<string, unknown>);
      setLastAnalysisId(data.id ?? null);
      toast.success("Analysis complete");
    },
    onError: (err) => toast.error(err.message),
  });

  const trackMutation = trpc.intelligence.trackInstitution.useMutation({
    onSuccess: (data) => {
      if (data.alreadyTracked) toast.info("Already tracking this institution");
      else toast.success(`Now tracking ${institution}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleExample = (ex: typeof EXAMPLES[0]) => {
    setInstitution(ex.institution);
    setDomain(ex.domain);
    setAum(ex.aum);
    setText(ex.text);
    setResult(null);
  };

  const handleAnalyse = () => {
    if (!institution.trim()) { toast.error("Enter an institution name"); return; }
    if (!text.trim()) { toast.error("Paste some text to analyse"); return; }
    analyseMutation.mutate({ institution: institution.trim(), domain, aum, text, modules, lens, isInternal });
  };

  const handleTrack = () => {
    if (!institution.trim()) return;
    trackMutation.mutate({ institution: institution.trim(), domain, aum, initialAnalysisId: lastAnalysisId ?? undefined });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/parse-document", { method: "POST", body: formData });
      const data = await res.json() as { text?: string; error?: string };
      if (data.text) {
        setText(data.text.slice(0, 12000));
        setIsInternal(true);
        toast.success(`Extracted ${data.text.length.toLocaleString()} characters from ${file.name}`);
      } else {
        toast.error(data.error ?? "Failed to parse document");
      }
    } catch {
      toast.error("Failed to upload document");
    }
  };

  const toggleModule = (id: string) => {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const toggleLens = (id: string) => {
    setLens(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY_950, color: SILVER_50, fontFamily: FONT }}>
      <SiteNav />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, color: BLUE, textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: MONO, fontWeight: 600, marginBottom: 10 }}>
            Intelligence Agent
          </div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-0.03em", color: SILVER_50, margin: "0 0 12px", lineHeight: 1.1 }}>
            AI Programme Intelligence
          </h1>
          <p style={{ fontSize: 15, color: SILVER_300, maxWidth: 600, lineHeight: 1.7, margin: 0 }}>
            Extract structured intelligence from any text about an institution's AI programme. Identify use cases, tech stack, build/buy stance, GTM signals, and coverage gaps — with a GCC sovereign wealth fund lens.
          </p>
        </div>

        {/* Auth gate */}
        {!loading && !isAuthenticated && (
          <div style={{ background: NAVY_800, border: `1px solid rgba(123,163,212,0.2)`, borderRadius: 12, padding: "28px 32px", marginBottom: 32, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: SILVER_300, marginBottom: 16 }}>Sign in to run analyses and save your history</div>
            <a href={loginUrl} style={{ display: "inline-block", padding: "10px 28px", background: `linear-gradient(135deg, ${BLUE} 0%, #4A90D4 100%)`, color: NAVY_950, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              Sign In to Continue
            </a>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: 32, alignItems: "start" }}>
          {/* Input Panel */}
          <div>
            {/* Example cards */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Quick Examples</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.institution}
                    onClick={() => handleExample(ex)}
                    style={{
                      padding: "6px 14px", background: `rgba(123,163,212,0.08)`, border: `1px solid rgba(123,163,212,0.2)`,
                      borderRadius: 6, color: BLUE, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      fontFamily: MONO, transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(123,163,212,0.18)`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(123,163,212,0.08)`; }}
                  >
                    {ex.institution}
                  </button>
                ))}
              </div>
            </div>

            {/* Institution fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Institution *</label>
                <input
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  placeholder="e.g. Mubadala"
                  style={{ width: "100%", background: NAVY_800, border: `1px solid rgba(123,163,212,0.2)`, borderRadius: 8, padding: "10px 14px", color: SILVER_50, fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>Domain</label>
                <input
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  placeholder="e.g. Sovereign Wealth Fund"
                  style={{ width: "100%", background: NAVY_800, border: `1px solid rgba(123,163,212,0.2)`, borderRadius: 8, padding: "10px 14px", color: SILVER_50, fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>AUM (optional)</label>
              <input
                value={aum}
                onChange={e => setAum(e.target.value)}
                placeholder="e.g. $300B"
                style={{ width: "100%", background: NAVY_800, border: `1px solid rgba(123,163,212,0.2)`, borderRadius: 8, padding: "10px 14px", color: SILVER_50, fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Text input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Source Text *
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "4px 12px", background: "transparent", border: `1px solid rgba(123,163,212,0.25)`,
                      borderRadius: 6, color: BLUE, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      fontFamily: MONO, letterSpacing: "0.06em",
                    }}
                  >
                    📄 Upload Doc
                  </button>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
                  {isInternal && <TagBadge label="INTERNAL DOC" color="#F59E0B" />}
                </div>
              </div>
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setIsInternal(false); }}
                placeholder="Paste LinkedIn posts, articles, conference notes, press releases, or upload a PDF/DOCX document..."
                rows={10}
                style={{
                  width: "100%", background: NAVY_800, border: `1px solid rgba(123,163,212,0.2)`,
                  borderRadius: 8, padding: "12px 14px", color: SILVER_50, fontSize: 14,
                  fontFamily: FONT, outline: "none", resize: "vertical", lineHeight: 1.65,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 11, color: SILVER_500, fontFamily: MONO, marginTop: 4 }}>
                {text.length.toLocaleString()} chars
              </div>
            </div>

            {/* Modules */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Analysis Modules</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {MODULES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => toggleModule(m.id)}
                    style={{
                      padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      fontFamily: MONO, transition: "all 0.15s", letterSpacing: "0.04em",
                      background: modules.includes(m.id) ? `rgba(123,163,212,0.18)` : "transparent",
                      border: modules.includes(m.id) ? `1px solid ${BLUE}50` : `1px solid rgba(123,163,212,0.15)`,
                      color: modules.includes(m.id) ? BLUE : SILVER_400,
                    }}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lenses */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: SILVER_400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>GCC Lens Filters</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LENSES.map(l => (
                  <button
                    key={l.id}
                    onClick={() => toggleLens(l.id)}
                    style={{
                      padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      fontFamily: MONO, transition: "all 0.15s", letterSpacing: "0.04em",
                      background: lens.includes(l.id) ? `rgba(56,189,248,0.15)` : "transparent",
                      border: lens.includes(l.id) ? `1px solid ${CYAN}45` : `1px solid rgba(56,189,248,0.15)`,
                      color: lens.includes(l.id) ? CYAN : SILVER_400,
                    }}
                  >
                    {l.icon} {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Analyse button */}
            <button
              onClick={handleAnalyse}
              disabled={analyseMutation.isPending || !isAuthenticated}
              style={{
                width: "100%", padding: "14px 24px",
                background: analyseMutation.isPending ? NAVY_700 : `linear-gradient(135deg, ${BLUE} 0%, #4A90D4 100%)`,
                border: "none", borderRadius: 10, color: analyseMutation.isPending ? SILVER_400 : NAVY_950,
                fontSize: 14, fontWeight: 800, cursor: analyseMutation.isPending ? "not-allowed" : "pointer",
                letterSpacing: "0.04em", fontFamily: FONT, transition: "all 0.2s",
                boxShadow: analyseMutation.isPending ? "none" : "0 4px 20px rgba(123,163,212,0.35)",
              }}
            >
              {analyseMutation.isPending ? "⚡ Analysing…" : "⚡ Run Intelligence Analysis"}
            </button>

            {/* Nav links */}
            <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "center" }}>
              {[
                { href: "/intelligence/tracking", label: "Track Institutions →" },
                { href: "/intelligence/briefs", label: "Weekly Briefs →" },
                { href: "/intelligence/history", label: "History →" },
              ].map(link => (
                <a key={link.href} href={link.href} style={{ fontSize: 12, color: SILVER_400, textDecoration: "none", fontFamily: MONO, transition: "color 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = BLUE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = SILVER_400; }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Result Panel */}
          {result && (
            <div>
              <ResultPanel result={result} onTrack={handleTrack} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
