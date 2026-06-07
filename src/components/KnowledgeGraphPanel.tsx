import React, { useEffect, useRef, useState } from "react";
import { X, Network, RefreshCw } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  kind: "goal" | "habit" | "person" | "commitment" | string;
}
interface GraphEdge {
  from: string;
  to: string;
  label: string;
}
interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const isTauri = () => typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

const KIND_COLOR: Record<string, { ring: string; fill: string; text: string }> = {
  goal: { ring: "stroke-violet-400", fill: "fill-violet-500", text: "fill-violet-100" },
  habit: { ring: "stroke-emerald-400", fill: "fill-emerald-500", text: "fill-emerald-100" },
  person: { ring: "stroke-sky-400", fill: "fill-sky-500", text: "fill-sky-100" },
  commitment: { ring: "stroke-amber-400", fill: "fill-amber-500", text: "fill-amber-100" },
};

const WIDTH = 520;
const HEIGHT = 420;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// Tiny force-directed layout — runs synchronously for a fixed iteration
// count, which is enough for the small graphs we surface and keeps the
// render dependency-free.
function layout(nodes: GraphNode[], edges: GraphEdge[]): PositionedNode[] {
  const positioned: PositionedNode[] = nodes.map((n, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    return {
      ...n,
      x: CENTER.x + Math.cos(angle) * 140,
      y: CENTER.y + Math.sin(angle) * 140,
      vx: 0,
      vy: 0,
    };
  });
  const byId = new Map(positioned.map(n => [n.id, n]));
  const linkDistance = 90;
  const repulsion = 4200;
  const damping = 0.7;
  const iterations = 240;

  for (let it = 0; it < iterations; it++) {
    // Repulsion between every pair
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i];
        const b = positioned[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = Math.max(40, dx * dx + dy * dy);
        const force = repulsion / distSq;
        const dist = Math.sqrt(distSq);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    // Spring attraction along edges
    for (const e of edges) {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = dist - linkDistance;
      const fx = (dx / dist) * diff * 0.06;
      const fy = (dy / dist) * diff * 0.06;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
    // Centering + integrate + clamp
    for (const n of positioned) {
      n.vx += (CENTER.x - n.x) * 0.002;
      n.vy += (CENTER.y - n.y) * 0.002;
      n.vx *= damping; n.vy *= damping;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(40, Math.min(WIDTH - 40, n.x));
      n.y = Math.max(40, Math.min(HEIGHT - 40, n.y));
    }
  }
  return positioned;
}

export const KnowledgeGraphPanel: React.FC<Props> = ({ open, onClose }) => {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const load = async () => {
    if (isTauri()) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const g = await invoke<KnowledgeGraph>("get_knowledge_graph");
        setGraph(g);
      } catch (err) {
        console.error("get_knowledge_graph:", err);
      }
    } else {
      setGraph({
        nodes: [
          { id: "goal:1", label: "Build Authentication System", kind: "goal" },
          { id: "goal:2", label: "NLP Model Integration", kind: "goal" },
          { id: "habit:1", label: "Deep Work (2hr)", kind: "habit" },
          { id: "person:1", label: "Sarah Chen", kind: "person" },
          { id: "person:2", label: "Marco", kind: "person" },
          { id: "commitment:1", label: "Review auth design", kind: "commitment" },
        ],
        edges: [
          { from: "person:1", to: "commitment:1", label: "owes" },
          { from: "person:1", to: "goal:1", label: "supports" },
        ],
      });
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  useEffect(() => {
    if (!graph) return;
    setPositioned(layout(graph.nodes, graph.edges));
  }, [graph]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden border border-white/[0.08] rounded-2xl glass-panel shadow-2xl">
        <div className="flex justify-between items-center px-6 py-4 bg-slate-950/40 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Network className="text-violet-400" size={16} />
            <h2 className="font-semibold text-sm text-white">Knowledge Map</h2>
            {graph && <span className="text-[10px] text-slate-400">{graph.nodes.length} nodes, {graph.edges.length} edges</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} title="Refresh" className="text-slate-400 hover:text-white p-1 rounded cursor-pointer bg-transparent border-none">
              <RefreshCw size={14} />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded cursor-pointer bg-transparent border-none">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl border border-white/5 bg-slate-950/40 overflow-hidden">
            <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-[420px]">
              {graph?.edges.map((e, i) => {
                const from = positioned.find(n => n.id === e.from);
                const to = positioned.find(n => n.id === e.to);
                if (!from || !to) return null;
                const active = selected === from.id || selected === to.id;
                return (
                  <line
                    key={i}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={active ? "stroke-violet-300" : "stroke-slate-600"}
                    strokeWidth={active ? 1.5 : 0.8}
                    opacity={active ? 0.9 : 0.5}
                  />
                );
              })}
              {positioned.map(n => {
                const color = KIND_COLOR[n.kind] ?? KIND_COLOR.goal;
                const isSelected = selected === n.id;
                const r = isSelected ? 16 : 12;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelected(s => s === n.id ? null : n.id)}
                  >
                    <circle r={r + 4} className={color.ring} fill="none" strokeWidth={1.2} opacity={isSelected ? 0.9 : 0.4} />
                    <circle r={r} className={color.fill} opacity={0.85} />
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      className="fill-slate-200 text-[9px] font-sans"
                      style={{ pointerEvents: "none" }}
                    >
                      {n.label.length > 22 ? `${n.label.slice(0, 20)}...` : n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />Goals</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Habits</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />People</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Commitments</span>
          </div>
        </div>
      </div>
    </div>
  );
};
