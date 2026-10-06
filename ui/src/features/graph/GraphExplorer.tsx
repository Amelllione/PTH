import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import type { ArtifactDetail, GraphData, RevisionItem } from '@/entities/pth/types';
import { InlineAlert } from '@/shared/ui';
import { FlowGraph } from './FlowGraph';
import { collapseFrom, COLLAPSED_ID } from './collapse';
import type { GraphLayoutMode } from './layout';
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
  /** Сколько уровней от центра показано и как они разложены. */
  depth: number;
  onDepth: (depth: number) => void;
  layoutMode: GraphLayoutMode;
  onLayoutMode: (mode: GraphLayoutMode) => void;
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
  depth,
  onDepth,
  layoutMode,
  onLayoutMode,
}: GraphExplorerProps) {
  const [onlyLost, setOnlyLost] = useState(false);
  // Свёрнуть граф начиная с этого уровня: уровень превращается в счётчик, нажатие на него раскрывает следующий шаг.
  const [collapseAt, setCollapseAt] = useState<number | null>(null);
  const [chain, setChain] = useState(true);

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
  const maxLevel = Math.max(0, ...visible.nodes.map((n) => n.level ?? 0));
  const shown = useMemo(() => collapseFrom(visible, collapseAt !== null && collapseAt <= maxLevel ? collapseAt : null), [visible, collapseAt, maxLevel]);
  // Свёртка относится к конкретному графу: у другого центра или меньшей глубины такого уровня может не быть, и список выбора показывал бы пустое значение.
  useEffect(() => { setCollapseAt(null); }, [graph.focus]);
  useEffect(() => { if (collapseAt !== null && collapseAt > maxLevel) setCollapseAt(null); }, [collapseAt, maxLevel]);
  const expandOne = () => setCollapseAt((k) => (k !== null && k + 1 <= maxLevel ? k + 1 : null));

  const relations: NodeRelation[] = selected
    ? graph.edges.flatMap((edge): NodeRelation[] => {
        if (edge.source === selected) return [{ direction: 'out', type: edge.type, displayId: edge.target }];
        if (edge.target === selected) return [{ direction: 'in', type: edge.type, displayId: edge.source }];
        return [];
      })
    : [];
  const selectedNode = graph.nodes.find((n) => n.display_id === selected);
  // Сколько узлов на каждом уровне: «0:1, 1:3, 2:7»
  const levelCounts = new Map<number, number>();
  for (const n of visible.nodes) levelCounts.set(n.level ?? 0, (levelCounts.get(n.level ?? 0) ?? 0) + 1);
  const levelSummary = [...levelCounts.entries()].sort((a, b) => a[0] - b[0]).map(([l, c]) => `${l}: ${c}`).join(', ');

  return (
    <div className="flex flex-col gap-3">
      {graph.truncated && (
        <InlineAlert
          tone="warning"
          message="Подграф обрезан по лимиту узлов. Уменьшите глубину или откройте полный список потерянных элементов."
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-ui text-text">Уровней от центра
          <select value={depth} onChange={(e) => onDepth(Number(e.target.value))} className="h-8 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Раскладка" className="inline-flex overflow-hidden rounded-control border border-control-border">
          {([['links', 'По связям'], ['levels', 'По уровням от центра']] as const).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={layoutMode === m} onClick={() => onLayoutMode(m)}
              className={`px-3 py-1.5 text-ui ${layoutMode === m ? 'bg-accent-soft text-accent-text' : 'bg-surface text-text-muted hover:bg-surface-muted'}`}>{label}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-ui text-text">Свернуть с уровня
          <select value={collapseAt ?? ''} onChange={(e) => setCollapseAt(e.target.value === '' ? null : Number(e.target.value))} disabled={maxLevel < 1}
            className="h-8 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
            <option value="">не сворачивать</option>
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-ui text-text">
          <input type="checkbox" checked={chain} onChange={(e) => setChain(e.target.checked)} />
          Подсвечивать цепочку до выбранного
        </label>
        <label className="flex items-center gap-2 text-ui text-text">
          <input type="checkbox" checked={onlyLost} onChange={(e) => setOnlyLost(e.target.checked)} />
          Только потерянные (с соседями)
        </label>
        <span className="text-meta text-text-muted">
          узлов: {visible.nodes.length}, связей: {visible.edges.length}{levelSummary ? ` · по уровням: ${levelSummary}` : ''}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <GraphGuard resetKey={`${graph.focus}:${depth}:${layoutMode}:${collapseAt}`} onReset={() => setCollapseAt(null)}>
        <FlowGraph
          nodes={shown.nodes}
          edges={shown.edges}
          highlightChain={chain}
          focus={graph.focus}
          selected={selected}
          onSelect={(id) => (id === COLLAPSED_ID ? expandOne() : onSelect(id))}
          onFollowEdge={(id) => (id === COLLAPSED_ID ? expandOne() : (onFollowEdge ?? onSelect)(id))}
          layoutMode={layoutMode}
          height={layoutMode === 'levels' ? 760 : 520}
        />
        </GraphGuard>
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

/** Ошибка отрисовки графа не должна ронять весь экран: показывается текст ошибки и кнопка сброса свёртки. */
class GraphGuard extends Component<{ resetKey: string; onReset: () => void; children: ReactNode }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) { return { error }; }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: Error | null; key: string }) {
    // Другие параметры графа: пробуем отрисовать заново
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Граф не отрисовался', error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-ui">
        <p className="font-semibold text-danger-text">Граф не удалось отрисовать</p>
        <p className="font-mono text-meta text-text-muted">{this.state.error.message}</p>
        <div><button type="button" className="rounded-control border border-control-border px-3 py-1.5 text-ui" onClick={() => { this.props.onReset(); this.setState({ error: null }); }}>Сбросить свёртку и повторить</button></div>
      </div>
    );
  }
}
