import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoArtifact } from '@/features/pth/fixtures';
import { NodeDetailsPanel } from './NodeDetailsPanel';

const relations = [
  { direction: 'out' as const, type: 'refines' as const, displayId: 'PTH-US-001' },
];

const meta = {
  title: 'PTH/Граф/NodeDetailsPanel',
  component: NodeDetailsPanel,
  args: {
    detail: demoArtifact,
    relations,
    lostReasons: ['no_code_link'],
    onFocus: () => {},
    onOpenRelation: () => {},
  },
} satisfies Meta<typeof NodeDetailsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Lost: Story = {};

export const WithRevisions: Story = {
  args: {
    revisions: [
      { number: 1, title: 'Граф связей', text: '', attributes: {}, exemption_reason: null, created_at: '2026-10-01T09:00:00Z' },
      { number: 2, title: 'Граф связей с фильтрами', text: '', attributes: {}, exemption_reason: null, created_at: '2026-10-03T12:00:00Z' },
      { number: 3, title: 'Граф связей с фильтрами', text: '', attributes: {}, exemption_reason: 'вне первого релиза', created_at: '2026-10-04T10:00:00Z' },
    ],
  },
};

export const Normal: Story = { args: { lostReasons: [] } };

export const Loading: Story = { args: { detail: null, loading: true } };

export const Failed: Story = { args: { detail: null, error: 'Сервер недоступен' } };

export const NothingSelected: Story = { args: { detail: null, relations: [] } };
