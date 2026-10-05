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
