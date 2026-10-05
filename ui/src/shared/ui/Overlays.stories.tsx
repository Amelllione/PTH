import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { IconButton } from './IconButton';
import { Menu } from './Menu';
import { ResizeHandle } from './ResizeHandle';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'X07 Примитивы/Диалог, меню и разделитель',
  parameters: {
    docs: {
      description: {
        component:
          'Dialog удерживает фокус и закрывается Escape, Menu возвращает фокус инициатору, ' +
          'ResizeHandle меняется стрелками и сообщает aria-valuenow.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Открыть диалог
      </Button>
      <Dialog
        open={open}
        title="Удалить чат «Сравнение тарифов конкурентов»?"
        description="Будут удалены сообщения ветки и их вложения этого чата."
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Удалить чат
            </Button>
          </>
        }
      >
        <p className="text-ui text-text-muted">
          Материалы, привязанные к workspace, останутся доступны другим чатам пространства.
        </p>
      </Dialog>
    </>
  );
}

export const ДиалогПодтверждения: Story = { render: () => <DialogDemo /> };

function MenuDemo() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <IconButton
        ref={triggerRef}
        icon="more"
        accessibleName="Действия с чатом"
        aria-haspopup="menu"
        aria-expanded={open}
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
      />
      <Menu
        open={open}
        onOpenChange={setOpen}
        triggerRef={triggerRef}
        label="Действия с чатом"
        items={[
          { id: 'rename', label: 'Переименовать', onSelect: () => {} },
          {
            id: 'share',
            label: 'Доступ',
            disabled: true,
            disabledReason: 'Приглашать участников может владелец чата.',
            onSelect: () => {},
          },
          {
            id: 'delete',
            label: 'Удалить',
            tone: 'danger',
            onSelect: () => {},
          },
        ]}
      />
    </div>
  );
}

export const МенюДействий: Story = { render: () => <MenuDemo /> };

function ResizeDemo() {
  const [width, setWidth] = useState(256);
  return (
    <div className="flex h-64 overflow-hidden rounded-card border border-border bg-surface">
      <div style={{ width }} className="bg-surface-muted p-3 text-ui text-text-muted">
        Навигация: {width} px
      </div>
      <ResizeHandle
        value={width}
        min={220}
        max={320}
        label="Ширина навигации"
        onChange={setWidth}
      />
      <div className="flex-1 p-3 text-ui text-text-muted">
        Основная область. Разделитель меняется стрелками влево и вправо.
      </div>
    </div>
  );
}

export const ИзменениеШирины: Story = { render: () => <ResizeDemo /> };

export const ПодсказкаПоверхИнтерфейса: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Tooltip выводится слоем над интерфейсом: при наведении и фокусе разметка не сдвигается. ' +
          'Доступное имя задаётся на самой кнопке, поэтому подсказка скрыта от скринридера.',
      },
    },
  },
  render: () => (
    <div className="flex items-center gap-2 rounded-card border border-border bg-surface p-4">
      <Tooltip label="Сохранённые сообщения">
        <IconButton icon="bookmark" accessibleName="Сохранённые сообщения" variant="secondary" />
      </Tooltip>
      <Tooltip label="Память пространства" placement="bottom">
        <IconButton icon="memory" accessibleName="Память пространства" variant="secondary" />
      </Tooltip>
      <span className="text-ui text-text-muted">Соседний текст остаётся на месте.</span>
    </div>
  ),
};
