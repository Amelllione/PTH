import dagre from '@dagrejs/dagre';
import type { GraphEdge, GraphNode } from '@/entities/pth/types';

export const NODE_W = 208;
export const NODE_H = 80;

export interface Point {
  x: number;
  y: number;
}

export interface GraphLayout {
  positions: Record<string, Point>;
  width: number;
  height: number;
}

/**
 * Слоёная раскладка (Dagre, слева направо): связи идут слоями, порядок внутри слоя подбирается
 * так, чтобы минимизировать пересечения рёбер и не дать узлам накладываться.
 * Возвращает левые верхние углы узлов, как того ожидает React Flow.
 */
export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], _focus: string): GraphLayout {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 110, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) {
    g.setNode(node.display_id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target, {}, `${edge.type}:${edge.source}->${edge.target}`);
    }
  }
  dagre.layout(g);

  const positions: Record<string, Point> = {};
  for (const node of nodes) {
    const placed = g.node(node.display_id);
    if (!placed) continue;
    positions[node.display_id] = { x: placed.x - NODE_W / 2, y: placed.y - NODE_H / 2 };
  }
  const graph = g.graph();
  // У пустого графа Dagre не задаёт размеров: даём минимальный холст
  return {
    positions,
    width: Math.max(NODE_W, graph.width ?? 0),
    height: Math.max(NODE_H, graph.height ?? 0),
  };
}

export type GraphLayoutMode = 'links' | 'levels';

const ARC = NODE_W + 40;      // место по окружности на один узел
const RING_GAP = NODE_W + 80; // минимальный шаг между окружностями

/**
 * Раскладка по уровням от центра: центр в середине, на каждом следующем уровне своя окружность.
 * Узел уровня k встаёт по направлению своих соседей уровня k−1, поэтому ветки идут от центра лучами.
 */
export function layoutLevels(nodes: GraphNode[], edges: GraphEdge[], focus: string): GraphLayout {
  const level = (n: GraphNode) => n.level ?? (n.display_id === focus ? 0 : 1);
  const rings = new Map<number, GraphNode[]>();
  for (const n of nodes) rings.set(level(n), [...(rings.get(level(n)) ?? []), n]);
  const neighbours = new Map<string, string[]>();
  for (const e of edges) {
    neighbours.set(e.source, [...(neighbours.get(e.source) ?? []), e.target]);
    neighbours.set(e.target, [...(neighbours.get(e.target) ?? []), e.source]);
  }
  const center: Record<string, Point> = {};
  const angle: Record<string, number> = {};
  let radius = 0;
  for (const k of [...rings.keys()].sort((a, b) => a - b)) {
    const members = rings.get(k) ?? [];
    if (k === 0) {
      members.forEach((n, i) => { center[n.display_id] = { x: i * (NODE_W + 40), y: 0 }; angle[n.display_id] = 0; });
      continue;
    }
    // Направление к соседям внутреннего уровня (среднее по кругу); без них — порядок как есть.
    const toward = (n: GraphNode) => {
      const ang = (neighbours.get(n.display_id) ?? []).filter((id) => id in angle && id in center).map((id) => angle[id]);
      if (ang.length === 0) return null;
      return Math.atan2(ang.reduce((s, a) => s + Math.sin(a), 0), ang.reduce((s, a) => s + Math.cos(a), 0));
    };
    const withDir = members.map((n, i) => ({ n, dir: toward(n), i }));
    withDir.sort((a, b) => (a.dir ?? -Math.PI + a.i * 1e-6) - (b.dir ?? -Math.PI + b.i * 1e-6));
    radius = Math.max(radius + RING_GAP, (members.length * ARC) / (2 * Math.PI));
    const step = (2 * Math.PI) / members.length;
    // Поворот кольца: подгоняем равномерные углы под направления родителей.
    const known = withDir.map((w, i) => (w.dir === null ? null : w.dir - (-Math.PI / 2 + i * step))).filter((d): d is number => d !== null);
    const offset = known.length ? Math.atan2(known.reduce((s, d) => s + Math.sin(d), 0), known.reduce((s, d) => s + Math.cos(d), 0)) : 0;
    withDir.forEach((w, i) => {
      const a = -Math.PI / 2 + offset + i * step;
      angle[w.n.display_id] = a;
      center[w.n.display_id] = { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
    });
  }
  const xs = Object.values(center).map((p) => p.x);
  const ys = Object.values(center).map((p) => p.y);
  const minX = Math.min(...xs, 0) - NODE_W / 2;
  const minY = Math.min(...ys, 0) - NODE_H / 2;
  const positions: Record<string, Point> = {};
  for (const [id, c] of Object.entries(center)) positions[id] = { x: c.x - NODE_W / 2 - minX, y: c.y - NODE_H / 2 - minY };
  return {
    positions,
    width: Math.max(NODE_W, Math.max(...xs, 0) + NODE_W / 2 - minX),
    height: Math.max(NODE_H, Math.max(...ys, 0) + NODE_H / 2 - minY),
  };
}
