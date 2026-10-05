import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';

const meta = {
  title: 'Примитивы/Avatar',
  component: Avatar,
  parameters: {
    docs: {
      description: {
        component:
          'Инициалы участника без изображения (X07). Имя всегда выводится рядом текстом, аватар ' +
          'скрыт от чтения с экрана.',
      },
    },
  },
  args: { name: 'Мария Орлова', initials: 'МО' },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Размеры: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} size="sm" />
      <Avatar {...args} size="md" />
      <Avatar {...args} size="lg" />
      <span className="text-ui text-text">{args.name}</span>
    </div>
  ),
};
