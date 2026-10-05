import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmActionDialog } from './ConfirmActionDialog';

const meta = {
  title: 'Компоненты/X06 ConfirmActionDialog',
  component: ConfirmActionDialog,
  parameters: {
    docs: {
      description: {
        component:
          'Единый диалог удаления, расширения аудитории и потери правок. Показывает объект и ' +
          'конкретные последствия вместо неопределённого «Вы уверены?».',
      },
    },
  },
  args: {
    open: true,
    title: 'Расширить доступ до пространства?',
    description: 'Материал станет доступен разрешённым чатам пространства для будущих запросов.',
    confirmLabel: 'Расширить доступ',
    onConfirm: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof ConfirmActionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const РасширениеАудитории: Story = {
  args: {
    affectedObjectsSummary: (
      <p className="text-ui text-text-muted">
        Аудитория: участники пространства «Исследование рынка». Исторические ссылки прежних запросов
        не переписываются.
      </p>
    ),
  },
};

export const Удаление: Story = {
  args: {
    title: 'Удалить материал «Тарифы конкурентов 2026.xlsx»?',
    description: 'Файл и его версии будут удалены. Исторические ссылки станут недоступными.',
    confirmLabel: 'Удалить материал',
    intent: 'danger',
  },
};

export const Выполняется: Story = { args: { pending: true } };

export const Ошибка: Story = {
  args: { errorMessage: 'Сервер отклонил операцию: попробуйте позже.' },
};
