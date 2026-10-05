import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoGraph } from '@/features/pth/fixtures';
import { FlowGraph } from './FlowGraph';

const meta = {
  title: 'PTH/Граф/FlowGraph',
  component: FlowGraph,
  args: {
    nodes: demoGraph.nodes,
    edges: demoGraph.edges,
    focus: demoGraph.focus,
    selected: null,
    onSelect: () => {},
    onFollowEdge: () => {},
  },
} satisfies Meta<typeof FlowGraph>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithSelection: Story = { args: { selected: 'PTH-FR-002' } };
