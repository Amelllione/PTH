import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import {
  BaseEdge, Background, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, Handle, Position, getStraightPath, useInternalNode,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from '@xyflow/react';
import type { GraphEdge, GraphNode } from '@/entities/pth/types';
import { REASON_LABEL } from '@/entities/pth/types';
import { chainTo } from './collapse';
import { layoutGraph, layoutLevels, NODE_H, NODE_W, type GraphLayoutMode } from './layout';
import { CopyId } from '@/shared/ui/CopyId';

export interface ReqNodeData extends Record<string, unknown> {
  displayId: string;
  type: string;
  title: string;
  lost: boolean;
  notImplemented: boolean;
  reasons: GraphNode['reasons'];
  focus: boolean;
  selected: boolean;
  /** Номер уровня от центра; показывается в режиме «по уровням». */
  level: number | null;
  /** Подсветка цепочки: true — узел на цепочке, false — приглушён, null — подсветки нет. */
  onChain: boolean | null;
  collapsed: GraphNode['collapsed'] | null;
}

/** Узел графа: тип, ID, название; потеря — текстом «Потерян» и пунктирной рамкой (не только цветом). */
function ReqNode({ data }: NodeProps<Node<ReqNodeData>>) {
  const d = data;
  const border = d.selected ? 'var(--focus)' : d.onChain ? 'var(--accent-text)' : d.lost ? 'var(--danger-text)' : 'var(--border)';
  const dim = d.onChain === false ? 0.3 : 1;
  if (d.collapsed) {
    return (
      <div role="button" tabIndex={0} aria-label={`Свёрнут уровень ${d.collapsed.level}: ${d.collapsed.count} узлов. Нажмите, чтобы развернуть`}
        className="flex flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed bg-surface-muted p-2 text-center text-text"
        style={{ width: NODE_W, minHeight: NODE_H, borderColor: 'var(--control-border)', opacity: dim }}>
        <Handle type="target" position={Position.Left} isConnectable={false} />
        <span className="text-ui font-semibold">▸ Уровень {d.collapsed.level}: {d.collapsed.count}</span>
        <span className="text-meta text-text-muted">{d.collapsed.deeper > 0 ? `и глубже ещё ${d.collapsed.deeper}` : 'развернуть'}</span>
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </div>
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${d.displayId}, ${d.title}${d.lost ? `, ${REASON_LABEL.no_reflection}` : d.notImplemented ? `, ${REASON_LABEL.no_code_link}` : ''}`}
      className="flex flex-col gap-1 rounded-card bg-surface p-2 text-text shadow-sm"
      style={{ opacity: dim, width: NODE_W, minHeight: NODE_H, border: `${d.selected || d.focus || d.onChain ? 2.5 : 1}px ${d.lost ? 'dashed' : 'solid'} ${border}` }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="flex items-center gap-2">
        <span className="rounded-control bg-accent-soft px-1.5 text-meta font-semibold text-accent-text">{d.type}</span>
        <CopyId className="min-w-0" value={d.displayId}><span className="truncate font-mono text-meta text-text-muted">{d.displayId}</span></CopyId>
        {d.focus && <span className="ml-auto text-meta text-focus">центр</span>}
        {!d.focus && d.level !== null && <span className="ml-auto text-meta text-text-muted">ур. {d.level}</span>}
      </div>
      <div className="text-ui leading-snug">{d.title.length > 60 ? `${d.title.slice(0, 59)}…` : d.title}</div>
      {d.lost && <div className="text-meta font-semibold text-danger-text">Потерян</div>}
      {!d.lost && d.notImplemented && <div className="text-meta font-semibold text-info-text">Не реализован</div>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

/** Точка на границе прямоугольника узла по направлению к другой точке: ребро упирается в край узла, а не в его центр. */
function borderPoint(node: { x: number; y: number; w: number; h: number }, toward: { x: number; y: number }) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const k = 1 / Math.max(Math.abs(dx) / (node.w / 2), Math.abs(dy) / (node.h / 2));
  return { x: cx + dx * k, y: cy + dy * k };
}

/** Прямое ребро между краями узлов для раскладки по уровням, где узлы стоят вокруг центра, а не в рядах. */
function FloatingEdge({ id, source, target, markerEnd, style, label, labelStyle }: EdgeProps) {
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s || !t) return null;
  const rect = (n: typeof s) => ({ x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? NODE_W, h: n.measured.height ?? NODE_H });
  const a = rect(s);
  const b = rect(t);
  const from = borderPoint(a, { x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const to = borderPoint(b, { x: a.x + a.w / 2, y: a.y + a.h / 2 });
  const [path, labelX, labelY] = getStraightPath({ sourceX: from.x, sourceY: from.y, targetX: to.x, targetY: to.y });
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} label={label} labelX={labelX} labelY={labelY} labelStyle={labelStyle} labelBgStyle={{ fill: 'var(--surface)' }} />;
}

export const nodeTypes = { req: ReqNode };
const edgeTypes = { floating: FloatingEdge };

/** Цвета React Flow берём из токенов темы, иначе миникарта и кнопки остаются светлыми в тёмной теме. */
const FLOW_THEME = {
  '--xy-background-color-default': 'var(--canvas)',
  '--xy-controls-button-background-color-default': 'var(--surface)',
  '--xy-controls-button-background-color-hover-default': 'var(--surface-muted)',
  '--xy-controls-button-color-default': 'var(--text)',
  '--xy-controls-button-border-color-default': 'var(--border)',
  '--xy-minimap-background-color-default': 'var(--surface)',
  '--xy-minimap-mask-background-color-default': 'color-mix(in srgb, var(--canvas) 70%, transparent)',
  '--xy-minimap-node-background-color-default': 'var(--accent-soft)',
  '--xy-edge-label-background-color-default': 'var(--surface)',
  '--xy-edge-label-color-default': 'var(--text-muted)',
} as React.CSSProperties;

export interface FlowGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focus: string;
  selected: string | null;
  onSelect: (displayId: string) => void;
  /** Клик по связи: переход к элементу на другом конце. */
  onFollowEdge?: (displayId: string) => void;
  height?: number;
  /** links — слои по направлению связей (Dagre); levels — окружности вокруг центра по расстоянию в связях. */
  layoutMode?: GraphLayoutMode;
  /** Подсвечивать кратчайшую цепочку от центра до выбранного узла, остальное приглушить. */
  highlightChain?: boolean;
  /** Граф целиком (с центром): нужен для поиска цепочки. */
  focusId?: string;
}

function FlowGraphInner({ nodes, edges, focus, selected, onSelect, onFollowEdge, height = 520, layoutMode = 'links', highlightChain = false }: FlowGraphProps) {
  const chain = useMemo(() => (highlightChain && selected ? chainTo({ focus, nodes, edges, truncated: false }, selected) : null), [highlightChain, selected, focus, nodes, edges]);
  const layout = useMemo(() => (layoutMode === 'levels' ? layoutLevels(nodes, edges, focus) : layoutGraph(nodes, edges, focus)), [nodes, edges, focus, layoutMode]);
  const flowNodes: Node<ReqNodeData>[] = useMemo(() => nodes.map((n) => ({
    id: n.display_id,
    type: 'req',
    position: layout.positions[n.display_id] ?? { x: 0, y: 0 },
    data: {
      displayId: n.display_id, type: n.type, title: n.title, lost: n.lost, notImplemented: n.not_implemented, reasons: n.reasons,
      focus: n.display_id === focus, selected: n.display_id === selected, level: layoutMode === 'levels' && !n.collapsed ? (n.level ?? null) : null,
      onChain: chain ? chain.nodes.has(n.display_id) : null, collapsed: n.collapsed ?? null,
    },
    selected: n.display_id === selected,
  })), [nodes, layout, focus, selected, layoutMode, chain]);
  const flowEdges: Edge[] = useMemo(() => edges.map((e) => ({
    id: `${e.type}:${e.source}->${e.target}`,
    type: layoutMode === 'levels' ? 'floating' : undefined,
    source: e.source,
    target: e.target,
    label: e.type,
    labelStyle: { fill: 'var(--text-muted)', fontSize: 12 },
    labelBgStyle: { fill: 'var(--surface)' },
    style: chain && chain.edges.has(`${e.type}:${e.source}->${e.target}`)
      ? { stroke: 'var(--accent-text)', strokeWidth: 3 }
      : { stroke: 'var(--control-border)', strokeWidth: 1.5, opacity: chain ? 0.25 : 1 },
    markerEnd: { type: MarkerType.ArrowClosed, color: chain && chain.edges.has(`${e.type}:${e.source}->${e.target}`) ? 'var(--accent-text)' : 'var(--control-border)' },
    interactionWidth: 24,
  })), [edges, layoutMode, chain]);

  return (
    <div style={{ height, ...FLOW_THEME }} className="overflow-hidden rounded-card border border-border bg-canvas" aria-label="Граф трассировки">
      <ReactFlow
        key={`${focus}:${nodes.length}:${edges.length}:${layoutMode}`}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => onSelect(node.id)}
        onEdgeClick={(_, edge) => onFollowEdge?.(edge.target)}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
      >
        <Background gap={16} color="var(--border)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable style={{ width: 132, height: 84 }} nodeColor={(n) => ((n.data as ReqNodeData).lost ? 'var(--danger-text)' : 'var(--accent-soft)')} />
      </ReactFlow>
    </div>
  );
}

/** Граф трассировки на React Flow: масштаб, перемещение, миникарта, выбор и переход по связям. */
export function FlowGraph(props: FlowGraphProps) {
  return (
    <ReactFlowProvider>
      <FlowGraphInner {...props} />
    </ReactFlowProvider>
  );
}
