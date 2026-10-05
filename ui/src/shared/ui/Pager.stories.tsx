import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pager } from './Pager';

const meta = {
  title: 'PTH/Пагинация/Pager',
  component: Pager,
  args: { page: 0, pageSize: 50, total: 140, onPage: () => {}, onPageSize: () => {} },
} satisfies Meta<typeof Pager>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {};
export const Middle: Story = { args: { page: 1 } };
export const Empty: Story = { args: { total: 0 } };
