import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '@/entities/pth/types';
import { layoutGraph, NODE_H, NODE_W } from './layout';

const node = (id: string): GraphNode => ({ display_id: id, type: 'FR', title: id, lost: false, reasons: [] });

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;

describe('layoutGraph (Dagre, слоями слева направо)', () => {
  const ids = ['US-1', 'FR-1', 'FR-2', 'AC-1', 'ADR-1'];
  const nodes = ids.map(node);
  const edges: GraphEdge[] = [
    { type: 'refines', source: 'FR-1', target: 'US-1' },
    { type: 'refines', source: 'FR-2', target: 'US-1' },
    { type: 'refines', source: 'AC-1', target: 'FR-1' },
    { type: 'motivates', source: 'US-1', target: 'ADR-1' },
  ];

  it('ставит каждый узел и не даёт им накладываться', () => {
    const { positions } = layoutGraph(nodes, edges, 'US-1');
    for (const id of ids) expect(positions[id]).toBeDefined();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        expect(overlaps(positions[ids[i]], positions[ids[j]])).toBe(false);
      }
    }
  });

  it('связь идёт слева направо: источник левее цели', () => {
    const { positions } = layoutGraph(nodes, edges, 'US-1');
    for (const e of edges) {
      expect(positions[e.source].x).toBeLessThan(positions[e.target].x);
    }
  });

  it('не падает на пустом графе и даёт ненулевой холст', () => {
    const layout = layoutGraph([], [], 'A');
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.positions).toEqual({});
  });

  it('несвязанный узел тоже размещён и не накладывается', () => {
    const extra = [...nodes, node('LONE')];
    const { positions } = layoutGraph(extra, edges, 'US-1');
    expect(positions.LONE).toBeDefined();
    for (const id of ids) expect(overlaps(positions.LONE, positions[id])).toBe(false);
  });
});
