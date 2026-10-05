import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChangeSet } from '@/entities/pth/types';
import { ChangeSetList } from './ChangeSetList';

const draft: ChangeSet = {
  uid: 'cs-1', title: 'Импорт spec-v0.2.md', state: 'draft', operations: [], operation_count: 6,
  last_error: null, created_at: '2026-10-05T09:00:00Z', applied_at: null,
};
const failed: ChangeSet = { ...draft, uid: 'cs-2', title: 'Импорт broken.md', last_error: 'Цель связи PTH-FR-999 не существует' };
const applied: ChangeSet = { ...draft, uid: 'cs-3', title: 'Импорт spec-v0.1.md', state: 'applied', applied_at: '2026-10-05T09:05:00Z' };

const meta = {
  title: 'PTH/Импорт/ChangeSetList',
  component: ChangeSetList,
  args: { items: [draft, failed, applied], applyingUid: null, onApply: () => {} },
} satisfies Meta<typeof ChangeSetList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};
export const Applying: Story = { args: { applyingUid: 'cs-1' } };
export const Empty: Story = { args: { items: [] } };

export const Editable: Story = {
  args: { onSave: async () => {} },
};
