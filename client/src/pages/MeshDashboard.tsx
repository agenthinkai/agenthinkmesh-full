import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  AgentNode,
  CONTEXTS,
  DOMAIN_MAP,
  DEFAULT_PLACEHOLDER,
  LayoutNode,
  MeshContext,
  ROLE_CONTEXT_MAP,
  buildLayout,
  getAgentPlaceholder,
  inferAgents,
} from "@/lib/meshData";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import Logo from "@/components/Logo";
import { ExternalAgentCard } from "@/components/ExternalAgentCard";
import { DocumentVault } from "@/components/DocumentVault";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OutputMap { [label: string]: string }

// ─── MeshCanvas ───────────────────────────────────────────────────────────────
function MeshCanvas({ nodes, routedIds }: { nodes: LayoutNode[]; routedIds: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const toXY = (n: LayoutNode) => ({ x: (n.x / 100) * W, y: (n.y / 100) * H });
    const core = nodes.find(n => n.center);
    if (!core) return;
    const cp = toXY(core);
    // edges
    nodes.filter(n => !n.center).forEach(n => {
      const p = toXY(n);
      const routed = routedIds.includes(n.id);
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = n.spawned ? "rgba(201,168,76,0.5)" : routed ? "rgba(123,163,212,0.6)" : "rgba(168,180,200,0.2)";
      ctx.lineWidth = n.spawned ? 1.5 : 1;
      ctx.setLineDash(n.spawned ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    // nodes
    nodes.forEach(n => {
      const p = toXY(n);
      const r = n.center ? 10 : 5;
      const routed = routedIds.includes(n.id);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = n.center ? n.color : routed ? n.color : "#1C3057";
      ctx.fill();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = n.center ? 0 : 1.5;
      ctx.stroke();
      // label
      ctx.font = `${n.center ? 600 : 400} 8px 'DM Mono', monospace`;
      ctx.fillStyle = "#8494AA";
      ctx.textAlign = "center";
      ctx.fillText(n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label, p.x, p.y + r + 9);
    });
  }, [nodes, routedIds]);
  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={260}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

// ─── ContextSwitcher ──────────────────────────────────────────────────────────
function ContextSwitcher({ current, onSwitch, onClose }: {
  current: string;
  onSwitch: (key: string) => void;
  onClose: () => void;
}) {
  const [activeDomain, setActiveDomain] = useState(CONTEXTS[current]?.domain || "finance");
  const domainContexts = Object.entries(CONTEXTS).filter(([, c]) => c.domain === activeDomain);
  return (
    <div style={{
      position: "absolute", top: 44, left: 0, zIndex: 200,
      background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", width: 320, overflow: "hidden",
    }}>
      {/* Domain tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1C3057", padding: "8px 8px 0" }}>
        {Object.entries(DOMAIN_MAP).map(([key, d]) => (
          <button key={key} onClick={() => setActiveDomain(key)} style={{
            flex: 1, padding: "6px 4px", border: "none", background: "none", cursor: "pointer",
            borderBottom: activeDomain === key ? "2px solid #7BA3D4" : "2px solid transparent",
            fontSize: 9, color: activeDomain === key ? "#7BA3D4" : "#637080",
            fontFamily: "'DM Mono', monospace", fontWeight: 600,
          }}>
            {d.icon}
          </button>
        ))}
      </div>
      {/* Context list */}
      <div style={{ fontSize: 9, color: "#637080", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 14px 4px", fontFamily: "'JetBrains Mono', monospace" }}>
        Select context
      </div>
      {domainContexts.map(([id, c]) => (
        <button key={id} onClick={() => { onSwitch(id); onClose(); }} style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "10px 14px", border: "none", background: id === current ? "rgba(123,163,212,0.1)" : "none",
          cursor: "pointer", textAlign: "left",
        }}>
          <span style={{ fontSize: 14 }}>{c.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 12, color: "#E8ECF2" }}>{c.label}</div>
            <div style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
              {c.agents.slice(0, 3).join(" · ")} +{c.agents.length - 3}
            </div>
          </div>
          {id === current && <span style={{ fontSize: 10, color: "#7BA3D4" }}>✓</span>}
        </button>
      ))}
      <div style={{ padding: "8px 14px 10px", borderTop: "1px solid #1C3057", fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>
        {Object.keys(CONTEXTS).length} contexts available · max 50 agents per task
      </div>
    </div>
  );
}

// ─── AgentCard ────────────────────────────────────────────────────────────────
function AgentCard({ agent, taskText, contextLabel, systemPromptBase, vaultText, activeDocId, delay, onDone }: {
  agent: AgentNode;
  taskText: string;
  contextLabel: string;
  systemPromptBase: string;
  vaultText: string;
  activeDocId?: number | null;
  delay: number;
  onDone: (label: string, text: string) => void;
}) {
  const [status, setStatus] = useState<"queued"|"running"|"done"|"error">("queued");
  const [content, setContent] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [intent, setIntent] = useState<string>("analysis");
  const [copied, setCopied] = useState(false);
  const [savedToVault, setSavedToVault] = useState(false);
  const [savingToVault, setSavingToVault] = useState(false);
  const saveAgentOutput = trpc.vault.saveAgentOutput.useMutation();
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const color = agent.spawned ? "#C9A84C" : "#7BA3D4";
  const runAgentTask = trpc.mesh.runAgentTask.useMutation();
  // Use a ref so the async effect always reads the LATEST vaultText value,
  // even though the effect runs with an empty dependency array.
  const vaultTextRef = useRef(vaultText);
  useEffect(() => { vaultTextRef.current = vaultText; }, [vaultText]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setStatus("running");
      startRef.current = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);

      try {
        const { result, intent: detectedIntent } = await runAgentTask.mutateAsync({
          agentLabel: agent.label,
          systemPromptBase,
          taskText,
          contextLabel,
          vaultText: vaultTextRef.current || "",
          activeDocId: activeDocId ?? undefined,
        });
        clearInterval(timerRef.current!);
        setIntent(detectedIntent ?? "analysis");
        // Typewriter effect for the result
        let i = 0;
        const tw = setInterval(() => {
          i += 6;
          setContent(result.slice(0, i));
          if (i >= result.length) {
            clearInterval(tw);
            setStatus("done");
            onDone(agent.label, result);
          }
        }, 12);
      } catch (err: unknown) {
        clearInterval(timerRef.current!);
        const msg = err instanceof Error ? err.message : String(err);
        setContent(`Error: ${msg}`);
        setStatus("error");
        onDone(agent.label, `Error: ${msg}`);
      }
    }, delay);
    return () => { clearTimeout(timeout); clearInterval(timerRef.current!); };
  }, []);

  const chip = (s: typeof status) => {
    const map = {
      queued:  { label: "Queued",  bg: "rgba(168,180,200,0.1)", color: "#8494AA" },
      running: { label: "Running", bg: "rgba(123,163,212,0.15)", color: "#7BA3D4" },
      done:    { label: "Done",    bg: "rgba(74,222,128,0.12)", color: "#4ADE80" },
      error:   { label: "Error",   bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
    };
    const c = map[s];
    return <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.color, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{c.label}</span>;
  };

  return (
    <div style={{
      background: "#0F1E38",
      border: `1px solid ${status === "done" ? "rgba(74,222,128,0.3)" : status === "error" ? "rgba(239,68,68,0.3)" : "#1C3057"}`,
      borderRadius: 14, padding: "14px 16px", marginBottom: 10,
      boxShadow: status === "done" ? "0 0 0 1px rgba(74,222,128,0.2), 0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.3)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: "#E8ECF2", flex: 1 }}>
          {agent.label}
          {agent.spawned && <span style={{ marginLeft: 6, fontSize: 8, padding: "1px 6px", borderRadius: 999, background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>⚡ NEW</span>}
        </span>
        {status === "done" && intent !== "analysis" && (() => {
          const intentMeta: Record<string, { label: string; color: string; bg: string }> = {
            draft_document:   { label: "✉ DRAFT",      color: "#C9A84C", bg: "rgba(201,168,76,0.12)" },
            generate_code:    { label: "</> CODE",      color: "#7DD3FC", bg: "rgba(125,211,252,0.10)" },
            decision:         { label: "⚖ DECISION",   color: "#A78BFA", bg: "rgba(167,139,250,0.10)" },
            compliance_check: { label: "✓ COMPLIANCE", color: "#34D399", bg: "rgba(52,211,153,0.10)" },
            qa_test:          { label: "🧪 QA TEST",   color: "#FB923C", bg: "rgba(251,146,60,0.10)" },
          };
          const m = intentMeta[intent];
          return m ? <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 999, background: m.bg, color: m.color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, border: `1px solid ${m.color}30` }}>{m.label}</span> : null;
        })()}
        {chip(status)}
        {(status === "done" || status === "running") && <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace" }}>{elapsed}s</span>}
      </div>
      {content && (
        intent === "generate_code" ? (
          // Code output: syntax-highlighted block with copy button
          <div style={{ position: "relative" }}>
            <pre style={{ margin: 0, fontSize: 10, color: "#7DD3FC", lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(125,211,252,0.15)" }}>{content}</pre>
            {status === "done" && (
              <button
                onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ position: "absolute", top: 6, right: 6, background: copied ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "2px 8px", fontSize: 9, color: copied ? "#4ADE80" : "#94A3B8", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}
              >{copied ? "✓ Copied" : "Copy"}</button>
            )}
          </div>
        ) : intent === "draft_document" ? (
          // Document draft: clean prose layout with copy button
          <div style={{ position: "relative" }}>
            <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 8, padding: "10px 12px" }}>
              <pre style={{ margin: 0, fontSize: 10, color: "#E8D5A3", lineHeight: 1.8, fontFamily: "'Inter', sans-serif", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</pre>
            </div>
            {status === "done" && (
              <button
                onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ position: "absolute", top: 6, right: 6, background: copied ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "2px 8px", fontSize: 9, color: copied ? "#4ADE80" : "#94A3B8", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}
              >{copied ? "✓ Copied" : "Copy"}</button>
            )}
          </div>
        ) : intent === "decision" ? (
          // Decision: highlight verdict in large text
          <div>
            {(() => {
              const verdictMatch = content.match(/VERDICT:\s*([^\n]+)/);
              const verdict = verdictMatch?.[1]?.trim() ?? "";
              const isPositive = /PROCEED|BUY|APPROVE|YES/i.test(verdict);
              const isNegative = /DO NOT|SELL|REJECT|NO/i.test(verdict);
              const verdictColor = isPositive ? "#4ADE80" : isNegative ? "#EF4444" : "#F59E0B";
              return verdict ? (
                <div style={{ marginBottom: 8, padding: "6px 10px", background: `${verdictColor}15`, border: `1px solid ${verdictColor}40`, borderRadius: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: verdictColor, fontFamily: "'Inter', sans-serif", letterSpacing: "0.05em" }}>{verdict}</span>
                </div>
              ) : null;
            })()}
            <pre style={{ margin: 0, fontSize: 10, color: "#A8B4C8", lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</pre>
          </div>
        ) : (
          // Default: analysis / compliance / qa — monospace pre
          <pre style={{ margin: 0, fontSize: 10, color: "#A8B4C8", lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</pre>
        )
      )}
      {!content && status === "queued" && <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>Standby…</div>}
      {status === "done" && content && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            disabled={savedToVault || savingToVault}
            onClick={async () => {
              setSavingToVault(true);
              try {
                const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                const intentLabel = intent === "draft_document" ? "Draft" : intent === "generate_code" ? "Code" : intent === "decision" ? "Decision" : intent === "compliance_check" ? "Compliance" : intent === "qa_test" ? "QA" : "Analysis";
                await saveAgentOutput.mutateAsync({
                  filename: `${agent.label} — ${intentLabel} — ${dateStr}`,
                  content,
                  intent,
                });
                setSavedToVault(true);
              } catch {
                // silently fail — user can retry
              } finally {
                setSavingToVault(false);
              }
            }}
            style={{
              background: savedToVault ? "rgba(74,222,128,0.15)" : savingToVault ? "rgba(255,255,255,0.05)" : "rgba(123,163,212,0.12)",
              border: `1px solid ${savedToVault ? "rgba(74,222,128,0.4)" : "rgba(123,163,212,0.3)"}`,
              borderRadius: 6, padding: "4px 12px", fontSize: 9,
              color: savedToVault ? "#4ADE80" : savingToVault ? "#637080" : "#7BA3D4",
              cursor: savedToVault || savingToVault ? "default" : "pointer",
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            {savedToVault ? "✓ Saved to Vault" : savingToVault ? "Saving…" : "🗄 Save to Vault"}
          </button>
        </div>
      )}
    </div>
  );
}
// ─── OutputPanel ────────────────────────────────────────────────────────────────
// ─── Final Summary Card ──────────────────────────────────────────────────────
function FinalSummaryCard({ taskText, contextLabel, agentOutputs }: {
  taskText: string;
  contextLabel: string;
  agentOutputs: { agentName: string; output: string }[];
}) {
  const summarise = trpc.mesh.summariseOutputs.useMutation();
  const [summary, setSummary] = useState<{
    headline: string;
    keyFindings: string[];
    conflicts: string[];
    nextActions: string[];
    overallConfidence: number;
    confidenceRationale: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    summarise.mutateAsync({ taskText, contextLabel, agentOutputs }).then(setSummary).catch(() => {});
  }, []);

  const copyToClipboard = () => {
    if (!summary) return;
    const text = [
      summary.headline,
      "",
      "KEY FINDINGS",
      ...summary.keyFindings.map(f => `• ${f}`),
      "",
      summary.conflicts.length > 0 ? "CONFLICTS / GAPS" : "",
      ...summary.conflicts.map(c => `⚠ ${c}`),
      "",
      "NEXT ACTIONS",
      ...summary.nextActions.map((a, i) => `${i + 1}. ${a}`),
      "",
      `Confidence: ${summary.overallConfidence}% — ${summary.confidenceRationale}`,
    ].filter(l => l !== undefined).join("\n");
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const confidenceColor = summary
    ? summary.overallConfidence >= 80 ? "#4ADE80"
    : summary.overallConfidence >= 60 ? "#C9A84C"
    : "#F87171"
    : "#637080";

  return (
    <div style={{
      background: "linear-gradient(135deg, #0F1E38 0%, #0B1629 100%)",
      border: "1px solid rgba(123,163,212,0.35)",
      borderRadius: 16,
      padding: "22px 24px",
      marginTop: 8,
      boxShadow: "0 4px 32px rgba(123,163,212,0.08)",
      animation: "slide-up-fade-in 0.5s ease-out",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(123,163,212,0.12)", border: "1px solid rgba(123,163,212,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚡</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#7BA3D4", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace" }}>Mesh Final Summary</div>
            <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "'JetBrains Mono', monospace" }}>Synthesised from {agentOutputs.length} agent outputs</div>
          </div>
        </div>
        {summary && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", background: `${confidenceColor}15`, border: `1px solid ${confidenceColor}40`, borderRadius: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: confidenceColor, display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: confidenceColor, fontFamily: "'JetBrains Mono', monospace" }}>{summary.overallConfidence}% confidence</span>
            </div>
            <button onClick={copyToClipboard} style={{ background: "transparent", border: "1px solid #1C3057", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 10, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace" }}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {summarise.isPending && !summary && (
        <div>
          <div style={{ height: 18, width: "80%", borderRadius: 6, background: "linear-gradient(90deg, rgba(28,48,87,0.8) 0%, rgba(123,163,212,0.15) 50%, rgba(28,48,87,0.8) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.3s ease-in-out infinite", marginBottom: 12 }} />
          {["60%", "75%", "50%"].map((w, i) => (
            <div key={i} style={{ height: 10, width: w, borderRadius: 4, background: "linear-gradient(90deg, rgba(28,48,87,0.6) 0%, rgba(123,163,212,0.1) 50%, rgba(28,48,87,0.6) 100%)", backgroundSize: "200% 100%", animation: `shimmer 1.3s ease-in-out infinite`, animationDelay: `${i * 0.2}s`, marginBottom: 8 }} />
          ))}
          <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "'JetBrains Mono', monospace", marginTop: 8 }}>Generating executive summary…</div>
        </div>
      )}

      {/* Summary content */}
      {summary && (
        <div data-summary-content="true" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Headline */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#E8ECF2", lineHeight: 1.5, fontFamily: "'Inter', sans-serif", borderLeft: "3px solid #7BA3D4", paddingLeft: 12 }}>
            {summary.headline}
          </div>

          {/* Key Findings */}
          {summary.keyFindings.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: "#7BA3D4", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, marginBottom: 8 }}>Key Findings</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {summary.keyFindings.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#4ADE80", fontSize: 10, marginTop: 2, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 12, color: "#A8B4C8", lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {summary.conflicts.length > 0 && (
            <div>
              <div style={{ fontSize: 9, color: "#C9A84C", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, marginBottom: 8 }}>Conflicts / Gaps</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {summary.conflicts.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "#C9A84C", fontSize: 10, marginTop: 2, flexShrink: 0 }}>⚠</span>
                    <span style={{ fontSize: 12, color: "#A8B4C8", lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Actions */}
          {summary.nextActions.length > 0 && (
            <div style={{ background: "rgba(123,163,212,0.04)", border: "1px solid rgba(123,163,212,0.15)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: "#7BA3D4", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, marginBottom: 10 }}>Recommended Next Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {summary.nextActions.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(123,163,212,0.12)", border: "1px solid rgba(123,163,212,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#7BA3D4", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: "#E8ECF2", lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>{a}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence rationale */}
          <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "'JetBrains Mono', monospace", paddingTop: 4, borderTop: "1px solid #152542" }}>
            {summary.confidenceRationale}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OutputPanel ──────────────────────────────────────────────────────────────
function OutputPanel({ agents, taskText, ctx, vaultText, activeDocId, onBack, onDone }: {
  agents: AgentNode[];
  taskText: string;
  ctx: MeshContext;
  vaultText: string;
  activeDocId?: number | null;
  onBack: () => void;
  onDone: (outputs: OutputMap) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const outputsRef = useRef<OutputMap>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());

  // Discover top registered external agent — pass context agent labels for domain-aware matching
  const contextCapabilities = useMemo(() => agents.map(a => a.label), [agents]);
  const { data: discoveredAgents } = trpc.agent.discover.useQuery(
    { capabilities: contextCapabilities, limit: 1 },
    { staleTime: 60000 }
  );
  const topExternalAgent = discoveredAgents && discoveredAgents.length > 0 ? discoveredAgents[0] : null;

  const total = agents.length + (topExternalAgent ? 1 : 0);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(timerRef.current!);
  }, []);

  useEffect(() => {
    if (doneCount >= total) { clearInterval(timerRef.current!); onDone(outputsRef.current); }
  }, [doneCount, total]);

  const handleDone = useCallback((label: string, text: string) => {
    outputsRef.current[label] = text;
    setDoneCount(c => c + 1);
  }, []);

  const exportPDF = () => {
    const date = new Date().toISOString().split("T")[0];
    const title = taskText.length > 100 ? taskText.slice(0, 100) + "…" : taskText;

    // Build agent output cards
    const cardsHtml = agents.map(ag => {
      const text = outputsRef.current[ag.label] || "";
      if (!text) return "";
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<div class="card"><div class="agent-name">${ag.label}${ag.spawned ? ' <span class="spawned">⚡ Spawned</span>' : ""}</div><pre>${escaped}</pre></div>`;
    }).join("");

    // Build Final Summary section if available
    const summaryEl = document.querySelector("[data-summary-content]");
    const summaryHtml = summaryEl ? `
      <div class="summary-section">
        <div class="summary-title">⚡ Mesh Final Summary</div>
        ${summaryEl.innerHTML}
      </div>` : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title.replace(/</g, "&lt;")}</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; padding: 40px; color: #1E293B; font-size: 11.5px; line-height: 1.6; }
    .header { border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 28px; }
    h1 { font-size: 16px; font-weight: 800; color: #0F172A; margin-bottom: 5px; }
    .meta { color: #94A3B8; font-size: 10px; font-family: 'DM Mono', monospace; }
    .card { border: 1px solid #E2E8F0; border-radius: 10px; padding: 18px; margin-bottom: 16px; page-break-inside: avoid; }
    .agent-name { font-weight: 700; font-size: 12px; color: #4F46E5; margin-bottom: 10px; }
    .spawned { font-size: 9px; color: #F59E0B; font-weight: 600; }
    pre { white-space: pre-wrap; word-break: break-word; font-family: 'DM Mono', monospace; font-size: 10.5px; color: #374151; }
    .summary-section { border: 2px solid #4F46E5; border-radius: 12px; padding: 20px 22px; margin-top: 24px; page-break-inside: avoid; background: #F8F9FF; }
    .summary-title { font-size: 13px; font-weight: 800; color: #4F46E5; margin-bottom: 14px; letter-spacing: 0.04em; }
    .summary-section * { color: #1E293B !important; background: transparent !important; border-color: #CBD5E1 !important; font-family: 'Inter', sans-serif !important; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 9px; color: #CBD5E1; font-family: 'DM Mono', monospace; }
    @media print {
      body { padding: 20px; }
      @page { margin: 15mm 12mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title.replace(/</g, "&lt;")}</h1>
    <div class="meta">${ctx.label} · ${agents.length} agents · ${date} · AgenThink Mesh</div>
  </div>
  ${cardsHtml}
  ${summaryHtml}
  <div class="footer">Generated by AgenThink Mesh · ${new Date().toLocaleString()}</div>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for fonts to load then trigger print dialog
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 600);
    };
  };

  const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: isSmallScreen ? "14px 12px" : "22px 24px", background: "#0B1629" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid #1C3057", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>← Back</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: isSmallScreen ? 12 : 13, fontWeight: 700, color: "#E8ECF2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isSmallScreen ? "normal" : "nowrap" }}>{taskText.length > (isSmallScreen ? 60 : 80) ? taskText.slice(0, isSmallScreen ? 60 : 80) + "…" : taskText}</div>
          <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
            {ctx.label} · {agents.length} agents · {doneCount >= total ? "Completed" : `Running · ${elapsed}s`}
          </div>
        </div>
        {doneCount >= total && (
          <button onClick={exportPDF} style={{ background: "linear-gradient(135deg, #1C3057 0%, #243B6E 100%)", color: "#E8ECF2", border: "1px solid rgba(168,180,200,0.2)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 700, flexShrink: 0 }}>
            ↓ Export PDF
          </button>
        )}
      </div>
      {agents.map((ag, i) => (
        <AgentCard
          key={ag.id}
          agent={ag}
          taskText={taskText}
          contextLabel={ctx.label}
          systemPromptBase={ctx.systemPromptBase}
          vaultText={vaultText}
          activeDocId={activeDocId}
          delay={i * 400}
          onDone={handleDone}
        />
      ))}
      {topExternalAgent && (
        <ExternalAgentCard
          key={`ext-${topExternalAgent.id}`}
          agentId={topExternalAgent.id}
          agentName={topExternalAgent.agentName}
          taskText={taskText}
          contextLabel={ctx.label}
          onDone={handleDone}
        />
      )}

      {/* Final Summary — shown after all agents complete */}
      {doneCount >= total && total > 0 && (
        <FinalSummaryCard
          taskText={taskText}
          contextLabel={ctx.label}
          agentOutputs={Object.entries(outputsRef.current)
            .filter(([, output]) => output && output.trim().length > 0)
            .map(([agentName, output]) => ({ agentName, output }))}
        />
      )}
    </div>
  );
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────
function HistoryPanel({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const { data: history, isLoading } = trpc.mesh.getHistory.useQuery();
  type HistoryRow = NonNullable<typeof history>[number];
  const filtered = (history || []).filter((h: HistoryRow) =>
    h.task.toLowerCase().includes(search.toLowerCase()) ||
    h.contextLabel.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", background: "#0B1629" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #1C3057", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace" }}>← Back</button>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: "#E8ECF2", flex: 1 }}>Task History</div>
      </div>
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search tasks…"
        style={{ width: "100%", padding: "8px 12px", border: "1px solid #1C3057", borderRadius: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", marginBottom: 14, outline: "none", background: "#0F1E38", color: "#E8ECF2" }}
      />
      {isLoading && <div style={{ fontSize: 11, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>Loading…</div>}
      {!isLoading && filtered.length === 0 && <div style={{ fontSize: 11, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>No tasks yet. Execute your first task to see history here.</div>}
      {filtered.map((h: HistoryRow) => (
        <div key={h.id} style={{ background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: "#E8ECF2", marginBottom: 4 }}>{h.task.length > 80 ? h.task.slice(0, 80) + "…" : h.task}</div>
          <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>
            {h.contextLabel} · {h.agentCount} agents · {new Date(h.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem("mesh_api_key") || "");
  const [saved, setSaved] = useState(false);
  const save = () => {
    if (apiKey.trim()) sessionStorage.setItem("mesh_api_key", apiKey.trim());
    else sessionStorage.removeItem("mesh_api_key");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", background: "#0B1629" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #1C3057", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace" }}>← Back</button>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: "#E8ECF2" }}>Settings</div>
      </div>
      <div style={{ background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 14, padding: "20px" }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: "#E8ECF2", marginBottom: 4 }}>Anthropic API Key</div>
        <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>
          Required for live AI output. Stored in session only — never sent to our servers. Get one at console.anthropic.com
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-ant-…"
          style={{ width: "100%", padding: "9px 12px", border: "1px solid #1C3057", borderRadius: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10, outline: "none", background: "#0B1629", color: "#E8ECF2" }}
        />
        <button onClick={save} style={{ background: "linear-gradient(135deg, #1C3057 0%, #243B6E 100%)", color: "#E8ECF2", border: "1px solid rgba(168,180,200,0.2)", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
          {saved ? "Saved ✓" : "Save Key"}
        </button>
        {!apiKey && (
          <div style={{ marginTop: 12, fontSize: 10, color: "#C9A84C", fontFamily: "'JetBrains Mono', monospace", padding: "8px 10px", background: "rgba(201,168,76,0.08)", borderRadius: 6, border: "1px solid rgba(201,168,76,0.3)" }}>
            No API key set — agents will run in placeholder mode with structured demo output.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recent Tasks Panel ───────────────────────────────────────────────────────
function RecentTasksPanel({ onRerun }: { onRerun: (task: string) => void }) {
  const { data: history, isLoading } = trpc.mesh.getHistory.useQuery();
  type HistoryRow = NonNullable<typeof history>[number];
  const recent = (history || []).slice(0, 5);
  return (
    <div style={{ background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: "#637080", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>Recent Tasks</span>
        {history && history.length > 5 && (
          <span style={{ fontSize: 9, color: "#7BA3D4", fontFamily: "'JetBrains Mono', monospace", cursor: "pointer" }}>{history.length} total</span>
        )}
      </div>
      {isLoading && <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>Loading…</div>}
      {!isLoading && recent.length === 0 && (
        <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace", textAlign: "center", padding: "10px 0" }}>No tasks yet — execute your first task above</div>
      )}
      {recent.map((h: HistoryRow) => (
        <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #152542" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#A8B4C8", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {h.task.length > 60 ? h.task.slice(0, 60) + "…" : h.task}
            </div>
            <div style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
              {h.contextLabel} · {h.agentCount} agents · {new Date(h.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => onRerun(h.task)}
            style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, background: "rgba(123,163,212,0.12)", color: "#7BA3D4", border: "1px solid rgba(123,163,212,0.2)", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, flexShrink: 0 }}
          >
            ▶ Rerun
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Right-panel widgets ─────────────────────────────────────────────────────
function LiveActivityWidget() {
  const { data: activity, isLoading } = trpc.mesh.getRecentActivity.useQuery();
  type Row = NonNullable<typeof activity>[number];
  return (
    <div style={{ background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: "#637080", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>Live Mesh Activity</span>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 3px rgba(34,197,94,0.2)" }} />
      </div>
      {isLoading && <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>Loading…</div>}
      {!isLoading && (!activity || activity.length === 0) && (
        <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace", textAlign: "center", padding: "12px 0" }}>No activity yet — execute your first task</div>
      )}
      {(activity || []).map((row: Row, i: number) => (
        <div key={row.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingBottom: 8, marginBottom: 8, borderBottom: i < (activity!.length - 1) ? "1px solid #F8FAFC" : "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(123,163,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>⚡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "#A8B4C8", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.task.length > 42 ? row.task.slice(0, 42) + "…" : row.task}
            </div>
            <div style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
              {row.contextLabel} · {row.agentCount} agents
            </div>
          </div>
          <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 999, background: "rgba(74,222,128,0.12)", color: "#4ADE80", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, flexShrink: 0 }}>Done</span>
        </div>
      ))}
    </div>
  );
}

function AgentStatusWidget({ agentList, ctxColor }: { agentList: AgentNode[]; ctxColor: string }) {
  return (
    <div style={{ background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
             <span style={{ fontSize: 9, color: "#637080", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>Agent capacity</span>
        <span style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>{agentList.length} active</span>
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {agentList.map(ag => (
          <div key={ag.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: ag.spawned ? "#F59E0B" : ctxColor, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "#A8B4C8", fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>{ag.label}</span>
            </div>
            <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 999, background: ag.spawned ? "rgba(201,168,76,0.12)" : "rgba(168,180,200,0.08)", color: ag.spawned ? "#C9A84C" : "#637080", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
              {ag.spawned ? "⚡ spawned" : "standby"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemMetricsWidget() {
  const { data: metrics, isLoading } = trpc.mesh.getMetrics.useQuery();
  const stats = [
    { label: "Tasks Today",   value: isLoading ? "—" : String(metrics?.tasksToday ?? 0),    unit: "",  color: "#7BA3D4" },
    { label: "Total Tasks",   value: isLoading ? "—" : String(metrics?.totalTasks ?? 0),    unit: "",  color: "#8BBFD4" },
    { label: "Avg Agents",    value: isLoading ? "—" : String(metrics?.avgAgents ?? 0),     unit: "/task", color: "#A89BD4" },
    { label: "Success Rate",  value: isLoading ? "—" : String(metrics?.successRate ?? 100), unit: "%", color: "#4ADE80" },
  ];
  return (
    <div style={{ background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, color: "#637080", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, marginBottom: 12 }}>System Metrics</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "#0B1629", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontFamily: "'Inter', sans-serif", fontWeight: 800, color: s.color, lineHeight: 1 }}>
              {s.value}<span style={{ fontSize: 10, color: "#637080", fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Center Section: Metrics Row ───────────────────────────────────────────────────────────────────────────────
function CenterMetrics() {
  const { data: metrics, isLoading } = trpc.mesh.getMetrics.useQuery();
  const items = [
    { label: "Today",   value: isLoading ? "—" : String(metrics?.tasksToday ?? 0),    color: "#7BA3D4" },
    { label: "Total",   value: isLoading ? "—" : String(metrics?.totalTasks ?? 0),    color: "#8BBFD4" },
    { label: "Agents",  value: isLoading ? "—" : String(metrics?.avgAgents ?? 0),     color: "#A89BD4" },
    { label: "Success", value: isLoading ? "—" : `${metrics?.successRate ?? 100}%`,   color: "#4ADE80" },
  ];
  const isSmall = typeof window !== "undefined" && window.innerWidth < 768;
  return (
    <div style={{ display: "grid", gridTemplateColumns: isSmall ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
      {items.map(item => (
        <div key={item.label} style={{ background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 22, fontFamily: "'Inter', sans-serif", fontWeight: 800, color: item.color, lineHeight: 1, letterSpacing: "-0.02em" }}>{item.value}</div>
          <div style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginTop: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Right Panel: Metrics Strip ───────────────────────────────────────────────────────────────────────────────
function RightPanelMetrics() {
  const { data: metrics, isLoading } = trpc.mesh.getMetrics.useQuery();
  const items = [
    { label: "Today",   value: isLoading ? "—" : String(metrics?.tasksToday ?? 0),    sub: "tasks",   color: "#7BA3D4" },
    { label: "Total",   value: isLoading ? "—" : String(metrics?.totalTasks ?? 0),    sub: "tasks",   color: "#8BBFD4" },
    { label: "Agents",  value: isLoading ? "—" : String(metrics?.avgAgents ?? 0),     sub: "avg/task", color: "#A89BD4" },
    { label: "Success", value: isLoading ? "—" : `${metrics?.successRate ?? 100}%`,   sub: "rate",    color: "#4ADE80" },
  ];
  return (
    <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #1C3057", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flexShrink: 0 }}>
      {items.map(item => (
        <div key={item.label} style={{ background: "#0B1629", borderRadius: 10, padding: "10px 12px", border: "1px solid #1C3057" }}>
          <div style={{ fontSize: 20, fontFamily: "'Inter', sans-serif", fontWeight: 800, color: item.color, lineHeight: 1, letterSpacing: "-0.02em" }}>{item.value}</div>
          <div style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Right Panel: Live Activity Feed ──────────────────────────────────────────────────────────────────────────────
function LiveActivityFeed() {
  const { data: activity, isLoading } = trpc.mesh.getRecentActivity.useQuery();
  type Row = NonNullable<typeof activity>[number];
  if (isLoading) return <div style={{ padding: "14px", fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>Loading…</div>;
  if (!activity || activity.length === 0) return (
    <div style={{ padding: "16px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>⚡</div>
      <div style={{ fontSize: 11, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>No activity yet</div>
      <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>Execute your first task above</div>
    </div>
  );
  return (
    <div style={{ padding: "8px 0" }}>
      {(activity || []).map((row: Row, i: number) => (
        <div key={row.id} style={{
          display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 14px",
          borderBottom: i < activity.length - 1 ? "1px solid rgba(28,48,87,0.5)" : "none",
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(123,163,212,0.08)", border: "1px solid rgba(123,163,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 }}>⚡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#A8B4C8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
              {row.task.length > 38 ? row.task.slice(0, 38) + "…" : row.task}
            </div>
            <div style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>
              {row.contextLabel} · {row.agentCount} agents
            </div>
          </div>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 999, background: "rgba(74,222,128,0.1)", color: "#4ADE80", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, border: "1px solid rgba(74,222,128,0.15)", flexShrink: 0 }}>Done</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────────────────────────
export default function MeshDashboard() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();

  // State
  // null = no context selected yet (prompt-first mode)
  const [role, setRole] = useState<string | null>(() => {
    const saved = localStorage.getItem("mesh_role");
    return saved || null;
  });
  const [task, setTask] = useState("");
  const [showOutput, setShowOutput] = useState(false);
  const [currentAgents, setCurrentAgents] = useState<AgentNode[]>([]);
  const [activeNav, setActiveNav] = useState<"home"|"history"|"settings">("home");
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [routedNodes, setRoutedNodes] = useState<string[]>([]);
  const [vaultText, setVaultText] = useState("");
  const [activeVaultDocId, setActiveVaultDocId] = useState<number | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootStep, setBootStep] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileAgentPanelOpen, setMobileAgentPanelOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Smart routing state
  const [routingAnalysis, setRoutingAnalysis] = useState<{
    relevantAgents: string[];
    irrelevantAgents: string[];
    domainMatch: boolean;
    suggestedDomain: string | null;
    suggestedContext: string | null;
    reasoning: string;
  } | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  // Ref to suppress the task-reset in the role-change effect during an active auto-switch
  const suppressTaskResetRef = useRef(false);
  // Frozen task text captured at run() time — used by OutputPanel so stale state doesn't cause empty taskText
  const [frozenTask, setFrozenTask] = useState("");
  // Mismatch pending: when user manually selected a context but prompt doesn't match
  // Pauses execution and shows "Switch & Run" / "Run Anyway" choice
  const [mismatchPending, setMismatchPending] = useState<{
    suggestedKey: string;
    suggestedDomain: string;
    suggestedContext: string;
    capturedTask: string;
  } | null>(null);
  // Auto-switch banner: shown when the system switches context based on prompt
  const [autoSwitchBanner, setAutoSwitchBanner] = useState<{ from: string; to: string; toContext: string } | null>(null);
  // Agent discovery animation state
  // idle → scanning (LLM call) → assembling (agents appear one-by-one) → executing
  const [assemblyPhase, setAssemblyPhase] = useState<"idle" | "scanning" | "assembling" | "executing">("idle");
  const [assembledAgents, setAssembledAgents] = useState<string[]>([]); // labels revealed so far

  // ctx is null when no context is selected (prompt-first mode)
  const ctx = role ? CONTEXTS[role] : null;

  // ── Domain nav groups for sidebar (must be before any early return) ─────────────────────────────────────────
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(DOMAIN_MAP).forEach(d => { initial[d] = false; });
    return initial;
  });
  const toggleDomain = (d: string) => setExpandedDomains(prev => ({ ...prev, [d]: !prev[d] }));

  const DOMAIN_COLORS: Record<string, string> = {
    finance: "#7BA3D4", legal: "#9B7FD4", healthcare: "#4ADE80",
    enterprise: "#38BDF8", gccwealth: "#C9A84C",
  };

  const [agentList, setAgentList] = useState<AgentNode[]>(() =>
    role ? CONTEXTS[role].agents.map((label, i) => ({ id: "a" + i, label, spawned: false })) : []
  );

  // Dynamic placeholder: rotate through top-3 agents in current context
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => { setPlaceholderIdx(0); }, [role]);
  useEffect(() => {
    if (!agentList.length) return;
    const timer = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % Math.min(3, agentList.length));
    }, 4000);
    return () => clearInterval(timer);
  }, [agentList]);
  const dynamicPlaceholder = agentList.length > 0
    ? getAgentPlaceholder(agentList[placeholderIdx]?.label ?? "")
    : DEFAULT_PLACEHOLDER;

  // tRPC mutations
  const routeAgentsMutation = trpc.mesh.routeAgents.useMutation();
  const saveHistory = trpc.mesh.saveTask.useMutation({
    onSuccess: () => utils.mesh.getHistory.invalidate(),
  });

  // Debounced agent inference (only when a context is selected)
  useEffect(() => {
    if (!ctx) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAgentList(inferAgents(task, ctx.agents));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [task, role]);

  // Reset on role change — skip task reset if an auto-switch is in progress
  useEffect(() => {
    if (!role) { setAgentList([]); return; }
    setAgentList(CONTEXTS[role].agents.map((label: string, i: number) => ({ id: "a" + i, label, spawned: false })));
    if (!suppressTaskResetRef.current) {
      setTask("");
      setShowOutput(false);
      setRoutedNodes([]);
    }
    localStorage.setItem("mesh_role", role);
  }, [role]);

  // Boot sequence
  const bootMsgs = ["Initialising Mesh…", "Identifying profile…", ctx ? `Detected: ${ctx.label}` : "Prompt-first mode", "Configuring agents…", "Ready."];
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      setBootStep(i);
      if (i >= bootMsgs.length - 1) { clearInterval(t); setTimeout(() => setBooting(false), 500); }
    }, 480);
    return () => clearInterval(t);
  }, []);

  const meshNodes = buildLayout(agentList, ctx?.color ?? "#7BA3D4");
  const spawnedCount = agentList.filter(a => a.spawned).length;

  // Helper: find best matching context key from LLM-suggested domain/context strings
  const findBestContextKey = (suggestedDomain: string | null, suggestedContext: string | null): string | null => {
    const ctxLower = (suggestedContext ?? "").toLowerCase().trim();
    const domLower = (suggestedDomain ?? "").toLowerCase().trim();
    // 1. Exact context label match
    if (ctxLower) {
      const exact = Object.keys(CONTEXTS).find(k => CONTEXTS[k].label.toLowerCase() === ctxLower);
      if (exact) return exact;
      // 2. Partial context label match
      const partial = Object.keys(CONTEXTS).find(
        k => CONTEXTS[k].label.toLowerCase().includes(ctxLower) || ctxLower.includes(CONTEXTS[k].label.toLowerCase())
      );
      if (partial) return partial;
    }
    // 3. First context in the suggested domain
    if (domLower) {
      const domainKey = Object.keys(DOMAIN_MAP).find(
        k => DOMAIN_MAP[k].label.toLowerCase() === domLower || k === domLower
      );
      if (domainKey) {
        const firstInDomain = Object.keys(CONTEXTS).find(k => CONTEXTS[k].domain === domainKey);
        if (firstInDomain) return firstInDomain;
      }
    }
    return null;
  };

  const run = async () => {
    if (!task.trim() || isRouting) return;
    // Capture the task text at run-time so async callbacks always have the correct value
    const capturedTask = task.trim();
    setFrozenTask(capturedTask);
    setIsRouting(true);
    setRoutingAnalysis(null);
    setAutoSwitchBanner(null);
    setAssemblyPhase("scanning");
    setAssembledAgents([]);

    // Animate mesh nodes while routing
    const nodeIds = meshNodes.map(n => n.id);
    nodeIds.forEach((id, i) => setTimeout(() => setRoutedNodes(r => [...r, id]), i * 200));

    try {
      const allDomains = Object.values(DOMAIN_MAP).map(d => d.label);

      // Step 1: Analyse prompt against current context (ctx may be null if no context selected yet)
      const activeCtx = ctx ?? CONTEXTS[Object.keys(CONTEXTS)[0]];
      const analysis = await routeAgentsMutation.mutateAsync({
        taskText: task,
        contextLabel: activeCtx.label,
        domainLabel: DOMAIN_MAP[activeCtx.domain]?.label ?? activeCtx.domain,
        agentLabels: agentList.map(a => a.label),
        allDomains,
      });

      // Step 2: Handle domain mismatch
      if (!analysis.domainMatch && (analysis.suggestedDomain || analysis.suggestedContext)) {
        const bestKey = findBestContextKey(analysis.suggestedDomain, analysis.suggestedContext);
        if (bestKey && bestKey !== role) {
          // If user manually selected a context (role !== null), pause and ask
          // If no context was selected (role === null), auto-switch silently
          if (role !== null) {
            // User explicitly chose a context — show choice dialog
            setAssemblyPhase("idle");
            setIsRouting(false);
            setRoutedNodes([]);
            setMismatchPending({
              suggestedKey: bestKey,
              suggestedDomain: DOMAIN_MAP[CONTEXTS[bestKey].domain]?.label ?? CONTEXTS[bestKey].domain,
              suggestedContext: CONTEXTS[bestKey].label,
              capturedTask,
            });
            return;
          }
          const newCtx = CONTEXTS[bestKey];
          const fromLabel = activeCtx.label;
          // Switch context state — suppress the role-change effect's task reset
          suppressTaskResetRef.current = true;
          setRole(bestKey);
          localStorage.setItem("mesh_role", bestKey);
          setExpandedDomains(prev => ({ ...prev, [newCtx.domain]: true }));
          const newAgentList = newCtx.agents.map((label, i) => ({ id: "a" + i, label, spawned: false }));
          setAgentList(newAgentList);
          // Show auto-switch banner
          setAutoSwitchBanner({
            from: fromLabel,
            to: DOMAIN_MAP[newCtx.domain]?.label ?? newCtx.domain,
            toContext: newCtx.label,
          });
          setTimeout(() => setAutoSwitchBanner(null), 6000);
          // Step 3: Re-run routing against the new context
          const reAnalysis = await routeAgentsMutation.mutateAsync({
            taskText: task,
            contextLabel: newCtx.label,
            domainLabel: DOMAIN_MAP[newCtx.domain]?.label ?? newCtx.domain,
            agentLabels: newAgentList.map(a => a.label),
            allDomains,
          });
          setRoutingAnalysis({ ...reAnalysis, domainMatch: true });
          const relevantSet = new Set(reAnalysis.relevantAgents);
          const filteredAgents = newAgentList.filter(a => relevantSet.has(a.label));
          setCurrentAgents(filteredAgents.length > 0 ? filteredAgents : [...newAgentList]);
          // Run assembly animation for the new agents
          setAssemblyPhase("assembling");
          const agentsToReveal = filteredAgents.length > 0 ? filteredAgents : newAgentList;
          agentsToReveal.forEach((ag, i) => {
            setTimeout(() => setAssembledAgents(prev => [...prev, ag.label]), i * 180);
          });
          const assemblyDuration = agentsToReveal.length * 180 + 600;
          setTimeout(() => {
            suppressTaskResetRef.current = false;
            // Restore the captured task text in case the role-change effect cleared it
            setTask(capturedTask);
            setAssemblyPhase("executing");
            setShowOutput(true);
            setRoutedNodes([]);
            setIsRouting(false);
          }, assemblyDuration);
          return;
        }
      }

      // Normal path: domain matches, run relevant agents
      setRoutingAnalysis(analysis);
      const relevantSet = new Set(analysis.relevantAgents);
      const filteredAgents = agentList.filter(a => relevantSet.has(a.label));
      const agentsToRun = filteredAgents.length > 0 ? filteredAgents : [...agentList];
      setCurrentAgents(agentsToRun);
      // Run assembly animation
      setAssemblyPhase("assembling");
      agentsToRun.forEach((ag, i) => {
        setTimeout(() => setAssembledAgents(prev => [...prev, ag.label]), i * 180);
      });
      const assemblyDuration = agentsToRun.length * 180 + 600;
      setTimeout(() => {
        setAssemblyPhase("executing");
        setShowOutput(true);
        setRoutedNodes([]);
        setIsRouting(false);
      }, assemblyDuration);
      return;
    } catch {
      // On routing failure, run all agents
      suppressTaskResetRef.current = false;
      setCurrentAgents([...agentList]);
      setAssemblyPhase("idle");
    }

    setTimeout(() => { setShowOutput(true); setRoutedNodes([]); setIsRouting(false); }, 1200);
  };

  // Called when user clicks "Switch & Run" or "Run Anyway" from the mismatch dialog
  const resolveWithContext = async (useKey: string | null) => {
    if (!mismatchPending) return;
    const { capturedTask, suggestedKey } = mismatchPending;
    setMismatchPending(null);
    setFrozenTask(capturedTask);
    setIsRouting(true);
    setRoutingAnalysis(null);
    setAssemblyPhase("scanning");
    setAssembledAgents([]);
    const targetKey = useKey ?? suggestedKey;
    const targetCtx = CONTEXTS[targetKey];
    suppressTaskResetRef.current = true;
    setRole(targetKey);
    localStorage.setItem("mesh_role", targetKey);
    setExpandedDomains(prev => ({ ...prev, [targetCtx.domain]: true }));
    const newAgentList = targetCtx.agents.map((label: string, i: number) => ({ id: "a" + i, label, spawned: false }));
    setAgentList(newAgentList);
    const allDomains = Object.values(DOMAIN_MAP).map(d => d.label);
    try {
      const reAnalysis = await routeAgentsMutation.mutateAsync({
        taskText: capturedTask,
        contextLabel: targetCtx.label,
        domainLabel: DOMAIN_MAP[targetCtx.domain]?.label ?? targetCtx.domain,
        agentLabels: newAgentList.map((a: AgentNode) => a.label),
        allDomains,
      });
      setRoutingAnalysis({ ...reAnalysis, domainMatch: true });
      const relevantSet = new Set(reAnalysis.relevantAgents);
      const filtered = newAgentList.filter((a: AgentNode) => relevantSet.has(a.label));
      const agentsToRun = filtered.length > 0 ? filtered : [...newAgentList];
      setCurrentAgents(agentsToRun);
      setAssemblyPhase("assembling");
      agentsToRun.forEach((ag: AgentNode, i: number) => {
        setTimeout(() => setAssembledAgents(prev => [...prev, ag.label]), i * 180);
      });
      const dur = agentsToRun.length * 180 + 600;
      setTimeout(() => {
        suppressTaskResetRef.current = false;
        setTask(capturedTask);
        setAssemblyPhase("executing");
        setShowOutput(true);
        setRoutedNodes([]);
        setIsRouting(false);
      }, dur);
    } catch {
      suppressTaskResetRef.current = false;
      setCurrentAgents([...newAgentList]);
      setAssemblyPhase("idle");
      setTimeout(() => { setShowOutput(true); setRoutedNodes([]); setIsRouting(false); }, 800);
    }
  };

  const handleOutputDone = (outputs: OutputMap) => {
    const activeCtxLabel = ctx?.label ?? "Auto-detected";
    saveHistory.mutate({
      task: frozenTask || task,
      contextKey: role ?? "auto",
      contextLabel: activeCtxLabel,
      agentCount: currentAgents.length,
      outputs: JSON.stringify(outputs),
    });
  };

  // Boot screen
  if (booting) {
    return (
      <div style={{ minHeight: "100vh", background: "#0B1629", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 24 }}><Logo size={34} inverted /></div>
          {bootMsgs.slice(0, bootStep + 1).map((msg, i) => (
            <div key={i} style={{ fontSize: 11, color: i === bootStep ? "#7BA3D4" : "#637080", marginBottom: 6, transition: "color 0.3s" }}>{msg}</div>
          ))}
        </div>
      </div>
    );
  }


  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0B1629", fontFamily: "'Inter', sans-serif", overflow: "hidden" }}>

      {/* ── Slim top bar ── */}
      <header style={{ height: 48, display: "flex", alignItems: "center", padding: isMobile ? "0 12px" : "0 20px", borderBottom: "1px solid #1C3057", background: "#0F1E38", gap: isMobile ? 8 : 12, flexShrink: 0, minWidth: 0 }}>
        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setMobileSidebarOpen(o => !o)}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #1C3057", background: "rgba(123,163,212,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#8494AA", fontSize: 16, flexShrink: 0 }}
            aria-label="Toggle sidebar"
          >☰</button>
        )}
        <Logo size={24} />
        {/* Active context badge — hidden on mobile when no context, truncated when context active */}
        {ctx ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "rgba(123,163,212,0.08)", border: "1px solid rgba(123,163,212,0.2)", borderRadius: 20, minWidth: 0, overflow: "hidden" }}>
            <span style={{ fontSize: 12, flexShrink: 0 }}>{ctx.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#E8ECF2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ctx.label}</span>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", display: "inline-block", flexShrink: 0 }} />
          </div>
        ) : (
          !isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "rgba(123,163,212,0.05)", border: "1px dashed rgba(123,163,212,0.2)", borderRadius: 20 }}>
              <span style={{ fontSize: 11, color: "#637080" }}>No context selected — type a prompt to auto-detect</span>
            </div>
          )
        )}
        {spawnedCount > 0 && (
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>⚡ {spawnedCount}</span>
        )}
        <div style={{ flex: 1 }} />
        {!isMobile && <span style={{ fontSize: 12, color: "#8494AA" }}>{user?.name || user?.email || "User"}</span>}
        <button onClick={logout} style={{ fontSize: 11, color: "#637080", background: "none", border: "1px solid #1C3057", borderRadius: 6, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}>{isMobile ? "↩" : "Sign out"}</button>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* Mobile sidebar backdrop */}
        {isMobile && mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              zIndex: 100, backdropFilter: "blur(2px)",
            }}
          />
        )}

        {/* ── LEFT SIDEBAR: Domain navigation ── */}
        <aside style={{
          width: isMobile ? 260 : (sidebarCollapsed ? 52 : 220),
          borderRight: "1px solid #1C3057",
          background: "#0A1628",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflowY: isMobile ? "auto" : (sidebarCollapsed ? "hidden" : "auto"),
          transition: isMobile ? "transform 0.28s cubic-bezier(0.4,0,0.2,1)" : "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          overflow: isMobile ? "auto" : "hidden",
          // Mobile: slide in/out as overlay
          ...(isMobile ? {
            position: "fixed",
            top: 48,
            left: 0,
            bottom: 0,
            zIndex: 110,
            transform: mobileSidebarOpen ? "translateX(0)" : "translateX(-100%)",
            boxShadow: mobileSidebarOpen ? "4px 0 24px rgba(0,0,0,0.5)" : "none",
          } : {}),
        }}>

          {/* Sidebar header + collapse toggle */}
          <div style={{ padding: "12px 10px 8px", display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", flexShrink: 0 }}>
            {!sidebarCollapsed && (
              <div style={{ fontSize: 9, color: "#4A5568", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>Workspace</div>
            )}
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                width: 28, height: 28, borderRadius: 8, border: "1px solid #1C3057",
                background: "rgba(123,163,212,0.06)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#637080", fontSize: 12, flexShrink: 0,
                transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(123,163,212,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#7BA3D4"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(123,163,212,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "#637080"; }}
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
          </div>

          {/* Home / History / Settings nav */}
          <div style={{ padding: "0 8px 8px", flexShrink: 0 }}>
            {[
              { key: "home",     label: "Dashboard",    icon: "▣" },
              { key: "history",  label: "Task History",  icon: "≡" },
              { key: "settings", label: "Settings",      icon: "⚙" },
            ].map(n => (
              <button key={n.key}
                onClick={() => { setActiveNav(n.key as typeof activeNav); setShowOutput(false); }}
                title={sidebarCollapsed ? n.label : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: sidebarCollapsed ? "9px 0" : "8px 10px",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  border: "none", borderRadius: 8,
                  background: activeNav === n.key ? "rgba(123,163,212,0.1)" : "none",
                  cursor: "pointer", textAlign: "left",
                  borderLeft: sidebarCollapsed ? "none" : (activeNav === n.key ? "2px solid #7BA3D4" : "2px solid transparent"),
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 14, color: activeNav === n.key ? "#7BA3D4" : "#4A5568", flexShrink: 0 }}>{n.icon}</span>
                {!sidebarCollapsed && <span style={{ fontSize: 12, fontWeight: activeNav === n.key ? 700 : 500, color: activeNav === n.key ? "#E8ECF2" : "#8494AA", whiteSpace: "nowrap" }}>{n.label}</span>}
              </button>
            ))}
          </div>

          {/* Divider */}
          {!sidebarCollapsed && <div style={{ height: 1, background: "#1C3057", margin: "4px 16px 8px", flexShrink: 0 }} />}

          {/* Domain sections — hidden when collapsed, show domain icons only */}
          <div style={{ padding: sidebarCollapsed ? "0 8px" : "0 10px", flex: 1, overflowY: sidebarCollapsed ? "hidden" : "auto" }}>
            {sidebarCollapsed ? (
              /* Icon-only domain dots when collapsed */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingTop: 4 }}>
                {Object.entries(DOMAIN_MAP).map(([domainKey, domain]) => {
                  const domainColor = DOMAIN_COLORS[domainKey] || "#7BA3D4";
                  const hasActive = role ? CONTEXTS[role]?.domain === domainKey : false;
                  return (
                    <button
                      key={domainKey}
                      title={domain.label}
                      onClick={() => { setSidebarCollapsed(false); setExpandedDomains(prev => ({ ...prev, [domainKey]: true })); }}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: hasActive ? `1px solid ${domainColor}40` : "1px solid #1C3057",
                        background: hasActive ? `${domainColor}15` : "rgba(255,255,255,0.03)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                      }}
                    >
                      {domain.icon}
                    </button>
                  );
                })}
              </div>
            ) : (
            <>
            <div style={{ fontSize: 9, color: "#4A5568", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, marginBottom: 8, paddingLeft: 10 }}>Domains</div>
            {Object.entries(DOMAIN_MAP).map(([domainKey, domain]) => {
              const domainContexts = Object.entries(CONTEXTS).filter(([, c]) => c.domain === domainKey);
              const isExpanded = expandedDomains[domainKey];
              const domainColor = DOMAIN_COLORS[domainKey] || "#7BA3D4";
              const hasActive = role ? CONTEXTS[role]?.domain === domainKey : false;
              return (
                <div key={domainKey} style={{ marginBottom: 4 }}>
                  {/* Domain header */}
                  <button
                    onClick={() => toggleDomain(domainKey)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "7px 10px", border: "none", borderRadius: 8,
                      background: hasActive ? `rgba(${domainColor === "#7BA3D4" ? "123,163,212" : domainColor === "#9B7FD4" ? "155,127,212" : domainColor === "#4ADE80" ? "74,222,128" : domainColor === "#38BDF8" ? "56,189,248" : "201,168,76"},0.08)` : "none",
                      cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{domain.icon}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: hasActive ? "#E8ECF2" : "#8494AA" }}>{domain.label}</span>
                    <span style={{ fontSize: 9, color: "#4A5568", transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  </button>
                  {/* Context items */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 8, marginTop: 2 }}>
                      {domainContexts.map(([ctxKey, ctxItem]) => (
                        <button
                          key={ctxKey}
                          onClick={() => { setRole(ctxKey); setActiveNav("home"); setShowOutput(false); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, width: "100%",
                            padding: "6px 10px", border: "none", borderRadius: 8,
                            background: role === ctxKey ? `rgba(${domainColor === "#7BA3D4" ? "123,163,212" : domainColor === "#9B7FD4" ? "155,127,212" : domainColor === "#4ADE80" ? "74,222,128" : domainColor === "#38BDF8" ? "56,189,248" : "201,168,76"},0.12)` : "none",
                            cursor: "pointer", textAlign: "left",
                            borderLeft: role === ctxKey ? `2px solid ${domainColor}` : "2px solid transparent",
                            marginBottom: 1,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: role === ctxKey ? domainColor : "#1C3057", display: "inline-block", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: role === ctxKey ? 700 : 400, color: role === ctxKey ? "#E8ECF2" : "#637080" }}>{ctxItem.label}</span>
                          {role === ctxKey && <span style={{ marginLeft: "auto", fontSize: 9, color: domainColor }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            </>
            )}
          </div>

          {/* Annotation Studio link */}
          <div style={{ padding: "8px 10px 12px", flexShrink: 0 }}>
            <div style={{ height: 1, background: "#1C3057", marginBottom: 8 }} />
            <a href="/annotate" style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
              background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)",
              borderRadius: 8, textDecoration: "none",
            }}>
              <span style={{ fontSize: 14, color: "#F59E0B", flexShrink: 0 }}>ع</span>
              {!sidebarCollapsed && (
                <>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#C9A84C" }}>Arabic Labeling</div>
                    <div style={{ fontSize: 9, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>Annotation Studio</div>
                  </div>
                  <span style={{ fontSize: 10, color: "#F59E0B" }}>→</span>
                </>
              )}
            </a>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeNav === "history" ? (
            <HistoryPanel onClose={() => setActiveNav("home")} />
          ) : activeNav === "settings" ? (
            <SettingsPanel onClose={() => setActiveNav("home")} />
          ) : showOutput ? (
            <OutputPanel
              agents={currentAgents}
              taskText={frozenTask || task}
              ctx={ctx ?? CONTEXTS[Object.keys(CONTEXTS)[0]]}
              vaultText={vaultText}
              activeDocId={activeVaultDocId}
              onBack={() => setShowOutput(false)}
              onDone={handleOutputDone}
            />
          ) : (
            <div style={{ flex: 1, overflow: isMobile ? "auto" : "hidden", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 260px" }}>

              {/* ── CENTER ── */}
              <div style={{ overflowY: isMobile ? "visible" : "auto", padding: isMobile ? "16px 14px 80px" : "28px 28px 28px", display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18, background: "#0B1629" }}>

                {/* Greeting */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: isMobile ? 20 : 24, color: "#E8ECF2", letterSpacing: "-0.03em", marginBottom: 4 }}>
                      Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {(user?.name || "").split(" ")[0] || "there"}.
                    </h1>
                    <div style={{ fontSize: 12, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>
                      {ctx ? (
                        <><span style={{ color: ctx.color, fontWeight: 600 }}>{ctx.label}</span> · {agentList.length} agents ready</>
                      ) : (
                        <span style={{ color: "#637080" }}>Type a prompt — the system will select the right agents</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 8, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#A8B4C8", flexShrink: 0 }}>
                    <span style={{ color: "#22C55E", fontWeight: 700 }}>●</span> Mesh Online
                  </div>
                </div>

                {/* Metrics row — inline 4-col grid above task box */}
                <CenterMetrics />

                {/* ── Agent Discovery Overlay ── shown during scanning + assembling phases */}
                {(assemblyPhase === "scanning" || assemblyPhase === "assembling") && (
                  <div style={{
                    background: "#0F1E38",
                    border: `1px solid ${assemblyPhase === "assembling" ? "rgba(123,163,212,0.4)" : "rgba(123,163,212,0.2)"}`,
                    borderRadius: 16,
                    padding: "24px 28px",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                    position: "relative",
                    overflow: "hidden",
                    animation: "slide-up-fade-in 0.4s ease-out",
                  }}>
                    {/* Radar rings */}
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
                      {[0, 0.4, 0.8].map(delay => (
                        <div key={delay} style={{
                          position: "absolute",
                          width: 120, height: 120,
                          borderRadius: "50%",
                          border: "1px solid rgba(123,163,212,0.25)",
                          top: "50%", left: "50%",
                          transform: "translate(-50%,-50%)",
                          animation: "radar-sweep 2s ease-out infinite",
                          animationDelay: `${delay}s`,
                        }} />
                      ))}
                    </div>
                    {/* Content */}
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: assemblyPhase === "scanning" ? "#7BA3D4" : "#4ADE80",
                          display: "inline-block",
                          animation: assemblyPhase === "scanning" ? "pulse 0.8s ease-in-out infinite" : "none",
                          boxShadow: assemblyPhase === "scanning" ? "0 0 0 3px rgba(123,163,212,0.2)" : "0 0 0 3px rgba(74,222,128,0.2)",
                        }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: assemblyPhase === "scanning" ? "#7BA3D4" : "#4ADE80", fontFamily: "'Inter', sans-serif" }}>
                          {assemblyPhase === "scanning" ? "Analysing prompt…" : `Assembling ${assembledAgents.length} of ${currentAgents.length} agents`}
                        </span>
                      </div>
                      {/* Assembling: show agent names as they appear */}
                      {assemblyPhase === "assembling" && assembledAgents.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {assembledAgents.map((label, i) => (
                            <span key={label} style={{
                              fontSize: 10, padding: "3px 10px", borderRadius: 999,
                              background: "rgba(123,163,212,0.1)",
                              border: "1px solid rgba(123,163,212,0.3)",
                              color: "#7BA3D4",
                              fontFamily: "'JetBrains Mono', monospace",
                              animation: "agent-card-in 0.3s cubic-bezier(0.22,1,0.36,1) both",
                              animationDelay: `${i * 0.05}s`,
                            }}>
                              ⚡ {label}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Scanning: shimmer lines */}
                      {assemblyPhase === "scanning" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {["100%", "75%", "88%", "60%"].map((w, i) => (
                            <div key={i} style={{
                              height: 8, width: w, borderRadius: 4,
                              background: "linear-gradient(90deg, rgba(28,48,87,0.8) 0%, rgba(123,163,212,0.18) 50%, rgba(28,48,87,0.8) 100%)",
                              backgroundSize: "200% 100%",
                              animation: "shimmer 1.2s ease-in-out infinite",
                              animationDelay: `${i * 0.2}s`,
                            }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mismatch Choice Dialog — shown when user manually selected a context that doesn't match the prompt */}
                {mismatchPending && (
                  <div style={{
                    background: "#0F1E38",
                    border: "1px solid rgba(201,168,76,0.4)",
                    borderRadius: 16,
                    padding: "20px 24px",
                    boxShadow: "0 4px 24px rgba(201,168,76,0.08)",
                    animation: "slide-up-fade-in 0.35s ease-out",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>⚠</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>
                          Context mismatch detected
                        </div>
                        <div style={{ fontSize: 12, color: "#A8B4C8", lineHeight: 1.6, marginBottom: 14, fontFamily: "'Inter', sans-serif" }}>
                          Your prompt looks like a <strong style={{ color: "#E8ECF2" }}>{mismatchPending.suggestedDomain} → {mismatchPending.suggestedContext}</strong> task,
                          but you have <strong style={{ color: "#E8ECF2" }}>{ctx?.label ?? "no context"}</strong> selected.
                          Would you like to switch to the right context, or run anyway?
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            onClick={() => resolveWithContext(mismatchPending.suggestedKey)}
                            style={{
                              background: "linear-gradient(135deg, #7BA3D4 0%, #4A7DB5 100%)",
                              color: "#0B1629", border: "none", borderRadius: 8,
                              padding: "9px 18px", fontSize: 12, fontWeight: 800,
                              cursor: "pointer", fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            ↻ Switch to {mismatchPending.suggestedContext} &amp; Run
                          </button>
                          <button
                            onClick={() => {
                              const pending = mismatchPending;
                              setMismatchPending(null);
                              // Run with current context — re-use the captured task
                              setTask(pending.capturedTask);
                              setTimeout(() => run(), 50);
                            }}
                            style={{
                              background: "transparent", color: "#8494AA",
                              border: "1px solid #1C3057", borderRadius: 8,
                              padding: "9px 18px", fontSize: 12, fontWeight: 600,
                              cursor: "pointer", fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            Run Anyway
                          </button>
                          <button
                            onClick={() => setMismatchPending(null)}
                            style={{
                              background: "transparent", color: "#637080",
                              border: "none", borderRadius: 8,
                              padding: "9px 14px", fontSize: 12,
                              cursor: "pointer", fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task Command Center */}
                <div style={{ background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
                  <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid #152542", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "#637080", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>Task Command Center</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      {["PDF", "DOCX", "CSV", "XLSX"].map(f => (
                        <span key={f} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 5, background: "#152542", color: "#637080", fontFamily: "'JetBrains Mono', monospace", border: "1px solid #1C3057" }}>{f}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: "16px 18px" }}>
                    <textarea
                      value={task}
                      onChange={e => setTask(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
                      placeholder={dynamicPlaceholder}
                      rows={4}
                      style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 14, color: "#E8ECF2", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7, background: "transparent", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #152542", gap: 8, flexWrap: "wrap" }}>
                      {/* Left side: keyboard hint on desktop, attach button on mobile */}
                      {isMobile ? (
                        <button
                          onClick={() => setMobileAgentPanelOpen(true)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: vaultText ? "rgba(74,222,128,0.1)" : "rgba(123,163,212,0.08)",
                            border: vaultText ? "1px solid rgba(74,222,128,0.3)" : "1px solid #1C3057",
                            borderRadius: 8, padding: "8px 12px", cursor: "pointer",
                            fontSize: 12, color: vaultText ? "#4ADE80" : "#8494AA",
                            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                          }}
                          aria-label="Upload document"
                        >
                          <span style={{ fontSize: 14 }}>{vaultText ? "📎" : "📎"}</span>
                          {vaultText ? "Doc attached" : "Attach doc"}
                        </button>
                      ) : (
                        <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "'JetBrains Mono', monospace" }}>⌘ + Enter to execute</div>
                      )}
                      <button
                        onClick={run}
                        disabled={!task.trim() || isRouting}
                        style={{
                          background: isRouting ? "#152542" : task.trim() ? "linear-gradient(135deg, #7BA3D4 0%, #4A7DB5 100%)" : "#152542",
                          color: isRouting ? "#7BA3D4" : task.trim() ? "#0B1629" : "#637080",
                          border: isRouting ? "1px solid rgba(123,163,212,0.3)" : "none",
                          borderRadius: 10, padding: "10px 24px",
                          cursor: (task.trim() && !isRouting) ? "pointer" : "not-allowed",
                          fontSize: 13, fontFamily: "'Inter', sans-serif", fontWeight: 800,
                          transition: "all 0.15s", letterSpacing: "-0.01em",
                          flexShrink: 0,
                        }}
                      >
                        {isRouting ? "⟳ Routing…" : "▶ Execute via Mesh"}
                      </button>
                    </div>
                  </div>
                  {/* Vault context indicator */}
                  {vaultText && (
                    <div style={{ padding: "0 18px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8 }}>
                        <span style={{ color: "#4ADE80", fontSize: 11 }}>📎</span>
                        <span style={{ fontSize: 10, color: "#4ADE80", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>Document context active — agents will analyse your uploaded file</span>
                        <button onClick={() => { setVaultText(""); setActiveVaultDocId(null); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#637080", fontSize: 13, lineHeight: 1 }}>×</button>
                      </div>
                    </div>
                  )}
                  {/* Auto-switch banner — shown when context was changed automatically */}
                  {autoSwitchBanner && (
                    <div style={{ padding: "0 18px 8px" }}>
                      <div style={{ padding: "10px 14px", background: "rgba(123,163,212,0.08)", border: "1px solid rgba(123,163,212,0.35)", borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>🔀</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#7BA3D4", fontFamily: "'Inter', sans-serif", fontWeight: 700, marginBottom: 3 }}>
                            Context switched automatically
                          </div>
                          <div style={{ fontSize: 10, color: "#A8B4C8", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                            Your prompt doesn't match <strong style={{ color: "#637080" }}>{autoSwitchBanner.from}</strong>. Switched to{" "}
                            <strong style={{ color: "#7BA3D4" }}>{autoSwitchBanner.to} → {autoSwitchBanner.toContext}</strong> and loaded the right agents.
                          </div>
                        </div>
                        <button
                          onClick={() => setAutoSwitchBanner(null)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#637080", fontSize: 14, lineHeight: 1, flexShrink: 0, padding: 0 }}
                        >×</button>
                      </div>
                    </div>
                  )}
                  {/* Routing state indicator */}
                  {isRouting && (
                    <div style={{ padding: "0 18px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(123,163,212,0.06)", border: "1px solid rgba(123,163,212,0.2)", borderRadius: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7BA3D4", display: "inline-block", animation: "pulse 1s infinite" }} />
                        <span style={{ fontSize: 10, color: "#7BA3D4", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>Analysing task — routing to relevant agents…</span>
                      </div>
                    </div>
                  )}
                  {/* Routing summary — shown when analysis is done */}
                  {routingAnalysis && routingAnalysis.domainMatch && routingAnalysis.irrelevantAgents.length > 0 && (
                    <div style={{ padding: "0 18px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 8 }}>
                        <span style={{ color: "#4ADE80", fontSize: 11 }}>✓</span>
                        <span style={{ fontSize: 10, color: "#4ADE80", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          Routed to {routingAnalysis.relevantAgents.length} of {routingAnalysis.relevantAgents.length + routingAnalysis.irrelevantAgents.length} agents — {routingAnalysis.irrelevantAgents.length} skipped as not relevant
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Quick task chips — only shown when a context is selected */}
                  <div style={{ padding: "0 18px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(ctx?.quickTasks ?? []).map((qt: string) => (
                      <button key={qt} onClick={() => setTask(qt)} style={{
                        padding: "5px 12px", background: "#152542",
                        border: "1px solid #1C3057", borderRadius: 20,
                        cursor: "pointer", fontSize: 11, color: "#8494AA",
                        fontFamily: "'Inter', sans-serif", fontWeight: 500,
                      }}>
                        {qt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent Tasks */}
                <RecentTasksPanel onRerun={(t: string) => setTask(t)} />

              </div>

              {/* Mobile: Floating button to open agent panel */}
              {isMobile && (
                <button
                  onClick={() => setMobileAgentPanelOpen(o => !o)}
                  style={{
                    position: "fixed", bottom: 20, right: 20, zIndex: 120,
                    width: 52, height: 52, borderRadius: "50%",
                    background: "linear-gradient(135deg, #7BA3D4 0%, #4A7DB5 100%)",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 20px rgba(123,163,212,0.4)",
                    fontSize: 20, color: "#0B1629",
                  }}
                  aria-label="Toggle agent panel"
                >
                  {mobileAgentPanelOpen ? "×" : "⚡"}
                </button>
              )}

              {/* Mobile: Agent panel as bottom sheet */}
              {isMobile && mobileAgentPanelOpen && (
                <>
                  <div
                    onClick={() => setMobileAgentPanelOpen(false)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 115 }}
                  />
                  <div style={{
                    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 120,
                    background: "#0A1628", borderTop: "1px solid #1C3057",
                    borderRadius: "20px 20px 0 0",
                    maxHeight: "70vh", overflowY: "auto",
                    boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
                    paddingBottom: 32,
                  }}>
                    {/* Handle */}
                    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
                      <div style={{ width: 40, height: 4, borderRadius: 2, background: "#1C3057" }} />
                    </div>
                    {/* Agents card */}
                    <div style={{ margin: "0 14px 12px", background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #152542" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 2px rgba(34,197,94,0.2)" }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#E8ECF2" }}>Agents</span>
                        </div>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(123,163,212,0.1)", color: "#7BA3D4", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{agentList.length} ready</span>
                      </div>
                      <div style={{ padding: "8px 0", maxHeight: 240, overflowY: "auto" }}>
                        {agentList.map((ag, idx) => (
                          <div key={ag.id} style={{ display: "flex", alignItems: "center", padding: "7px 14px", borderBottom: idx < agentList.length - 1 ? "1px solid rgba(28,48,87,0.5)" : "none" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: ag.spawned ? "#C9A84C" : (ctx?.color ?? "#7BA3D4"), display: "inline-block", flexShrink: 0, marginRight: 10 }} />
                            <span style={{ flex: 1, fontSize: 12, color: ag.spawned ? "#C9A84C" : "#A8B4C8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ag.label}</span>
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 999, background: "rgba(168,180,200,0.08)", color: "#637080", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, border: "1px solid rgba(28,48,87,0.8)" }}>{ag.spawned ? "⚡ active" : "standby"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Document Vault */}
                    <div style={{ margin: "0 14px 16px", background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ padding: "12px 14px", borderBottom: "1px solid #152542" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#E8ECF2" }}>Document Vault</span>
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        <DocumentVault
                          onVaultTextChange={setVaultText}
                          activeDocId={activeVaultDocId}
                          onActiveDocChange={setActiveVaultDocId}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── RIGHT PANEL (desktop only) ── */}
              {!isMobile && <div style={{ borderLeft: "1px solid #1C3057", background: "#0A1628", overflowY: "auto", display: "flex", flexDirection: "column", paddingTop: 14 }}>

                {/* ── Agents card ── */}
                <div style={{ margin: "0 14px 12px", background: "#0F1E38", border: `1px solid ${assemblyPhase === "assembling" ? "rgba(123,163,212,0.5)" : "#1C3057"}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.4s", boxShadow: assemblyPhase === "assembling" ? "0 0 18px rgba(123,163,212,0.12)" : "none" }}>
                  {/* Card header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #152542" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Status dot: green=idle/executing, blue-pulse=scanning/assembling */}
                      <span style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: assemblyPhase === "scanning" || assemblyPhase === "assembling" ? "#7BA3D4" : "#22C55E",
                        display: "inline-block",
                        boxShadow: assemblyPhase === "scanning" || assemblyPhase === "assembling" ? "0 0 0 2px rgba(123,163,212,0.25)" : "0 0 0 2px rgba(34,197,94,0.2)",
                        animation: assemblyPhase === "scanning" ? "pulse 0.9s ease-in-out infinite" : "none",
                      }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#E8ECF2" }}>Agents</span>
                    </div>
                    {/* Header badge: changes per phase */}
                    {assemblyPhase === "scanning" && (
                      <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: "rgba(123,163,212,0.1)", color: "#7BA3D4", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, animation: "pulse 1.2s ease-in-out infinite" }}>Scanning…</span>
                    )}
                    {assemblyPhase === "assembling" && (
                      <span key={assembledAgents.length} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: "rgba(74,222,128,0.1)", color: "#4ADE80", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, animation: "counter-tick 0.25s ease-out" }}>
                        {assembledAgents.length} / {currentAgents.length > 0 ? currentAgents.length : agentList.length} assembled
                      </span>
                    )}
                    {(assemblyPhase === "idle" || assemblyPhase === "executing") && (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(123,163,212,0.1)", color: "#7BA3D4", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{agentList.length} ready</span>
                    )}
                  </div>

                  {/* Scanning phase: show shimmer placeholder rows */}
                  {assemblyPhase === "scanning" && (
                    <div style={{ padding: "10px 14px" }}>
                      {[...Array(5)].map((_, i) => (
                        <div key={i} style={{
                          height: 28, borderRadius: 6, marginBottom: 6,
                          background: "linear-gradient(90deg, rgba(28,48,87,0.6) 0%, rgba(123,163,212,0.12) 50%, rgba(28,48,87,0.6) 100%)",
                          backgroundSize: "200% 100%",
                          animation: `shimmer 1.4s ease-in-out infinite`,
                          animationDelay: `${i * 0.15}s`,
                          opacity: 1 - i * 0.12,
                        }} />
                      ))}
                      <div style={{ fontSize: 9, color: "#4A5568", fontFamily: "'JetBrains Mono', monospace", textAlign: "center", paddingTop: 4 }}>Identifying relevant agents…</div>
                    </div>
                  )}

                  {/* Assembling + executing: show actual agent rows with staggered animation */}
                  {(assemblyPhase === "assembling" || assemblyPhase === "executing" || assemblyPhase === "idle") && (
                    <div style={{ padding: "8px 0", maxHeight: 260, overflowY: "auto" }}>
                      {agentList.map((ag, idx) => {
                        const isSkipped = routingAnalysis && routingAnalysis.irrelevantAgents.includes(ag.label);
                        const isRouted = routingAnalysis && routingAnalysis.relevantAgents.includes(ag.label);
                        const isAssembled = assembledAgents.includes(ag.label);
                        // During assembling: hide agents not yet revealed
                        const isVisible = assemblyPhase === "idle" || assemblyPhase === "executing" || isAssembled;
                        if (!isVisible) return null;
                        const dotColor = isSkipped ? "#4A5568" : ag.spawned ? "#C9A84C" : isRouted ? "#4ADE80" : isAssembled && assemblyPhase === "assembling" ? "#7BA3D4" : (ctx?.color ?? "#7BA3D4");
                        return (
                          <div key={ag.id} style={{
                            display: "flex", alignItems: "center", padding: "7px 14px",
                            background: ag.spawned ? "rgba(201,168,76,0.04)" : isAssembled && assemblyPhase === "assembling" ? "rgba(123,163,212,0.04)" : "transparent",
                            borderBottom: idx < agentList.length - 1 ? "1px solid rgba(28,48,87,0.5)" : "none",
                            opacity: isSkipped ? 0.35 : 1,
                            animation: isAssembled && assemblyPhase === "assembling" ? "agent-card-in 0.35s cubic-bezier(0.22,1,0.36,1) both" : "none",
                            transition: "opacity 0.4s, background 0.3s",
                          }}>
                            <span style={{
                              width: 6, height: 6, borderRadius: "50%",
                              background: dotColor,
                              display: "inline-block", flexShrink: 0, marginRight: 10,
                              animation: isAssembled && assemblyPhase === "assembling" ? "node-ripple 0.6s ease-out" : "none",
                            }} />
                            <span style={{ flex: 1, fontSize: 12, color: isSkipped ? "#4A5568" : ag.spawned ? "#C9A84C" : isAssembled && assemblyPhase === "assembling" ? "#7BA3D4" : "#A8B4C8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.5s" }}>{ag.label}</span>
                            <span style={{
                              fontSize: 9, padding: "2px 7px", borderRadius: 999, fontFamily: "'JetBrains Mono', monospace",
                              background: isSkipped ? "rgba(74,85,104,0.1)" : isRouted ? "rgba(74,222,128,0.1)" : isAssembled && assemblyPhase === "assembling" ? "rgba(123,163,212,0.12)" : ag.spawned ? "rgba(201,168,76,0.12)" : "rgba(168,180,200,0.06)",
                              color: isSkipped ? "#4A5568" : isRouted ? "#4ADE80" : isAssembled && assemblyPhase === "assembling" ? "#7BA3D4" : ag.spawned ? "#C9A84C" : "#4A5568",
                              border: isSkipped ? "1px solid rgba(74,85,104,0.3)" : isRouted ? "1px solid rgba(74,222,128,0.2)" : isAssembled && assemblyPhase === "assembling" ? "1px solid rgba(123,163,212,0.3)" : ag.spawned ? "1px solid rgba(201,168,76,0.2)" : "1px solid rgba(28,48,87,0.8)",
                              transition: "all 0.4s",
                            }}>{isSkipped ? "skipped" : isRouted ? "✓ routed" : isAssembled && assemblyPhase === "assembling" ? "⚡ assembling" : ag.spawned ? "⚡ active" : "standby"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Document Vault ── */}
                <div style={{ margin: "0 14px 16px", background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #152542" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#E8ECF2" }}>Document Vault</span>
                    {activeVaultDocId && (
                      <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 999, background: "rgba(74,222,128,0.1)", color: "#4ADE80", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, border: "1px solid rgba(74,222,128,0.2)" }}>● Active</span>
                    )}
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <DocumentVault
                      onVaultTextChange={setVaultText}
                      activeDocId={activeVaultDocId}
                      onActiveDocChange={setActiveVaultDocId}
                    />
                  </div>
                </div>

              </div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
