import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useProspectFromUrl, useProspectMode, buildProspectQuery } from "@/hooks/useProspectMode";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Network, Database, Users, FileText,
  Building2, CreditCard, MapPin, Play, CheckCircle2
} from "lucide-react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Connection, Node, Edge } from "@xyflow/react";

// ── Colour palette ────────────────────────────────────────────────────────────
const SOURCE_COLOR = "#3b82f6";
const TABLE_COLOR  = "#8b5cf6";
const PII_COLOR    = "#ef4444";
const SAFE_COLOR   = "#10b981";

// ── Custom node renderers ─────────────────────────────────────────────────────
function SourceNode({ data }: { data: { label: string; tables: number; revealed: boolean } }) {
  return (
    <div
      className="rounded-xl border-2 px-5 py-3.5 min-w-[180px] shadow-xl"
      style={{
        borderColor: SOURCE_COLOR,
        background: `${SOURCE_COLOR}20`,
        transition: "opacity 0.7s ease, transform 0.7s ease",
        opacity: data.revealed ? 1 : 0,
        transform: data.revealed ? "scale(1)" : "scale(0.7)",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Database className="w-4 h-4" style={{ color: SOURCE_COLOR }} />
        <span className="text-sm font-bold text-white">{data.label}</span>
      </div>
      <div className="text-xs text-slate-400">{data.tables} tables discovered</div>
    </div>
  );
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  Customer:   <Users className="w-4 h-4" />,
  Employee:   <Users className="w-4 h-4" />,
  Invoice:    <FileText className="w-4 h-4" />,
  Department: <Building2 className="w-4 h-4" />,
  Payment:    <CreditCard className="w-4 h-4" />,
  Location:   <MapPin className="w-4 h-4" />,
};

function TableNode({ data }: { data: { label: string; source: string; columns: number; pii: number; revealed: boolean } }) {
  const icon = ENTITY_ICONS[data.label] ?? <FileText className="w-4 h-4" />;
  return (
    <div
      className="rounded-xl border px-4 py-3 min-w-[155px] shadow-lg"
      style={{
        borderColor: TABLE_COLOR + "60",
        background: `${TABLE_COLOR}15`,
        transition: "opacity 0.7s ease, transform 0.7s ease",
        opacity: data.revealed ? 1 : 0,
        transform: data.revealed ? "scale(1)" : "scale(0.6)",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div style={{ color: TABLE_COLOR }}>{icon}</div>
        <span className="text-sm font-semibold text-white">{data.label}</span>
      </div>
      <div className="text-xs text-slate-400 space-y-0.5">
        <div>Source: <span className="text-slate-300">{data.source}</span></div>
        <div>Columns: <span className="text-slate-300">{data.columns}</span></div>
        {data.pii > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-400">{data.pii} PII/Sensitive</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnNode({ data }: { data: { label: string; classification: string; revealed: boolean } }) {
  const isPii = data.classification === "PII" || data.classification === "SENSITIVE";
  const color = isPii ? PII_COLOR : SAFE_COLOR;
  return (
    <div
      className="rounded-lg border px-3 py-2 min-w-[130px] shadow"
      style={{
        borderColor: color + "50",
        background: `${color}10`,
        transition: "opacity 0.5s ease, transform 0.5s ease",
        opacity: data.revealed ? 1 : 0,
        transform: data.revealed ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-xs font-medium text-slate-200">{data.label}</span>
      </div>
      <div className="text-xs mt-0.5" style={{ color: color + "cc" }}>{data.classification}</div>
    </div>
  );
}

const nodeTypes = { source: SourceNode, table: TableNode, column: ColumnNode };

// ── Graph builder ─────────────────────────────────────────────────────────────
type GraphData = {
  nodes: Array<{ id: string; label: string; type: string; count: number; color?: string; x?: number | null; y?: number | null; piiCount?: number }>;
  edges: Array<{ id: string; source: string; target: string; label: string; count?: number }>;
};

function buildGraph(graphData: GraphData, revealed: Set<string>): { nodes: Node[]; edges: Edge[] } {
  const sourceNodes = graphData.nodes.filter(n => n.type === "source");
  const tableNodes  = graphData.nodes.filter(n => n.type === "table");
  const colNodes    = graphData.nodes.filter(n => n.type === "column");

  // Build parent maps from edges (string ids)
  const tableParent: Record<string, string> = {};
  const colParent: Record<string, string> = {};
  graphData.edges.forEach(e => {
    const src = graphData.nodes.find(n => n.id === e.source);
    const tgt = graphData.nodes.find(n => n.id === e.target);
    if (!src || !tgt) return;
    if (src.type === "source" && tgt.type === "table") tableParent[tgt.id] = src.id;
    if (src.type === "table"  && tgt.type === "column") colParent[tgt.id] = src.id;
  });

  const rfNodes: Node[] = [];

  // Source row — use the node's own id as the ReactFlow id
  sourceNodes.forEach((n, i) => {
    const tablesUnder = tableNodes.filter(t => tableParent[t.id] === n.id).length;
    rfNodes.push({
      id: n.id,
      type: "source",
      position: { x: n.x ?? 80 + i * 380, y: n.y ?? 40 },
      data: { label: n.label, tables: tablesUnder || n.count, revealed: revealed.has(n.id) },
    });
  });

  // Table row
  tableNodes.forEach((n, i) => {
    const parentSrcIdx = sourceNodes.findIndex(s => s.id === tableParent[n.id]);
    const xBase = n.x ?? (80 + Math.max(0, parentSrcIdx) * 380);
    rfNodes.push({
      id: n.id,
      type: "table",
      position: { x: xBase + (i % 2) * 190, y: n.y ?? 230 },
      data: {
        label: n.label,
        source: sourceNodes.find(s => s.id === tableParent[n.id])?.label ?? "Unknown",
        columns: n.count,
        pii: n.piiCount ?? 0,
        revealed: revealed.has(n.id),
      },
    });
  });

  // Column row
  colNodes.forEach((n, i) => {
    const parentTblId = colParent[n.id];
    const parentRfNode = rfNodes.find(r => r.id === parentTblId);
    const xBase = parentRfNode?.position.x ?? 80;
    rfNodes.push({
      id: n.id,
      type: "column",
      position: { x: n.x ?? (xBase + (i % 4) * 145), y: n.y ?? (450 + Math.floor(i / 4) * 80) },
      data: { label: n.label, classification: n.type, revealed: revealed.has(n.id) },
    });
  });

  // Edges — only if both endpoints are revealed
  const rfEdges: Edge[] = graphData.edges
    .filter(e => revealed.has(e.source) && revealed.has(e.target))
    .map(e => ({
      id: `e-${e.id}`,
      source: e.source,
      target: e.target,
      label: e.label,
      labelStyle: { fill: "#94a3b8", fontSize: 10 },
      style: { stroke: "#334155", strokeWidth: 1.5 },
      animated: true,
    }));

  return { nodes: rfNodes, edges: rfEdges };
}

// ── Animation phases ──────────────────────────────────────────────────────────
type AnimPhase = "idle" | "phase1" | "phase2" | "phase3" | "done";

const PHASE_LABEL: Record<AnimPhase, string> = {
  idle:   "Run the demo to populate the graph",
  phase1: "Phase 1 — Discovering source systems…",
  phase2: "Phase 2 — Mapping tables and entities…",
  phase3: "Phase 3 — Classifying PII and sensitive columns…",
  done:   "Discovery graph generated from live metadata",
};

// ── Main component ────────────────────────────────────────────────────────────
export default function SADOKnowledgeGraph() {
  useProspectFromUrl();
  const { prospect } = useProspectMode();
  const graphQ = trpc.sado.getKnowledgeGraph.useQuery();
  const graph = graphQ.data;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const onConnect = useCallback((params: Connection) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  const [animPhase, setAnimPhase] = useState<AnimPhase>("idle");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Detect demo completion ────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const ts = parseInt(localStorage.getItem("sado_demo_completed") ?? "0", 10);
      if (ts && Date.now() - ts < 5 * 60 * 1000) triggerAnimation();
    };
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // ── Static graph (no animation) ───────────────────────────────────────────
  useEffect(() => {
    if (!graph || animPhase !== "idle") return;
    const allIds = new Set<string>(graph.nodes.map(n => n.id));
    const { nodes: rn, edges: re } = buildGraph(graph, allIds);
    setNodes(rn);
    setEdges(re);
  }, [graph, animPhase, setNodes, setEdges]);

  // ── Animated reveal ───────────────────────────────────────────────────────
  function triggerAnimation() {
    if (!graph) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRevealed(new Set());
    setAnimPhase("phase1");

    const srcIds = graph.nodes.filter(n => n.type === "source").map(n => n.id);
    const tblIds = graph.nodes.filter(n => n.type === "table").map(n => n.id);
    const colIds = graph.nodes.filter(n => n.type === "column").map(n => n.id);

    let delay = 0;

    // Phase 1 — source systems
    srcIds.forEach((id, i) => {
      timers.current.push(setTimeout(() => {
        setRevealed(prev => { const s = new Set(Array.from(prev)); s.add(id); return s; });
      }, delay + i * 700));
    });
    delay += srcIds.length * 700 + 500;

    // Phase 2 — tables
    timers.current.push(setTimeout(() => setAnimPhase("phase2"), delay));
    tblIds.forEach((id, i) => {
      timers.current.push(setTimeout(() => {
        setRevealed(prev => { const s = new Set(Array.from(prev)); s.add(id); return s; });
      }, delay + i * 500));
    });
    delay += tblIds.length * 500 + 500;

    // Phase 3 — columns
    timers.current.push(setTimeout(() => setAnimPhase("phase3"), delay));
    colIds.forEach((id, i) => {
      timers.current.push(setTimeout(() => {
        setRevealed(prev => { const s = new Set(Array.from(prev)); s.add(id); return s; });
      }, delay + i * 200));
    });
    delay += colIds.length * 200 + 700;

    timers.current.push(setTimeout(() => setAnimPhase("done"), delay));
  }

  // ── Sync revealed → ReactFlow ─────────────────────────────────────────────
  useEffect(() => {
    if (!graph || animPhase === "idle") return;
    const { nodes: rn, edges: re } = buildGraph(graph, revealed);
    setNodes(rn);
    setEdges(re);
  }, [revealed, graph, animPhase, setNodes, setEdges]);

  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = graph?.edges.length ?? 0;
  const isAnimating = animPhase === "phase1" || animPhase === "phase2" || animPhase === "phase3";

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3 flex-wrap gap-y-2">
          <Link href={`/sado${buildProspectQuery(prospect)}`}>
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <Network className="w-5 h-5 text-blue-400" />
          <div>
            <h1 className="text-base font-semibold text-white">Knowledge Graph</h1>
            <p className="text-xs text-slate-400">Entity relationships · Semantic mapping · Lineage</p>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {/* Phase status */}
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-all ${
              animPhase === "done"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : isAnimating
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
            }`}>
              {animPhase === "done"
                ? <><CheckCircle2 className="w-3 h-3 mr-1" />{PHASE_LABEL.done}</>
                : isAnimating
                  ? <><div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-1" />{PHASE_LABEL[animPhase]}</>
                  : PHASE_LABEL.idle
              }
            </div>
            <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-300">
              {nodeCount} nodes · {edgeCount} edges
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 gap-1"
              onClick={triggerAnimation}
              disabled={isAnimating || !graph}
            >
              <Play className="w-3 h-3" /> Replay
            </Button>
          </div>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1" style={{ height: "calc(100vh - 130px)" }}>
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Network className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Run the demo from the Command Centre to populate the graph.</p>
              <Link href="/sado/command-centre">
                <button className="mt-4 text-xs text-blue-400 hover:text-blue-300 underline">
                  Go to Command Centre →
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            style={{ background: "oklch(0.10 0.02 255)" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e293b" />
            <Controls className="bg-slate-900 border-slate-700" />
            <MiniMap
              nodeColor={n => {
                if (n.type === "source") return SOURCE_COLOR;
                if (n.type === "table")  return TABLE_COLOR;
                const cls = (n.data as { classification?: string }).classification;
                return cls === "PII" || cls === "SENSITIVE" ? PII_COLOR : SAFE_COLOR;
              }}
              style={{ background: "oklch(0.14 0.03 255)", border: "1px solid #1e293b" }}
            />
          </ReactFlow>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-800 bg-[oklch(0.12_0.03_255)] px-6 py-3">
        <div className="flex items-center gap-6 flex-wrap">
          {[
            { color: SOURCE_COLOR, label: "Source System" },
            { color: TABLE_COLOR,  label: "Table / Entity" },
            { color: PII_COLOR,    label: "PII / Sensitive column" },
            { color: SAFE_COLOR,   label: "Standard column" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
