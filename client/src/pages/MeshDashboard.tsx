import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  AgentNode,
  CONTEXTS,
  DOMAIN_MAP,
  LayoutNode,
  MeshContext,
  ROLE_CONTEXT_MAP,
  buildLayout,
  inferAgents,
} from "@/lib/meshData";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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
function AgentCard({ agent, taskText, contextLabel, systemPromptBase, vaultText, delay, onDone }: {
  agent: AgentNode;
  taskText: string;
  contextLabel: string;
  systemPromptBase: string;
  vaultText: string;
  delay: number;
  onDone: (label: string, text: string) => void;
}) {
  const [status, setStatus] = useState<"queued"|"running"|"done"|"error">("queued");
  const [content, setContent] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const color = agent.spawned ? "#C9A84C" : "#7BA3D4";
  const runAgentTask = trpc.mesh.runAgentTask.useMutation();

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setStatus("running");
      startRef.current = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);

      try {
        const { result } = await runAgentTask.mutateAsync({
          agentLabel: agent.label,
          systemPromptBase,
          taskText,
          contextLabel,
          vaultText: vaultText || "",
        });
        clearInterval(timerRef.current!);
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
        {chip(status)}
        {(status === "done" || status === "running") && <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace" }}>{elapsed}s</span>}
      </div>
      {content && <pre style={{ margin: 0, fontSize: 10, color: "#A8B4C8", lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</pre>}
      {!content && status === "queued" && <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>Standby…</div>}
    </div>
  );
}
// ─── OutputPanel ────────────────────────────────────────────────────────────────
function OutputPanel({ agents, taskText, ctx, vaultText, onBack, onDone }: {
  agents: AgentNode[];
  taskText: string;
  ctx: MeshContext;
  vaultText: string;
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
    const filename = `${ctx.label.replace(/\s+/g, "-")}-${date}-task`;
    const cardsHtml = agents.map(ag => {
      const text = outputsRef.current[ag.label] || "";
      if (!text) return "";
      return `<div class="card"><div class="agent-name">${ag.label}${ag.spawned ? ' <span class="spawned">⚡ Spawned</span>' : ""}</div><pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></div>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${filename}</title>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap" rel="stylesheet">
      <style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: 'DM Mono', monospace; padding: 40px; color: #374151; font-size: 11px; } .header { border-bottom: 2px solid #4F46E5; padding-bottom: 16px; margin-bottom: 24px; } h1 { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; color: #1E293B; margin-bottom: 4px; } .meta { color: #94A3B8; font-size: 10px; } .card { border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 14px; page-break-inside: avoid; } .agent-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; color: #4F46E5; margin-bottom: 10px; } .spawned { font-size: 9px; color: #F59E0B; } pre { white-space: pre-wrap; word-break: break-word; line-height: 1.75; } .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 9px; color: #CBD5E1; } @media print { body { padding: 20px; } }</style>
      </head><body>
      <div class="header"><h1>${(taskText.length > 100 ? taskText.slice(0, 100) + "…" : taskText).replace(/</g, "&lt;")}</h1>
      <div class="meta">${ctx.label} · ${agents.length} agents · ${date} · AgenThink Mesh v3.1</div></div>
      ${cardsHtml}
      <div class="footer">Generated by AgenThink Mesh · ${new Date().toLocaleString()}</div>
      </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename + ".html";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", background: "#0B1629" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid #1C3057", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#8494AA", fontFamily: "'JetBrains Mono', monospace" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: "#E8ECF2" }}>{taskText.length > 80 ? taskText.slice(0, 80) + "…" : taskText}</div>
          <div style={{ fontSize: 10, color: "#637080", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
            {ctx.label} · {agents.length} agents · {doneCount >= total ? "Completed" : `Running · ${elapsed}s`}
          </div>
        </div>
        {doneCount >= total && (
          <button onClick={exportPDF} style={{ background: "linear-gradient(135deg, #1C3057 0%, #243B6E 100%)", color: "#E8ECF2", border: "1px solid rgba(168,180,200,0.2)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 11, fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
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
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
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
  const [role, setRole] = useState(() => {
    const saved = localStorage.getItem("mesh_role");
    return saved || "vc";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctx = CONTEXTS[role];

  // ── Domain nav groups for sidebar (must be before any early return) ─────────────────────────────────────────
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(DOMAIN_MAP).forEach(d => { initial[d] = d === ctx.domain; });
    return initial;
  });
  const toggleDomain = (d: string) => setExpandedDomains(prev => ({ ...prev, [d]: !prev[d] }));

  const DOMAIN_COLORS: Record<string, string> = {
    finance: "#7BA3D4", legal: "#9B7FD4", healthcare: "#4ADE80",
    enterprise: "#38BDF8", gccwealth: "#C9A84C",
  };

  const [agentList, setAgentList] = useState<AgentNode[]>(() =>
    CONTEXTS[role].agents.map((label, i) => ({ id: "a" + i, label, spawned: false }))
  );

  // tRPC mutations
  const saveHistory = trpc.mesh.saveTask.useMutation({
    onSuccess: () => utils.mesh.getHistory.invalidate(),
  });

  // Debounced agent inference
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAgentList(inferAgents(task, ctx.agents));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [task, role]);

  // Reset on role change
  useEffect(() => {
    setAgentList(CONTEXTS[role].agents.map((label, i) => ({ id: "a" + i, label, spawned: false })));
    setTask("");
    setShowOutput(false);
    setRoutedNodes([]);
    localStorage.setItem("mesh_role", role);
  }, [role]);

  // Boot sequence
  const bootMsgs = ["Initialising Mesh…", "Identifying profile…", `Detected: ${ctx.label}`, "Configuring agents…", "Ready."];
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      setBootStep(i);
      if (i >= bootMsgs.length - 1) { clearInterval(t); setTimeout(() => setBooting(false), 500); }
    }, 480);
    return () => clearInterval(t);
  }, []);

  const meshNodes = buildLayout(agentList, ctx.color);
  const spawnedCount = agentList.filter(a => a.spawned).length;

  const run = () => {
    if (!task.trim()) return;
    setCurrentAgents([...agentList]);
    const nodeIds = meshNodes.map(n => n.id);
    nodeIds.forEach((id, i) => setTimeout(() => setRoutedNodes(r => [...r, id]), i * 200));
    setTimeout(() => { setShowOutput(true); setRoutedNodes([]); }, 1200);
  };

  const handleOutputDone = (outputs: OutputMap) => {
    saveHistory.mutate({
      task,
      contextKey: role,
      contextLabel: ctx.label,
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
      <header style={{ height: 48, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid #1C3057", background: "#0F1E38", gap: 12, flexShrink: 0 }}>
        <Logo size={24} />
        {/* Active context badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "rgba(123,163,212,0.08)", border: "1px solid rgba(123,163,212,0.2)", borderRadius: 20 }}>
          <span style={{ fontSize: 12 }}>{ctx.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#E8ECF2" }}>{ctx.label}</span>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
        </div>
        {spawnedCount > 0 && (
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>⚡ {spawnedCount} spawned</span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#8494AA" }}>{user?.name || user?.email || "User"}</span>
        <button onClick={logout} style={{ fontSize: 11, color: "#637080", background: "none", border: "1px solid #1C3057", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Sign out</button>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR: Domain navigation ── */}
        <aside style={{
          width: sidebarCollapsed ? 52 : 220,
          borderRight: "1px solid #1C3057",
          background: "#0A1628",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflowY: sidebarCollapsed ? "hidden" : "auto",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
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
                  const hasActive = CONTEXTS[role]?.domain === domainKey;
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
              const hasActive = CONTEXTS[role]?.domain === domainKey;
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
              taskText={task}
              ctx={ctx}
              vaultText={vaultText}
              onBack={() => setShowOutput(false)}
              onDone={handleOutputDone}
            />
          ) : (
            <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 260px" }}>

              {/* ── CENTER ── */}
              <div style={{ overflowY: "auto", padding: "28px 28px 28px", display: "flex", flexDirection: "column", gap: 18, background: "#0B1629" }}>

                {/* Greeting */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 24, color: "#E8ECF2", letterSpacing: "-0.03em", marginBottom: 4 }}>
                      Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {(user?.name || "").split(" ")[0] || "there"}.
                    </h1>
                    <div style={{ fontSize: 12, color: "#637080", fontFamily: "'JetBrains Mono', monospace" }}>
                      <span style={{ color: ctx.color, fontWeight: 600 }}>{ctx.label}</span> · {agentList.length} agents ready
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 8, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#A8B4C8" }}>
                    <span style={{ color: "#22C55E", fontWeight: 700 }}>●</span> Mesh Online
                  </div>
                </div>

                {/* Metrics row — inline 4-col grid above task box */}
                <CenterMetrics />

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
                      placeholder={`e.g. ${ctx.quickTasks[0]}…`}
                      rows={4}
                      style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 14, color: "#E8ECF2", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7, background: "transparent" }}
                    />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid #152542" }}>
                      <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "'JetBrains Mono', monospace" }}>⌘ + Enter to execute</div>
                      <button
                        onClick={run}
                        disabled={!task.trim()}
                        style={{
                          background: task.trim() ? "linear-gradient(135deg, #7BA3D4 0%, #4A7DB5 100%)" : "#152542",
                          color: task.trim() ? "#0B1629" : "#637080",
                          border: "none", borderRadius: 10, padding: "10px 24px",
                          cursor: task.trim() ? "pointer" : "not-allowed",
                          fontSize: 13, fontFamily: "'Inter', sans-serif", fontWeight: 800,
                          transition: "all 0.15s", letterSpacing: "-0.01em",
                        }}
                      >
                        ▶ Execute via Mesh
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
                  {/* Quick task chips */}
                  <div style={{ padding: "0 18px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ctx.quickTasks.map(qt => (
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

              {/* ── RIGHT PANEL ── */}
              <div style={{ borderLeft: "1px solid #1C3057", background: "#0A1628", overflowY: "auto", display: "flex", flexDirection: "column", paddingTop: 14 }}>

                {/* ── Agents card ── */}
                <div style={{ margin: "0 14px 12px", background: "#0F1E38", border: "1px solid #1C3057", borderRadius: 12, overflow: "hidden" }}>
                  {/* Card header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #152542" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 2px rgba(34,197,94,0.2)" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#E8ECF2" }}>Agents</span>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(123,163,212,0.1)", color: "#7BA3D4", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{agentList.length} ready</span>
                  </div>
                  {/* Agent rows */}
                  <div style={{ padding: "8px 0", maxHeight: 220, overflowY: "auto" }}>
                    {agentList.map((ag, idx) => (
                      <div key={ag.id} style={{
                        display: "flex", alignItems: "center", padding: "7px 14px",
                        background: ag.spawned ? "rgba(201,168,76,0.04)" : "transparent",
                        borderBottom: idx < agentList.length - 1 ? "1px solid rgba(28,48,87,0.5)" : "none",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: ag.spawned ? "#C9A84C" : ctx.color, display: "inline-block", flexShrink: 0, marginRight: 10 }} />
                        <span style={{ flex: 1, fontSize: 12, color: ag.spawned ? "#C9A84C" : "#A8B4C8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ag.label}</span>
                        <span style={{
                          fontSize: 9, padding: "2px 7px", borderRadius: 999, fontFamily: "'JetBrains Mono', monospace",
                          background: ag.spawned ? "rgba(201,168,76,0.12)" : "rgba(168,180,200,0.06)",
                          color: ag.spawned ? "#C9A84C" : "#4A5568",
                          border: ag.spawned ? "1px solid rgba(201,168,76,0.2)" : "1px solid rgba(28,48,87,0.8)",
                        }}>{ag.spawned ? "⚡ active" : "standby"}</span>
                      </div>
                    ))}
                  </div>
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

              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
