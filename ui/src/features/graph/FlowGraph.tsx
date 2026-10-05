import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import {
  Background, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, Handle, Position,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import type { GraphEdge, GraphNode } from '@/entities/pth/types';
import { REASON_LABEL } from '@/entities/pth/types';
import { layoutGraph, NODE_H, NODE_W } from './layout';

export interface ReqNodeData extends Record<string, unknown> {
  displayId: string;
  type: string;
  title: string;
  lost: boolean;
  reasons: GraphNode['reasons'];
  focus: boolean;
  selected: boolean;
}

/** Узел графа: тип, ID, название; потеря — текстом «Потерян» и пунктирной рамкой (не только цветом). */
function ReqNode({ data }: NodeProps<Node<ReqNodeData>>) {
  const d = data;
  const border = d.selected ? 'var(--focus)' : d.lost ? 'var(--danger-text)' : 'var(--border)';
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${d.displayId}, ${d.title}${d.lost ? `, потерян: ${d.reasons.map((r) => REASON_LABEL[r]).join('; ')}` : ''}`}
      className="flex flex-col gap-1 rounded-card bg-surface p-2 text-text shadow-sm"
      style={{ width: NODE_W, minHeight: NODE_H, border: `${d.selected || d.focus ? 2.5 : 1}px ${d.lost ? 'dashed' : 'solid'} ${border}` }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="flex items-center gap-2">
        <span className="rounded-control bg-accent-soft px-1.5 text-meta font-semibold text-accent-text">{d.type}</span>
        <span className="truncate font-mono text-meta text-text-muted">{d.displayId}</span>
        {d.focus && <span className="ml-auto text-meta text-focus">центр</span>}
      </div>
      <div className="text-ui leading-snug">{d.title.length > 60 ? `${d.title.slice(0, 59)}…` : d.title}</div>
      {d.lost && <div className="text-meta font-semibold text-danger-text">Потерян</div>}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

export const nodeTypes = { req: ReqNode };

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
}

function FlowGraphInner({ nodes, edges, focus, selected, onSelect, onFollowEdge, height = 520 }: FlowGraphProps) {
  const layout = useMemo(() => layoutGraph(nodes, edges, focus), [nodes, edges, focus]);
  const flowNodes: Node<ReqNodeData>[] = useMemo(() => nodes.map((n) => ({
    id: n.display_id,
    type: 'req',
    position: layout.positions[n.display_id] ?? { x: 0, y: 0 },
    data: {
      displayId: n.display_id, type: n.type, title: n.title, lost: n.lost, reasons: n.reasons,
      focus: n.display_id === focus, selected: n.display_id === selected,
    },
    selected: n.display_id === selected,
  })), [nodes, layout, focus, selected]);
  const flowEdges: Edge[] = useMemo(() => edges.map((e) => ({
    id: `${e.type}:${e.source}->${e.target}`,
    source: e.source,
    target: e.target,
    label: e.type,
    labelStyle: { fill: 'var(--text-muted)', fontSize: 12 },
    labelBgStyle: { fill: 'var(--surface)' },
    style: { stroke: 'var(--control-border)', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--control-border)' },
    interactionWidth: 24,
  })), [edges]);

  return (
    <div style={{ height, ...FLOW_THEME }} className="overflow-hidden rounded-card border border-border bg-canvas" aria-label="Граф трассировки">
      <ReactFlow
        key={`${focus}:${nodes.length}:${edges.length}`}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
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
