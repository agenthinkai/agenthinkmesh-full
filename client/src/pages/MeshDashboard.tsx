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
import { useCallback, useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";

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
      ctx.strokeStyle = n.spawned ? "rgba(245,158,11,0.35)" : routed ? "rgba(79,70,229,0.5)" : "rgba(148,163,184,0.25)";
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
      ctx.fillStyle = n.center ? n.color : routed ? n.color : "#fff";
      ctx.fill();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = n.center ? 0 : 1.5;
      ctx.stroke();
      // label
      ctx.font = `${n.center ? 600 : 400} 8px 'DM Mono', monospace`;
      ctx.fillStyle = "#64748B";
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
      background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)", width: 320, overflow: "hidden",
    }}>
      {/* Domain tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #F1F5F9", padding: "8px 8px 0" }}>
        {Object.entries(DOMAIN_MAP).map(([key, d]) => (
          <button key={key} onClick={() => setActiveDomain(key)} style={{
            flex: 1, padding: "6px 4px", border: "none", background: "none", cursor: "pointer",
            borderBottom: activeDomain === key ? "2px solid #4F46E5" : "2px solid transparent",
            fontSize: 9, color: activeDomain === key ? "#4F46E5" : "#94A3B8",
            fontFamily: "'DM Mono', monospace", fontWeight: 600,
          }}>
            {d.icon}
          </button>
        ))}
      </div>
      {/* Context list */}
      <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 14px 4px", fontFamily: "'DM Mono', monospace" }}>
        Select context
      </div>
      {domainContexts.map(([id, c]) => (
        <button key={id} onClick={() => { onSwitch(id); onClose(); }} style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "10px 14px", border: "none", background: id === current ? "#F8FAFF" : "none",
          cursor: "pointer", textAlign: "left",
        }}>
          <span style={{ fontSize: 14 }}>{c.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, color: "#1E293B" }}>{c.label}</div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
              {c.agents.slice(0, 3).join(" · ")} +{c.agents.length - 3}
            </div>
          </div>
          {id === current && <span style={{ fontSize: 10, color: "#4F46E5" }}>✓</span>}
        </button>
      ))}
      <div style={{ padding: "8px 14px 10px", borderTop: "1px solid #F1F5F9", fontSize: 9, color: "#CBD5E1", fontFamily: "'DM Mono', monospace" }}>
        {Object.keys(CONTEXTS).length} contexts available · max 50 agents per task
      </div>
    </div>
  );
}

// ─── AgentCard ────────────────────────────────────────────────────────────────
function AgentCard({ agent, taskText, contextLabel, systemPromptBase, vaultText, apiKey, delay, onDone }: {
  agent: AgentNode;
  taskText: string;
  contextLabel: string;
  systemPromptBase: string;
  vaultText: string;
  apiKey: string;
  delay: number;
  onDone: (label: string, text: string) => void;
}) {
  const [status, setStatus] = useState<"queued"|"running"|"done"|"error">("queued");
  const [content, setContent] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const color = agent.spawned ? "#F59E0B" : "#4F46E5";

  const buildPrompt = () => {
    let base = `${systemPromptBase}\n\nYou are the ${agent.label}. Analyse the following task and respond with exactly this structure:\nSUMMARY: one sentence.\nKEY FINDINGS: 3-5 bullet points.\nFLAGS: any risks or issues (or 'None identified').\nNEXT ACTION: one recommended step.`;
    if (vaultText) base += `\n\nDocument context:\n${vaultText.slice(0, 2000)}`;
    return base;
  };

  const placeholder = () =>
    `SUMMARY: ${agent.label} has completed analysis within the ${contextLabel} context.\n\nKEY FINDINGS:\n• Primary objective identified and scoped against institutional parameters\n• Relevant data points extracted and cross-referenced with context configuration\n• Risk threshold assessment completed against baseline criteria\n• Compliance alignment verified for applicable regulatory framework\n• Output structured for downstream agent consumption\n\nFLAGS: None identified at this stage. Recommend secondary review if task scope expands.\n\nNEXT ACTION: Route findings to Mesh Core for aggregation and final output compilation.`;

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setStatus("running");
      startRef.current = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);

      if (!apiKey) {
        const text = placeholder();
        let i = 0;
        const tw = setInterval(() => {
          i += 3;
          setContent(text.slice(0, i));
          if (i >= text.length) {
            clearInterval(tw);
            clearInterval(timerRef.current!);
            setStatus("done");
            onDone(agent.label, text);
          }
        }, 18);
        return;
      }

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1000,
            stream: true,
            system: buildPrompt(),
            messages: [{ role: "user", content: taskText }],
          }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value).split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const d = line.slice(6);
              if (d === "[DONE]") continue;
              try {
                const p = JSON.parse(d);
                if (p.type === "content_block_delta" && p.delta?.text) {
                  full += p.delta.text;
                  setContent(full);
                }
              } catch { /* ignore */ }
            }
          }
        }
        clearInterval(timerRef.current!);
        setStatus("done");
        onDone(agent.label, full);
      } catch (err: unknown) {
        clearInterval(timerRef.current!);
        const msg = err instanceof Error ? err.message : String(err);
        setContent(`Error: ${msg}. Check API key in Settings.`);
        setStatus("error");
      }
    }, delay);
    return () => { clearTimeout(timeout); clearInterval(timerRef.current!); };
  }, []);

  const chip = (s: typeof status) => {
    const map = {
      queued:  { label: "Queued",  bg: "#F1F5F9", color: "#94A3B8" },
      running: { label: "Running", bg: "#EEF2FF", color: "#4F46E5" },
      done:    { label: "Done",    bg: "#DCFCE7", color: "#16A34A" },
      error:   { label: "Error",   bg: "#FEE2E2", color: "#DC2626" },
    };
    const c = map[s];
    return <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.color, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{c.label}</span>;
  };

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${status === "done" ? "#BBF7D0" : status === "error" ? "#FECACA" : "#F1F5F9"}`,
      borderRadius: 14, padding: "14px 16px", marginBottom: 10,
      boxShadow: status === "done" ? "0 0 0 1px #BBF7D0, 0 2px 12px rgba(22,163,74,0.06)" : "0 2px 12px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 600, color: "#374151", flex: 1 }}>
          {agent.label}
          {agent.spawned && <span style={{ marginLeft: 6, fontSize: 8, padding: "1px 6px", borderRadius: 999, background: "#FFFBEB", color: "#F59E0B", border: "1px solid #FDE68A", fontFamily: "'DM Mono', monospace" }}>⚡ NEW</span>}
        </span>
        {chip(status)}
        {(status === "done" || status === "running") && <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace" }}>{elapsed}s</span>}
      </div>
      {content && <pre style={{ margin: 0, fontSize: 10, color: "#374151", lineHeight: 1.7, fontFamily: "'DM Mono', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</pre>}
      {!content && status === "queued" && <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "'DM Mono', monospace" }}>Standby…</div>}
    </div>
  );
}

// ─── OutputPanel ──────────────────────────────────────────────────────────────
function OutputPanel({ agents, taskText, ctx, vaultText, apiKey, onBack, onDone }: {
  agents: AgentNode[];
  taskText: string;
  ctx: MeshContext;
  vaultText: string;
  apiKey: string;
  onBack: () => void;
  onDone: (outputs: OutputMap) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const outputsRef = useRef<OutputMap>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());
  const total = agents.length;

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
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#64748B", fontFamily: "'DM Mono', monospace" }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: "#374151" }}>{taskText.length > 80 ? taskText.slice(0, 80) + "…" : taskText}</div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
            {ctx.label} · {agents.length} agents · {doneCount >= total ? "Completed" : `Running · ${elapsed}s`}
          </div>
        </div>
        {doneCount >= total && (
          <button onClick={exportPDF} style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
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
          apiKey={apiKey}
          delay={i * 400}
          onDone={handleDone}
        />
      ))}
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
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#64748B", fontFamily: "'DM Mono', monospace" }}>← Back</button>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#1E293B", flex: 1 }}>Task History</div>
      </div>
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search tasks…"
        style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontFamily: "'DM Mono', monospace", marginBottom: 14, outline: "none", background: "#fff" }}
      />
      {isLoading && <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'DM Mono', monospace" }}>Loading…</div>}
      {!isLoading && filtered.length === 0 && <div style={{ fontSize: 11, color: "#CBD5E1", fontFamily: "'DM Mono', monospace" }}>No tasks yet. Execute your first task to see history here.</div>}
      {filtered.map((h: HistoryRow) => (
        <div key={h.id} style={{ background: "#fff", border: "1px solid #F1F5F9", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>{h.task.length > 80 ? h.task.slice(0, 80) + "…" : h.task}</div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'DM Mono', monospace" }}>
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
    <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", background: "#F8FAFC" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "#64748B", fontFamily: "'DM Mono', monospace" }}>← Back</button>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Settings</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "20px" }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 4 }}>Anthropic API Key</div>
        <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>
          Required for live AI output. Stored in session only — never sent to our servers. Get one at console.anthropic.com
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-ant-…"
          style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, fontFamily: "'DM Mono', monospace", marginBottom: 10, outline: "none" }}
        />
        <button onClick={save} style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
          {saved ? "Saved ✓" : "Save Key"}
        </button>
        {!apiKey && (
          <div style={{ marginTop: 12, fontSize: 10, color: "#F59E0B", fontFamily: "'DM Mono', monospace", padding: "8px 10px", background: "#FFFBEB", borderRadius: 6, border: "1px solid #FDE68A" }}>
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
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>Recent Tasks</span>
        {history && history.length > 5 && (
          <span style={{ fontSize: 9, color: "#4F46E5", fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>{history.length} total</span>
        )}
      </div>
      {isLoading && <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "'DM Mono', monospace" }}>Loading…</div>}
      {!isLoading && recent.length === 0 && (
        <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "'DM Mono', monospace", textAlign: "center", padding: "10px 0" }}>No tasks yet — execute your first task above</div>
      )}
      {recent.map((h: HistoryRow) => (
        <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F8FAFC" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#374151", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {h.task.length > 60 ? h.task.slice(0, 60) + "…" : h.task}
            </div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
              {h.contextLabel} · {h.agentCount} agents · {new Date(h.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            onClick={() => onRerun(h.task)}
            style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, background: "#EEF2FF", color: "#4F46E5", border: "none", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: 600, flexShrink: 0 }}
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
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>Live Mesh Activity</span>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 3px rgba(34,197,94,0.2)" }} />
      </div>
      {isLoading && <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "'DM Mono', monospace" }}>Loading…</div>}
      {!isLoading && (!activity || activity.length === 0) && (
        <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "'DM Mono', monospace", textAlign: "center", padding: "12px 0" }}>No activity yet — execute your first task</div>
      )}
      {(activity || []).map((row: Row, i: number) => (
        <div key={row.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingBottom: 8, marginBottom: 8, borderBottom: i < (activity!.length - 1) ? "1px solid #F8FAFC" : "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>⚡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "#374151", fontFamily: "'DM Mono', monospace", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.task.length > 42 ? row.task.slice(0, 42) + "…" : row.task}
            </div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
              {row.contextLabel} · {row.agentCount} agents
            </div>
          </div>
          <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 999, background: "#DCFCE7", color: "#16A34A", fontFamily: "'DM Mono', monospace", fontWeight: 600, flexShrink: 0 }}>Done</span>
        </div>
      ))}
    </div>
  );
}

function AgentStatusWidget({ agentList, ctxColor }: { agentList: AgentNode[]; ctxColor: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>Agent Status</span>
        <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace" }}>{agentList.length} active</span>
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {agentList.map(ag => (
          <div key={ag.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: ag.spawned ? "#F59E0B" : ctxColor, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "#374151", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>{ag.label}</span>
            </div>
            <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 999, background: ag.spawned ? "#FFFBEB" : "#F1F5F9", color: ag.spawned ? "#F59E0B" : "#94A3B8", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
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
    { label: "Tasks Today",   value: isLoading ? "—" : String(metrics?.tasksToday ?? 0),    unit: "",  color: "#4F46E5" },
    { label: "Total Tasks",   value: isLoading ? "—" : String(metrics?.totalTasks ?? 0),    unit: "",  color: "#0EA5E9" },
    { label: "Avg Agents",    value: isLoading ? "—" : String(metrics?.avgAgents ?? 0),     unit: "/task", color: "#8B5CF6" },
    { label: "Success Rate",  value: isLoading ? "—" : String(metrics?.successRate ?? 100), unit: "%", color: "#22C55E" },
  ];
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", fontWeight: 600, marginBottom: 12 }}>System Metrics</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "#F8FAFC", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 18, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: s.color, lineHeight: 1 }}>
              {s.value}<span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 400, fontFamily: "'DM Mono', monospace" }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
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
  const [vaultText] = useState("");
  const [booting, setBooting] = useState(true);
  const [bootStep, setBootStep] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ctx = CONTEXTS[role];
  const apiKey = sessionStorage.getItem("mesh_api_key") || "";

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
      <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 24 }}><Logo size={34} inverted /></div>
          {bootMsgs.slice(0, bootStep + 1).map((msg, i) => (
            <div key={i} style={{ fontSize: 11, color: i === bootStep ? "#4F46E5" : "#475569", marginBottom: 6, transition: "color 0.3s" }}>{msg}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F8FAFC", fontFamily: "'Syne', sans-serif" }}>
      {/* Topbar */}
      <header style={{ height: 52, display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid #E2E8F0", background: "#fff", gap: 12, flexShrink: 0 }}>
        <Logo size={26} />
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowSwitcher(s => !s)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
            border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC",
            cursor: "pointer", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "#374151",
          }}>
            <span>{ctx.icon}</span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11 }}>{ctx.label}</span>
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999, background: "#EEF2FF", color: "#4F46E5", fontFamily: "'DM Mono', monospace" }}>
              {DOMAIN_MAP[ctx.domain]?.label}
            </span>
            <span style={{ fontSize: 9, color: "#94A3B8" }}>▾</span>
          </button>
          {showSwitcher && (
            <ContextSwitcher current={role} onSwitch={setRole} onClose={() => setShowSwitcher(false)} />
          )}
        </div>
        {spawnedCount > 0 && (
          <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: "#FFFBEB", color: "#F59E0B", border: "1px solid #FDE68A", fontFamily: "'DM Mono', monospace" }}>
            ⚡ {spawnedCount} spawned
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* User info */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#64748B", fontFamily: "'DM Mono', monospace" }}>{user?.name || user?.email || "User"}</span>
          <button onClick={logout} style={{ fontSize: 10, color: "#94A3B8", background: "none", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left sidebar */}
        <aside style={{ width: 280, borderRight: "1px solid #E2E8F0", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {/* Canvas */}
          <div style={{ padding: "12px 12px 8px" }}>
            <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>Mesh Canvas</div>
            <MeshCanvas nodes={meshNodes} routedIds={routedNodes} />
          </div>
          {/* Capacity bar */}
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Agent capacity</span>
              <span style={{ fontSize: 9, color: agentList.length > 30 ? "#F59E0B" : "#94A3B8", fontFamily: "'DM Mono', monospace" }}>{agentList.length} / 50</span>
            </div>
            <div style={{ height: 3, background: "#F1F5F9", borderRadius: 999 }}>
              <div style={{ height: "100%", width: `${(agentList.length / 50) * 100}%`, background: agentList.length > 30 ? "#F59E0B" : "#4F46E5", borderRadius: 999, transition: "width 0.3s" }} />
            </div>
          </div>
          {/* Agent list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
            <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>Agents</div>
            {agentList.map(ag => (
              <div key={ag.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: ag.spawned ? "#F59E0B" : ctx.color, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "#374151", fontFamily: "'DM Mono', monospace" }}>{ag.label}</span>
                  {ag.spawned && <span style={{ fontSize: 8, color: "#F59E0B" }}>⚡</span>}
                </div>
                <span style={{ fontSize: 9, color: "#CBD5E1", fontFamily: "'DM Mono', monospace" }}>standby</span>
              </div>
            ))}
          </div>
          {/* Nav */}
          <div style={{ borderTop: "1px solid #F1F5F9", padding: "10px 12px", display: "flex", gap: 6 }}>
            {[
              { key: "home", icon: "⌂", label: "Home" },
              { key: "history", icon: "≡", label: "History" },
              { key: "settings", icon: "⚙", label: "Settings" },
            ].map(n => (
              <button key={n.key} onClick={() => { setActiveNav(n.key as typeof activeNav); setShowOutput(false); }} style={{
                flex: 1, padding: "6px 4px", border: "none", borderRadius: 8,
                background: activeNav === n.key ? "#EEF2FF" : "none",
                cursor: "pointer", fontSize: 14, color: activeNav === n.key ? "#4F46E5" : "#94A3B8",
              }} title={n.label}>
                {n.icon}
              </button>
            ))}
          </div>
        </aside>

          {/* Main content */}
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
                apiKey={apiKey}
                onBack={() => { setShowOutput(false); }}
                onDone={handleOutputDone}
              />
            ) : (
              /* ── Three-column enterprise home layout ── */
              <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 280px", gap: 0, background: "#F1F5F9" }}>

                {/* ── CENTER: Task Command Center ── */}
                <div style={{ overflowY: "auto", padding: "24px 24px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Greeting header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "#1E293B", letterSpacing: "-0.03em", marginBottom: 2 }}>
                        Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {(user?.name || "").split(" ")[0] || "there"}.
                      </h1>
                      <div style={{ fontSize: 11, color: "#64748B", fontFamily: "'DM Mono', monospace" }}>
                        Mesh configured for <span style={{ color: ctx.color, fontWeight: 600 }}>{ctx.label}</span> · {agentList.length} agents ready
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "#374151" }}>
                        <span style={{ color: "#22C55E", fontWeight: 700 }}>● </span>Mesh Online
                      </div>
                    </div>
                  </div>

                  {/* Task Command Center */}
                  <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
                    <div style={{ padding: "12px 16px 0", borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", fontWeight: 600, marginBottom: 10 }}>Task Command Center</div>
                    </div>
                    <div style={{ padding: "14px 16px" }}>
                      <textarea
                        value={task}
                        onChange={e => setTask(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
                        placeholder={`e.g. ${ctx.quickTasks[0]}…`}
                        rows={4}
                        style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 13, color: "#1E293B", fontFamily: "'DM Mono', monospace", lineHeight: 1.6, background: "transparent" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #F8FAFC" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {["PDF", "DOCX", "CSV", "XLSX"].map(f => (
                            <span key={f} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 6, background: "#F8FAFC", color: "#94A3B8", fontFamily: "'DM Mono', monospace", border: "1px solid #E2E8F0" }}>{f}</span>
                          ))}
                        </div>
                        <button
                          onClick={run}
                          disabled={!task.trim()}
                          style={{
                            background: task.trim() ? "#4F46E5" : "#E2E8F0",
                            color: task.trim() ? "#fff" : "#94A3B8",
                            border: "none", borderRadius: 10, padding: "9px 20px",
                            cursor: task.trim() ? "pointer" : "not-allowed",
                            fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 700,
                            transition: "all 0.15s",
                          }}
                        >
                          ▶ Execute via Mesh
                        </button>
                      </div>
                    </div>
                    {/* Quick task chips */}
                    <div style={{ padding: "0 16px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {ctx.quickTasks.map(qt => (
                        <button key={qt} onClick={() => setTask(qt)} style={{
                          padding: "5px 10px", background: "#F8FAFC",
                          border: "1px solid #E2E8F0", borderRadius: 8,
                          cursor: "pointer", fontSize: 10, color: "#374151",
                          fontFamily: "'DM Mono', monospace", transition: "all 0.12s",
                        }}>
                          {qt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recent Tasks panel */}
                  <RecentTasksPanel onRerun={(t: string) => setTask(t)} />

                  {/* Configured agents strip */}
                  <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 16px" }}>
                    <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>Configured Agents · {agentList.length} total</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {agentList.map(ag => (
                        <span key={ag.id} style={{
                          fontSize: 9, padding: "3px 9px", borderRadius: 999,
                          border: `1px solid ${ag.spawned ? "#FDE68A" : "#E2E8F0"}`,
                          background: ag.spawned ? "#FFFBEB" : "#F8FAFC",
                          color: ag.spawned ? "#F59E0B" : "#374151",
                          fontFamily: "'DM Mono', monospace",
                        }}>
                          {ag.spawned ? "⚡ " : ""}{ag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Three widgets ── */}
                <div style={{ borderLeft: "1px solid #E2E8F0", background: "#fff", overflowY: "auto", padding: "20px 16px" }}>
                  <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'DM Mono', monospace", fontWeight: 600, marginBottom: 14 }}>Mesh Intelligence</div>
                  <LiveActivityWidget />
                  <AgentStatusWidget agentList={agentList} ctxColor={ctx.color} />
                  <SystemMetricsWidget />
                </div>
              </div>
            )}
          </main>
      </div>
    </div>
  );
}
