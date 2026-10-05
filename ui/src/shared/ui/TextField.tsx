import { useId, type InputHTMLAttributes, type Ref, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

const control =
  'w-full rounded-control border bg-surface px-3 text-ui text-text placeholder:text-text-muted ' +
  'transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  counter?: string;
  hideLabel?: boolean;
  children: (describedBy: string | undefined, invalid: boolean) => React.ReactNode;
}

function FieldShell({ id, label, hint, error, counter, hideLabel, children }: FieldShellProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      {/* Подсказка в строке подписи, а не под полем: так поле не сдвигает соседние кнопки. */}
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <label htmlFor={id} className={cn('shrink-0 text-ui font-medium text-text', hideLabel && 'sr-only')}>
          {label}
        </label>
        {hint && (
          <span id={hintId} title={hint} className="min-w-0 truncate text-meta text-text-muted">
            {hint}
          </span>
        )}
        {counter && <span className="shrink-0 text-meta text-text-muted">{counter}</span>}
      </div>
      {children(describedBy || undefined, Boolean(error))}
      {error && (
        <p id={errorId} className="text-meta text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'aria-invalid'
> {
  label: string;
  hint?: string;
  error?: string;
  counter?: string;
  hideLabel?: boolean;
  /** Прямая ссылка на поле: нужна для программного фокуса (C54). */
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  ref,
  label,
  hint,
  error,
  counter,
  hideLabel,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      counter={counter}
      hideLabel={hideLabel}
    >
      {(describedBy, invalid) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            control,
            'h-9',
            invalid ? 'border-danger-text' : 'border-control-border',
            className,
          )}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export interface TextareaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id' | 'aria-invalid'
> {
  label: string;
  hint?: string;
  error?: string;
  counter?: string;
  hideLabel?: boolean;
}

export function TextareaField({
  label,
  hint,
  error,
  counter,
  hideLabel,
  className,
  ...rest
}: TextareaFieldProps) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      counter={counter}
      hideLabel={hideLabel}
    >
      {(describedBy, invalid) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            control,
            'py-2',
            invalid ? 'border-danger-text' : 'border-control-border',
            className,
          )}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
