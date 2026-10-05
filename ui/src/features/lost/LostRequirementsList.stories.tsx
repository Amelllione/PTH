import type { Meta, StoryObj } from '@storybook/react-vite';
import { lostItems } from '@/features/pth/fixtures';
import { LostRequirementsList } from './LostRequirementsList';

const meta = {
  title: 'PTH/Потерянные/LostRequirementsList',
  component: LostRequirementsList,
  args: { items: lostItems, typeFilter: 'ALL', onTypeChange: () => {}, onOpen: () => {} },
} satisfies Meta<typeof LostRequirementsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { items: [] } };

export const OnlyUserStories: Story = {
  args: { typeFilter: 'US', items: lostItems.filter((i) => i.type === 'US') },
};
