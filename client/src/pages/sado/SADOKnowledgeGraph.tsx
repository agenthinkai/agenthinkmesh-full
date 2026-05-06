import { useCallback } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Network, Database, Users, FileText, Building2, CreditCard, MapPin } from "lucide-react";
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Connection, Node, Edge } from "@xyflow/react";
import { useEffect } from "react";

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  Customer:   <Users className="w-4 h-4" />,
  Employee:   <Users className="w-4 h-4" />,
  Invoice:    <FileText className="w-4 h-4" />,
  Department: <Building2 className="w-4 h-4" />,
  Payment:    <CreditCard className="w-4 h-4" />,
  Location:   <MapPin className="w-4 h-4" />,
};

const ENTITY_COLORS: Record<string, string> = {
  Customer:   "#3b82f6",
  Employee:   "#8b5cf6",
  Invoice:    "#10b981",
  Department: "#f59e0b",
  Payment:    "#ef4444",
  Location:   "#06b6d4",
};

function EntityNode({ data }: { data: { label: string; source: string; columns: number; pii: number } }) {
  const color = ENTITY_COLORS[data.label] ?? "#64748b";
  const icon = ENTITY_ICONS[data.label] ?? <Database className="w-4 h-4" />;
  return (
    <div
      className="rounded-xl border px-4 py-3 min-w-[160px] shadow-lg"
      style={{ borderColor: color + "40", background: `${color}15` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div style={{ color }}>{icon}</div>
        <span className="text-sm font-semibold text-white">{data.label}</span>
      </div>
      <div className="text-xs text-slate-400 space-y-0.5">
        <div>Source: <span className="text-slate-300">{data.source}</span></div>
        <div>Columns: <span className="text-slate-300">{data.columns}</span></div>
        {data.pii > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-red-400">{data.pii} PII/Sensitive</span>
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

const INITIAL_POSITIONS: Record<string, { x: number; y: number }> = {
  Customer:   { x: 100,  y: 200 },
  Employee:   { x: 400,  y: 50  },
  Invoice:    { x: 400,  y: 350 },
  Department: { x: 700,  y: 50  },
  Payment:    { x: 700,  y: 350 },
  Location:   { x: 550,  y: 200 },
};

export default function SADOKnowledgeGraph() {
  const graphQ = trpc.sado.getKnowledgeGraph.useQuery();
  const graph = graphQ.data;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onConnect = useCallback((params: Connection) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  useEffect(() => {
    if (!graph) return;

     const rfNodes: Node[] = graph.nodes.map(n => ({
      id: String(n.id),
      type: "entity",
      position: INITIAL_POSITIONS[n.label] ?? { x: n.x ?? Math.random() * 600, y: n.y ?? Math.random() * 400 },
      data: {
        label: n.label,
        source: n.type,
        columns: n.count,
        pii: 0,
      },
    }));
    const rfEdges: Edge[] = graph.edges.map(e => ({
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
      label: e.label,
      labelStyle: { fill: "#94a3b8", fontSize: 10 },
      style: { stroke: "#334155", strokeWidth: 1.5 },
      animated: false,
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [graph, setNodes, setEdges]);

  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = graph?.edges.length ?? 0;
  const piiNodes = 0;

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.02_255)] text-slate-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[oklch(0.12_0.03_255)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/sado">
            <button className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <Network className="w-5 h-5 text-blue-400" />
          <div>
            <h1 className="text-base font-semibold text-white">Knowledge Graph</h1>
            <p className="text-xs text-slate-400">Entity relationships · Semantic mapping · Lineage</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-300">
              {nodeCount} nodes · {edgeCount} edges
            </Badge>
            {piiNodes > 0 && (
              <Badge variant="outline" className="text-xs bg-red-500/10 border-red-500/20 text-red-400">
                {piiNodes} PII nodes
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex-1" style={{ height: "calc(100vh - 120px)" }}>
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Network className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Knowledge graph loading... Run the demo from the Command Centre to populate it.</p>
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
              nodeColor={n => ENTITY_COLORS[(n.data as { label: string }).label] ?? "#64748b"}
              style={{ background: "oklch(0.14 0.03 255)", border: "1px solid #1e293b" }}
            />
          </ReactFlow>
        )}
      </div>

      {/* Legend */}
      <div className="border-t border-slate-800 bg-[oklch(0.12_0.03_255)] px-6 py-3">
        <div className="flex items-center gap-6 flex-wrap">
          {Object.entries(ENTITY_COLORS).map(([entity, color]) => (
            <div key={entity} className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {entity}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
