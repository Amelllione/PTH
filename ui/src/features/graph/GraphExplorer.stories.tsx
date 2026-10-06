import type { Meta, StoryObj } from '@storybook/react-vite';
import type { GraphData } from '@/entities/pth/types';
import { demoArtifact, demoGraph } from '@/features/pth/fixtures';
import { GraphExplorer } from './GraphExplorer';

const meta = {
  title: 'PTH/Граф/GraphExplorer',
  component: GraphExplorer,
  args: {
    graph: demoGraph,
    selected: 'PTH-FR-002',
    detail: demoArtifact,
    onSelect: () => {},
    onFocus: () => {},
    depth: 2,
    onDepth: () => {},
    layoutMode: 'links',
    onLayoutMode: () => {},
  },
} satisfies Meta<typeof GraphExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OnlyLost: Story = {
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
  },
};

export const Truncated: Story = {
  args: { graph: { ...demoGraph, truncated: true } satisfies GraphData },
};

export const NothingSelected: Story = { args: { selected: null, detail: null } };

/** Узлы по окружностям вокруг центра: расстояние в связях видно сразу. */
export const LevelsFromCenter: Story = { args: { layoutMode: 'levels' } };
