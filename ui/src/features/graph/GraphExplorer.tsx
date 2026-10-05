import { useMemo, useState } from 'react';
import type { ArtifactDetail, GraphData, RevisionItem } from '@/entities/pth/types';
import { InlineAlert } from '@/shared/ui';
import { FlowGraph } from './FlowGraph';
import { NodeDetailsPanel, type NodeRelation } from './NodeDetailsPanel';

export interface GraphExplorerProps {
  graph: GraphData;
  selected: string | null;
  detail: ArtifactDetail | null;
  detailLoading?: boolean;
  detailError?: string | null;
  revisions?: RevisionItem[] | null;
  onSelect: (displayId: string) => void;
  onFocus: (displayId: string) => void;
  /** Переход по ребру: центр не меняется, выбирается соседний элемент. */
  onFollowEdge?: (displayId: string) => void;
}

/**
 * Граф с панелью деталей. Фильтр «только потерянные» оставляет потерянные узлы и их соседей,
 * чтобы контекст потери был виден. Усечение подграфа показывается явно.
 */
export function GraphExplorer({
  graph,
  selected,
  detail,
  detailLoading,
  detailError,
  revisions,
  onSelect,
  onFocus,
  onFollowEdge,
}: GraphExplorerProps) {
  const [onlyLost, setOnlyLost] = useState(false);

  const visible = useMemo(() => {
    if (!onlyLost) return graph;
    const lostIds = new Set(graph.nodes.filter((n) => n.lost).map((n) => n.display_id));
    const keep = new Set(lostIds);
    for (const edge of graph.edges) {
      if (lostIds.has(edge.source)) keep.add(edge.target);
      if (lostIds.has(edge.target)) keep.add(edge.source);
    }
    keep.add(graph.focus);
    return {
      ...graph,
      nodes: graph.nodes.filter((n) => keep.has(n.display_id)),
      edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    };
  }, [graph, onlyLost]);

  const relations: NodeRelation[] = selected
    ? graph.edges.flatMap((edge): NodeRelation[] => {
        if (edge.source === selected) return [{ direction: 'out', type: edge.type, displayId: edge.target }];
        if (edge.target === selected) return [{ direction: 'in', type: edge.type, displayId: edge.source }];
        return [];
      })
    : [];
  const selectedNode = graph.nodes.find((n) => n.display_id === selected);

  return (
    <div className="flex flex-col gap-3">
      {graph.truncated && (
        <InlineAlert
          tone="warning"
          message="Подграф обрезан по лимиту узлов. Уменьшите глубину или откройте полный список потерянных элементов."
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-ui text-text">
          <input type="checkbox" checked={onlyLost} onChange={(e) => setOnlyLost(e.target.checked)} />
          Только потерянные (с соседями)
        </label>
        <span className="text-meta text-text-muted">
          узлов: {visible.nodes.length}, связей: {visible.edges.length}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <FlowGraph
          nodes={visible.nodes}
          edges={visible.edges}
          focus={graph.focus}
          selected={selected}
          onSelect={onSelect}
          onFollowEdge={onFollowEdge ?? onSelect}
        />
        <aside aria-label="Детали узла" className="rounded-card border border-border bg-surface p-4">
          <NodeDetailsPanel
            detail={detail}
            loading={detailLoading}
            error={detailError}
            relations={relations}
            lostReasons={selectedNode?.reasons}
            revisions={revisions}
            onFocus={onFocus}
            onOpenRelation={onSelect}
          />
        </aside>
      </div>
    </div>
  );
}
