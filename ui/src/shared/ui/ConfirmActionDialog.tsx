import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { InlineAlert } from './InlineAlert';

export type ConfirmIntent = 'default' | 'danger';

export interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  /** Конкретные последствия вместо неопределённого «Вы уверены?» (X06). */
  description: string;
  affectedObjectsSummary?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  intent?: ConfirmIntent;
  pending?: boolean;
  errorMessage?: string;
  /** Подтверждение недоступно, пока последствия не проверены (например, аудитория X10). */
  confirmDisabled?: boolean;
  confirmDisabledReason?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** X06 ConfirmActionDialog: единый диалог удаления, расширения аудитории и потери правок. */
export function ConfirmActionDialog({
  open,
  title,
  description,
  affectedObjectsSummary,
  confirmLabel,
  cancelLabel = 'Отмена',
  intent = 'default',
  pending = false,
  errorMessage,
  confirmDisabled = false,
  confirmDisabledReason,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // При разрушительном действии фокус сначала на отмене (X06).
    if (open && intent === 'danger') cancelRef.current?.focus();
  }, [open, intent]);

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={pending ? () => {} : onCancel}
      footer={
        <>
          <Button ref={cancelRef} variant="ghost" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={intent === 'danger' ? 'danger' : 'primary'}
            loading={pending}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {affectedObjectsSummary}
        {errorMessage && <InlineAlert tone="danger" message={errorMessage} />}
        {confirmDisabled && confirmDisabledReason && !pending && (
          <p className="text-meta text-text-muted">{confirmDisabledReason}</p>
        )}
      </div>
    </Dialog>
  );
}
