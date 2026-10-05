import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { Button } from './Button';
import { InlineAlert } from './InlineAlert';
import { EmptyState, ErrorState, SkeletonList } from './States';

const meta = {
  title: 'X07 Примитивы/Статусы и состояния',
  parameters: {
    docs: {
      description: {
        component:
          'Badge, InlineAlert, Skeleton, EmptyState и ErrorState. Текстовый смысл не зависит ' +
          'от цвета; загрузка, пустота и ошибка различаются.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge label="Черновик" tone="accent" />
      <Badge label="Готов" tone="success" icon="check" />
      <Badge label="Обработка" tone="warning" />
      <Badge label="Ошибка обработки" tone="danger" icon="alert" />
      <Badge label="Передан модели" tone="info" />
      <Badge label="Этот чат" />
    </div>
  ),
};

export const Оповещения: Story = {
  render: () => (
    <div className="flex max-w-[560px] flex-col gap-3">
      <InlineAlert
        message="Сообщение не отправлено. Черновик сохранён, повторите отправку."
        tone="danger"
        action={
          <Button size="sm" variant="secondary">
            Повторить
          </Button>
        }
      />
      <InlineAlert message="Связь потеряна, проверяем состояние запуска." tone="warning" />
      <InlineAlert message="Ответ сохранён в закладках." tone="success" />
      <InlineAlert
        message="Материал доступен для поиска, но пока не выбран для запроса."
        tone="info"
      />
    </div>
  ),
};

export const ЗагрузкаПустотаОшибка: Story = {
  render: () => (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="rounded-card border border-border bg-surface p-3">
        <SkeletonList rows={4} />
      </div>
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          title="Разговоров ещё нет"
          description="Введите первый вопрос в пустом чате."
          action={
            <Button variant="secondary" size="sm">
              Новый чат
            </Button>
          }
        />
      </div>
      <div className="rounded-card border border-border bg-surface">
        <ErrorState
          title="Список чатов не загрузился"
          description="Проверьте соединение и повторите загрузку."
          action={
            <Button variant="secondary" size="sm">
              Повторить
            </Button>
          }
        />
      </div>
    </div>
  ),
};
