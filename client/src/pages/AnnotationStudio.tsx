import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Logo from "@/components/Logo";
import { Link } from "wouter";

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const FONT = "'Inter', system-ui, sans-serif";

// Arabic annotation agent capability tags used to filter the registry
const ARABIC_AGENT_TAGS = ["arabic", "nlp", "annotation", "sentiment", "ner", "intent", "legal clause", "code-switch", "gulf", "labeling"];

type AnnotationResult = {
  id: number;
  label: string;
  confidence: number;
  dialect: string | null;
  rationale: string | null;
  requiresReview: boolean;
  structuredResult: unknown;
  latencyMs: number;
  agentName: string;
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "#22C55E" : pct >= 65 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 12, color, fontFamily: MONO, fontWeight: 700, minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

function StructuredResultView({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data as Record<string, unknown>);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
      {entries.slice(0, 12).map(([key, val]) => {
        if (key === "rationale") return null;
        const display = Array.isArray(val)
          ? val.slice(0, 3).join(", ") + (val.length > 3 ? `… +${val.length - 3}` : "")
          : typeof val === "object" && val !== null
          ? JSON.stringify(val).slice(0, 60)
          : String(val ?? "");
        return (
          <div key={key} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: "#64748B", fontFamily: MONO, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{key.replace(/_/g, " ")}</div>
            <div style={{ fontSize: 11, color: "#E2E8F0", fontFamily: MONO, wordBreak: "break-word", lineHeight: 1.5 }}>{display || "—"}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnnotationStudio() {
  const { user, loading: authLoading } = useAuth();
  const loginUrl = getLoginUrl();

  const [inputText, setInputText] = useState("");
  const [context, setContext] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"annotate" | "history" | "export">("annotate");
  const [lastResult, setLastResult] = useState<AnnotationResult | null>(null);
  const [exportFormat, setExportFormat] = useState<"jsonl" | "csv">("jsonl");
  const [exportStatusFilter, setExportStatusFilter] = useState<"approved" | "all">("approved");
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Fetch Arabic annotation agents from registry
  const { data: allAgents } = trpc.agent.list.useQuery({ limit: 100 });
  const arabicAgents = useMemo(() => {
    if (!allAgents) return [];
    return allAgents.filter(a => {
      const caps: string[] = (() => { try { return JSON.parse(a.capabilities); } catch { return []; } })();
      return caps.some(c => ARABIC_AGENT_TAGS.some(tag => c.toLowerCase().includes(tag)));
    });
  }, [allAgents]);

  // Annotation history
  const { data: history, refetch: refetchHistory } = trpc.annotation.list.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );

  // Export history
  const { data: exportHistory } = trpc.annotation.listExports.useQuery(undefined, { enabled: !!user });

  // Mutations
  const submitMutation = trpc.annotation.submit.useMutation({
    onSuccess: (data) => {
      setLastResult(data as AnnotationResult);
      void refetchHistory();
    },
  });

  const reviewMutation = trpc.annotation.review.useMutation({
    onSuccess: () => void refetchHistory(),
  });

  const exportMutation = trpc.annotation.export.useMutation({
    onSuccess: (data) => {
      setExportUrl(data.url);
    },
  });

  const pendingCount = history?.filter(a => a.reviewStatus === "pending").length ?? 0;

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0C1220", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748B", fontFamily: MONO, fontSize: 13 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0C1220", fontFamily: FONT, color: "#F8FAFC" }}>

      {/* Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", height: 56,
        background: "rgba(12,18,32,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/" style={{ textDecoration: "none" }}><Logo size={26} /></Link>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, color: "#F59E0B" }}>ع</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F8FAFC" }}>Arabic Annotation Studio</span>
            <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(180,83,9,0.2)", border: "1px solid rgba(180,83,9,0.4)", borderRadius: 999, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em" }}>Beta</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {user ? (
            <>
              <span style={{ fontSize: 12, color: "#64748B", fontFamily: MONO }}>{user.name}</span>
              <Link href="/dashboard" style={{ fontSize: 12, color: "#4F46E5", textDecoration: "none", fontWeight: 600 }}>Dashboard</Link>
            </>
          ) : (
            <a href={loginUrl} style={{ padding: "7px 18px", background: "#B45309", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Sign in to annotate</a>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "rgba(180,83,9,0.15)", border: "1px solid rgba(180,83,9,0.3)", borderRadius: 999, marginBottom: 16 }}>
            <span style={{ fontSize: 9, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>GCC AI Infrastructure</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", color: "#F8FAFC", marginBottom: 10, lineHeight: 1.15 }}>
            Arabic Data Annotation Studio
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, maxWidth: 600 }}>
            Submit Arabic text to specialist annotation agents. Get structured labels — sentiment, entities, intent, clauses, code-switching — with confidence scores and dialect detection. Export as JSONL for LLM fine-tuning.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 0 }}>
          {([
            ["annotate", "Annotate"],
            ["history", `History${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}`],
            ["export", "Export Dataset"],
          ] as [typeof activeTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "transparent", border: "none", borderBottom: activeTab === tab ? "2px solid #F59E0B" : "2px solid transparent",
                color: activeTab === tab ? "#F59E0B" : "#64748B",
                marginBottom: -1, transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Annotate Tab ── */}
        {activeTab === "annotate" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

            {/* Left: Input panel */}
            <div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "24px" }}>
                <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, fontWeight: 600 }}>Arabic Text Input</div>

                {/* RTL text area */}
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="أدخل النص العربي هنا للتصنيف والتوسيم..."
                  dir="rtl"
                  rows={6}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: "14px 16px",
                    color: "#E2E8F0", fontSize: 15, lineHeight: 1.8,
                    fontFamily: "'Noto Sans Arabic', 'Arial', sans-serif",
                    resize: "vertical", outline: "none",
                    textAlign: "right",
                  }}
                />

                {/* Context field */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontFamily: MONO, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Domain context (optional)</div>
                  <input
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    placeholder="e.g. Gulf banking customer feedback, UAE legal contract, Saudi social media"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8, padding: "10px 14px",
                      color: "#E2E8F0", fontSize: 12, outline: "none",
                      fontFamily: FONT,
                    }}
                  />
                </div>

                {/* Agent selector */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontFamily: MONO, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Annotation agent</div>
                  {arabicAgents.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#64748B", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, fontFamily: MONO }}>
                      No Arabic agents registered yet. <Link href="/registry" style={{ color: "#F59E0B", textDecoration: "none" }}>Register one →</Link>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {arabicAgents.map(agent => {
                        const caps: string[] = (() => { try { return JSON.parse(agent.capabilities); } catch { return []; } })();
                        return (
                          <button
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: 12,
                              padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                              background: selectedAgentId === agent.id ? "rgba(180,83,9,0.15)" : "rgba(0,0,0,0.2)",
                              border: selectedAgentId === agent.id ? "1px solid rgba(180,83,9,0.5)" : "1px solid rgba(255,255,255,0.06)",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: selectedAgentId === agent.id ? "#F59E0B" : "#374151", marginTop: 4, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#F8FAFC", marginBottom: 3 }}>{agent.agentName}</div>
                              <div style={{ fontSize: 10, color: "#64748B", lineHeight: 1.5 }}>{agent.description}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                {caps.slice(0, 4).map((c, i) => (
                                  <span key={i} style={{ fontSize: 9, padding: "2px 7px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 999, color: "#F59E0B", fontFamily: MONO }}>{c}</span>
                                ))}
                                {agent.connectionTested && (
                                  <span style={{ fontSize: 9, padding: "2px 7px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 999, color: "#22C55E", fontFamily: MONO }}>✓ verified</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Submit button */}
                {user ? (
                  <button
                    onClick={() => {
                      if (!selectedAgentId || !inputText.trim()) return;
                      submitMutation.mutate({ agentId: selectedAgentId, inputText: inputText.trim(), context: context || undefined });
                    }}
                    disabled={!selectedAgentId || !inputText.trim() || submitMutation.isPending}
                    style={{
                      marginTop: 20, width: "100%", padding: "13px",
                      background: (!selectedAgentId || !inputText.trim() || submitMutation.isPending) ? "rgba(180,83,9,0.3)" : "#B45309",
                      color: "#fff", border: "none", borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: (!selectedAgentId || !inputText.trim() || submitMutation.isPending) ? "not-allowed" : "pointer",
                      transition: "background 0.15s",
                    }}
                  >
                    {submitMutation.isPending ? "Annotating..." : "Annotate Text →"}
                  </button>
                ) : (
                  <a href={loginUrl} style={{
                    display: "block", marginTop: 20, width: "100%", padding: "13px",
                    background: "#B45309", color: "#fff", borderRadius: 10,
                    fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center",
                  }}>Sign in to annotate →</a>
                )}

                {submitMutation.isError && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, color: "#FCA5A5" }}>
                    {submitMutation.error.message}
                  </div>
                )}
              </div>

              {/* Sample texts */}
              <div style={{ marginTop: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontSize: 10, color: "#64748B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Sample Arabic texts</div>
                {[
                  { text: "والله الخدمة في هذا البنك وايد زينة، ما قصروا معي أبد. كل شي تمام", ctx: "Gulf banking feedback" },
                  { text: "وقّع معالي الشيخ محمد بن راشد آل مكتوم اتفاقية شراكة مع شركة أرامكو السعودية في دبي", ctx: "GCC business news" },
                  { text: "أبي أعرف إذا المرابحة العقارية حلال وكيف أقدر أتقدم لها", ctx: "Islamic bank chatbot" },
                  { text: "ال meeting كان productive وايد، وقررنا نطلق ال product في Q2", ctx: "Gulf corporate communication" },
                ].map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputText(sample.text); setContext(sample.ctx); }}
                    style={{
                      display: "block", width: "100%", textAlign: "right", direction: "rtl",
                      padding: "10px 12px", marginBottom: 8, borderRadius: 8, cursor: "pointer",
                      background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
                      color: "#94A3B8", fontSize: 12, lineHeight: 1.6,
                      fontFamily: "'Noto Sans Arabic', 'Arial', sans-serif",
                    }}
                  >
                    {sample.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Result panel */}
            <div>
              {lastResult ? (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Annotation Result</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {lastResult.requiresReview && (
                        <span style={{ fontSize: 9, padding: "3px 9px", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 999, color: "#F59E0B", fontFamily: MONO }}>REVIEW NEEDED</span>
                      )}
                      <span style={{ fontSize: 9, padding: "3px 9px", background: "rgba(255,255,255,0.06)", borderRadius: 999, color: "#64748B", fontFamily: MONO }}>{lastResult.latencyMs}ms</span>
                    </div>
                  </div>

                  {/* Agent name */}
                  <div style={{ fontSize: 11, color: "#64748B", fontFamily: MONO, marginBottom: 16 }}>via {lastResult.agentName}</div>

                  {/* Primary label */}
                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: "#64748B", fontFamily: MONO, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Primary Label</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#22C55E", fontFamily: MONO, letterSpacing: "-0.02em" }}>{lastResult.label}</div>
                    {lastResult.dialect && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#F59E0B", fontFamily: MONO }}>dialect: {lastResult.dialect}</div>
                    )}
                  </div>

                  {/* Confidence */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: "#64748B", fontFamily: MONO, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Confidence</div>
                    <ConfidenceBar value={lastResult.confidence} />
                  </div>

                  {/* Rationale */}
                  {lastResult.rationale && (
                    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                      <div style={{ fontSize: 9, color: "#64748B", fontFamily: MONO, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Rationale</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.7 }}>{lastResult.rationale}</div>
                    </div>
                  )}

                  {/* Structured result */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, color: "#64748B", fontFamily: MONO, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Structured Output</div>
                    <StructuredResultView data={lastResult.structuredResult} />
                  </div>

                  {/* Review actions */}
                  {user && (
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button
                        onClick={() => reviewMutation.mutate({ id: lastResult.id, status: "approved" })}
                        style={{ flex: 1, padding: "9px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, color: "#22C55E", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate({ id: lastResult.id, status: "rejected" })}
                        style={{ flex: 1, padding: "9px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 16, color: "#F59E0B" }}>ع</div>
                  <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
                    Select an agent, enter Arabic text,<br />and click Annotate to see structured output.
                  </div>
                  <div style={{ marginTop: 20, fontSize: 11, color: "#374151", fontFamily: MONO, lineHeight: 1.8 }}>
                    Outputs include: label · confidence · dialect<br />rationale · structured JSON · review status
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === "history" && (
          <div>
            {!user ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <a href={loginUrl} style={{ padding: "12px 28px", background: "#B45309", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Sign in to view history</a>
              </div>
            ) : !history || history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#64748B", fontSize: 13 }}>No annotations yet. Submit your first text above.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.map(ann => {
                  const statusColor = ann.reviewStatus === "approved" ? "#22C55E" : ann.reviewStatus === "rejected" ? "#EF4444" : "#F59E0B";
                  return (
                    <div key={ann.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "18px 20px", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <span style={{ fontSize: 10, padding: "2px 9px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 999, color: "#F59E0B", fontFamily: MONO }}>{ann.agentName}</span>
                          {ann.dialect && <span style={{ fontSize: 10, color: "#64748B", fontFamily: MONO }}>{ann.dialect}</span>}
                          <span style={{ fontSize: 10, color: "#374151", fontFamily: MONO }}>{new Date(ann.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: 14, color: "#E2E8F0", direction: "rtl", textAlign: "right", fontFamily: "'Noto Sans Arabic', 'Arial', sans-serif", lineHeight: 1.7, marginBottom: 10 }}>
                          {ann.inputText.slice(0, 120)}{ann.inputText.length > 120 ? "…" : ""}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E", fontFamily: MONO }}>{ann.label}</span>
                          <span style={{ fontSize: 11, color: "#64748B", fontFamily: MONO }}>{Math.round(Number(ann.confidence) * 100)}% confidence</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <span style={{ fontSize: 10, padding: "3px 10px", background: `${statusColor}18`, border: `1px solid ${statusColor}40`, borderRadius: 999, color: statusColor, fontFamily: MONO, textTransform: "uppercase" }}>
                          {ann.reviewStatus}
                        </span>
                        {ann.reviewStatus === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => reviewMutation.mutate({ id: ann.id, status: "approved" })} style={{ padding: "5px 12px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, color: "#22C55E", fontSize: 11, cursor: "pointer" }}>✓</button>
                            <button onClick={() => reviewMutation.mutate({ id: ann.id, status: "rejected" })} style={{ padding: "5px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#EF4444", fontSize: 11, cursor: "pointer" }}>✗</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Export Tab ── */}
        {activeTab === "export" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "24px" }}>
                <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20, fontWeight: 600 }}>Export Annotation Dataset</div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontFamily: MONO, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Format</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {(["jsonl", "csv"] as const).map(fmt => (
                      <button key={fmt} onClick={() => setExportFormat(fmt)} style={{
                        flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                        background: exportFormat === fmt ? "rgba(180,83,9,0.2)" : "rgba(0,0,0,0.2)",
                        border: exportFormat === fmt ? "1px solid rgba(180,83,9,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        color: exportFormat === fmt ? "#F59E0B" : "#64748B",
                        fontSize: 12, fontWeight: 700, fontFamily: MONO,
                      }}>
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, color: "#374151", fontFamily: MONO, lineHeight: 1.6 }}>
                    {exportFormat === "jsonl" ? "JSONL: One JSON object per line. Compatible with OpenAI, Gemini, Llama fine-tuning." : "CSV: Flat table format. Compatible with Excel, pandas, and data labeling platforms."}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontFamily: MONO, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Include</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {(["approved", "all"] as const).map(f => (
                      <button key={f} onClick={() => setExportStatusFilter(f)} style={{
                        flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                        background: exportStatusFilter === f ? "rgba(34,197,94,0.1)" : "rgba(0,0,0,0.2)",
                        border: exportStatusFilter === f ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        color: exportStatusFilter === f ? "#22C55E" : "#64748B",
                        fontSize: 12, fontWeight: 600,
                      }}>
                        {f === "approved" ? "Approved only" : "All annotations"}
                      </button>
                    ))}
                  </div>
                </div>

                {user ? (
                  <button
                    onClick={() => {
                      setExportUrl(null);
                      exportMutation.mutate({ format: exportFormat, statusFilter: exportStatusFilter });
                    }}
                    disabled={exportMutation.isPending}
                    style={{
                      width: "100%", padding: "13px",
                      background: exportMutation.isPending ? "rgba(180,83,9,0.3)" : "#B45309",
                      color: "#fff", border: "none", borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: exportMutation.isPending ? "not-allowed" : "pointer",
                    }}
                  >
                    {exportMutation.isPending ? "Generating export..." : `Export as ${exportFormat.toUpperCase()} →`}
                  </button>
                ) : (
                  <a href={loginUrl} style={{ display: "block", width: "100%", padding: "13px", background: "#B45309", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>Sign in to export</a>
                )}

                {exportMutation.isError && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, color: "#FCA5A5" }}>
                    {exportMutation.error.message}
                  </div>
                )}

                {exportUrl && (
                  <div style={{ marginTop: 16, padding: "16px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: "#22C55E", fontFamily: MONO, marginBottom: 10, fontWeight: 600 }}>Export ready — {exportMutation.data?.recordCount} records</div>
                    <a href={exportUrl} target="_blank" rel="noreferrer" style={{
                      display: "block", padding: "10px 16px", background: "#22C55E", color: "#fff",
                      borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center",
                    }}>
                      Download {exportFormat.toUpperCase()} file
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Export history */}
            <div>
              <div style={{ fontSize: 11, color: "#64748B", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, fontWeight: 500 }}>Export history</div>
              {!exportHistory || exportHistory.length === 0 ? (
                <div style={{ color: "#374151", fontSize: 12, fontFamily: MONO }}>No exports yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {exportHistory.map(exp => (
                    <div key={exp.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#F8FAFC", marginBottom: 4 }}>{exp.recordCount} records · {exp.format.toUpperCase()}</div>
                        <div style={{ fontSize: 10, color: "#64748B", fontFamily: MONO }}>{new Date(exp.createdAt).toLocaleString()}</div>
                      </div>
                      {exp.fileUrl && (
                        <a href={exp.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#F59E0B", textDecoration: "none", fontFamily: MONO, fontWeight: 600 }}>Download</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
