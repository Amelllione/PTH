import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '@/entities/pth/types';
import { layoutGraph, layoutLevels, NODE_H, NODE_W } from './layout';

const node = (id: string): GraphNode => ({ display_id: id, type: 'FR', title: id, lost: false, not_implemented: false, reasons: [] });

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

describe('layoutLevels (уровни от центра)', () => {
  const lv = (id: string, level: number): GraphNode => ({ ...node(id), level });
  const nodes = [lv('C', 0), lv('A', 1), lv('B', 1), lv('D', 1), lv('A1', 2), lv('A2', 2), lv('B1', 2), lv('Z', 3)];
  const edges: GraphEdge[] = [
    { type: 'refines', source: 'A', target: 'C' }, { type: 'refines', source: 'B', target: 'C' }, { type: 'refines', source: 'D', target: 'C' },
    { type: 'refines', source: 'A1', target: 'A' }, { type: 'refines', source: 'A2', target: 'A' }, { type: 'refines', source: 'B1', target: 'B' },
    { type: 'refines', source: 'Z', target: 'A1' },
  ];
  const mid = (p: { x: number; y: number }) => ({ x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 });
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('каждый следующий уровень дальше от центра, чем предыдущий', () => {
    const { positions } = layoutLevels(nodes, edges, 'C');
    const c = mid(positions.C);
    const r = (ids: string[]) => Math.min(...ids.map((id) => dist(mid(positions[id]), c)));
    expect(r(['A', 'B', 'D'])).toBeGreaterThan(0);
    expect(r(['A1', 'A2', 'B1'])).toBeGreaterThan(Math.max(...['A', 'B', 'D'].map((id) => dist(mid(positions[id]), c))));
    expect(dist(mid(positions.Z), c)).toBeGreaterThan(Math.max(...['A1', 'A2', 'B1'].map((id) => dist(mid(positions[id]), c))));
  });

  it('узлы одного кольца лежат на одном расстоянии от центра и не накладываются', () => {
    const { positions } = layoutLevels(nodes, edges, 'C');
    const c = mid(positions.C);
    const ring = ['A1', 'A2', 'B1'].map((id) => dist(mid(positions[id]), c));
    expect(Math.max(...ring) - Math.min(...ring)).toBeLessThan(1);
    const ids = nodes.map((n) => n.display_id);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) expect(overlaps(positions[ids[i]], positions[ids[j]])).toBe(false);
  });

  it('потомки стоят в стороне своего родителя', () => {
    const { positions } = layoutLevels(nodes, edges, 'C');
    const c = mid(positions.C);
    const ang = (id: string) => Math.atan2(mid(positions[id]).y - c.y, mid(positions[id]).x - c.x);
    const diff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    expect(diff(ang('A1'), ang('A'))).toBeLessThan(diff(ang('A1'), ang('B')));
  });
});
