import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField, TextareaField } from './TextField';

const meta = {
  title: 'X07 Примитивы/TextField и Textarea',
  component: TextField,
  parameters: {
    docs: {
      description: {
        component:
          'Label связан с полем, подсказка и ошибка доступны через описание. ' +
          'Введённое значение не исчезает при ошибке.',
      },
    },
  },
  args: { label: 'Название' },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

function FieldStatesDemo() {
  const [value, setValue] = useState('Исследование рынка');
  return (
    <div className="flex max-w-96 flex-col gap-6">
      <TextField
        label="Название"
        value={value}
        hint="Одинаковые названия допустимы."
        counter={`${value.length} / 120`}
        onChange={(event) => setValue(event.target.value)}
      />
      <TextField
        label="Название"
        value="Пространство"
        error="Такое название отклонено сервером."
        onChange={() => {}}
      />
      <TextField
        label="Название"
        value=""
        disabled
        onChange={() => {}}
        hint="Нет права изменять."
      />
      <TextareaField
        label="Описание"
        rows={3}
        defaultValue="Материалы и решения по анализу конкурентов."
        counter="52 / 1000"
      />
    </div>
  );
}

export const Состояния: Story = {
  render: () => <FieldStatesDemo />,
};

export const УзкийКонтейнер: Story = {
  render: () => (
    <div className="w-[280px]">
      <TextField
        label="Поиск по чатам пространства"
        placeholder="Поиск по чатам"
        hint="Поиск выполняется только в доступном наборе пространства."
      />
    </div>
  ),
};
