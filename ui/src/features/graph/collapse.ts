import type { GraphData, GraphEdge, GraphNode } from '@/entities/pth/types';

export const COLLAPSED_ID = '__collapsed';

/**
 * Сворачивает граф начиная с уровня from: узлы этого уровня заменяются одним счётчиком, всё глубже скрывается.
 * Рёбра от видимых узлов к свёрнутым сходятся на счётчике (по одному на пару и тип).
 */
export function collapseFrom(graph: GraphData, from: number | null): GraphData {
  if (from === null) return graph;
  const level = (n: GraphNode) => n.level ?? 0;
  const atLevel = graph.nodes.filter((n) => level(n) === from);
  if (atLevel.length === 0) return graph;
  const deeper = graph.nodes.filter((n) => level(n) > from).length;
  const hidden = new Set(graph.nodes.filter((n) => level(n) >= from).map((n) => n.display_id));
  const counter: GraphNode = {
    display_id: COLLAPSED_ID, type: 'GROUP', title: '', lost: false, not_implemented: false, reasons: [], level: from,
    collapsed: { level: from, count: atLevel.length, deeper },
  };
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const e of graph.edges) {
    const s = hidden.has(e.source);
    const t = hidden.has(e.target);
    if (s && t) continue;
    const mapped: GraphEdge = { type: e.type, source: s ? COLLAPSED_ID : e.source, target: t ? COLLAPSED_ID : e.target };
    const key = `${mapped.type}:${mapped.source}->${mapped.target}`;
    if (!seen.has(key)) { seen.add(key); edges.push(mapped); }
  }
  return { ...graph, nodes: [...graph.nodes.filter((n) => level(n) < from), counter], edges };
}

/** Кратчайшая цепочка от центра до узла по связям без учёта направления: узлы и рёбра. null — не достижим. */
export function chainTo(graph: GraphData, target: string): { nodes: Set<string>; edges: Set<string> } | null {
  if (target === graph.focus) return null;
  const adj = new Map<string, { to: string; id: string }[]>();
  for (const e of graph.edges) {
    const id = `${e.type}:${e.source}->${e.target}`;
    adj.set(e.source, [...(adj.get(e.source) ?? []), { to: e.target, id }]);
    adj.set(e.target, [...(adj.get(e.target) ?? []), { to: e.source, id }]);
  }
  const prev = new Map<string, { from: string; id: string }>();
  const queue = [graph.focus];
  const seen = new Set([graph.focus]);
  while (queue.length) {
    const cur = queue.shift() as string;
    if (cur === target) break;
    for (const n of adj.get(cur) ?? []) {
      if (seen.has(n.to)) continue;
      seen.add(n.to);
      prev.set(n.to, { from: cur, id: n.id });
      queue.push(n.to);
    }
  }
  if (!prev.has(target)) return null;
  const nodes = new Set<string>([target]);
  const edges = new Set<string>();
  for (let cur = target; cur !== graph.focus;) {
    const p = prev.get(cur) as { from: string; id: string };
    nodes.add(p.from);
    edges.add(p.id);
    cur = p.from;
  }
  return { nodes, edges };
}
