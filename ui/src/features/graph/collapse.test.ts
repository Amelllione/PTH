import { describe, expect, it } from 'vitest';
import type { GraphData, GraphNode } from '@/entities/pth/types';
import { chainTo, collapseFrom, COLLAPSED_ID } from './collapse';

const n = (id: string, level: number): GraphNode => ({ display_id: id, type: 'FR', title: id, lost: false, not_implemented: false, reasons: [], level });
const graph: GraphData = {
  focus: 'C', truncated: false,
  nodes: [n('C', 0), n('A', 1), n('B', 1), n('A1', 2), n('A2', 2), n('B1', 2), n('Z', 3)],
  edges: [
    { type: 'refines', source: 'A', target: 'C' }, { type: 'refines', source: 'B', target: 'C' },
    { type: 'refines', source: 'A1', target: 'A' }, { type: 'refines', source: 'A2', target: 'A' },
    { type: 'refines', source: 'B1', target: 'B' }, { type: 'refines', source: 'Z', target: 'A1' },
  ],
};

describe('collapseFrom', () => {
  it('без уровня возвращает граф как есть', () => {
    expect(collapseFrom(graph, null)).toBe(graph);
  });

  it('уровень превращается в один счётчик, глубже скрыто и посчитано', () => {
    const g = collapseFrom(graph, 2);
    expect(g.nodes.map((x) => x.display_id)).toEqual(['C', 'A', 'B', COLLAPSED_ID]);
    expect(g.nodes[3].collapsed).toEqual({ level: 2, count: 3, deeper: 1 });
    // A1, A2 → один счётчик у A; B1 → у B; связей между скрытыми узлами нет
    expect(g.edges.filter((e) => e.source === COLLAPSED_ID).map((e) => e.target).sort()).toEqual(['A', 'B']);
    expect(g.edges.every((e) => e.source !== 'Z' && e.target !== 'Z')).toBe(true);
  });

  it('не создаёт дублей рёбер при нескольких скрытых узлах под одним', () => {
    const g = collapseFrom(graph, 2);
    // A1→A и A2→A сходятся в одно ребро «счётчик → A»
    expect(g.edges.filter((e) => e.target === 'A').length).toBe(1);
  });

  it('уровень выше максимального ничего не меняет', () => {
    expect(collapseFrom(graph, 9)).toBe(graph);
  });
});

describe('chainTo', () => {
  it('находит цепочку от центра до глубокого узла', () => {
    const chain = chainTo(graph, 'Z');
    expect([...(chain?.nodes ?? [])].sort()).toEqual(['A', 'A1', 'C', 'Z']);
    expect(chain?.edges.size).toBe(3);
  });

  it('для центра и недостижимого узла цепочки нет', () => {
    expect(chainTo(graph, 'C')).toBeNull();
    expect(chainTo({ ...graph, edges: [] }, 'Z')).toBeNull();
  });
});
