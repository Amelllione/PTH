import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'X07 Примитивы/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          'Варианты primary, secondary, ghost, danger. Состояние loading сохраняет ширину, ' +
          'иконка без текста получает доступное имя через IconButton.',
      },
    },
  },
  args: { children: 'Отправить' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Варианты: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary" />
      <Button {...args} variant="secondary" />
      <Button {...args} variant="ghost" />
      <Button {...args} variant="danger">
        Удалить
      </Button>
    </div>
  ),
};

export const Состояния: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary" />
      <Button {...args} variant="primary" loading />
      <Button {...args} variant="primary" disabled title="Введите вопрос" />
      <Button {...args} variant="secondary" size="sm">
        Малая кнопка
      </Button>
    </div>
  ),
};

export const ДлиннаяПодпись: Story = {
  args: {
    variant: 'primary',
    children: 'Сохранить решение в общей памяти рабочего пространства',
  },
  parameters: { viewport: { defaultViewport: 'w320' } },
};
