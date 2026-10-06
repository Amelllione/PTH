import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Буфер обмена: сначала Clipboard API, запасной путь — выделенное поле и execCommand. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/**
 * Двойной клик по ID копирует его в буфер обмена. Подсказка и короткое «скопировано» — рядом, без модалки.
 * Одиночный клик не меняется: ссылки и кнопки внутри работают как раньше.
 */
export function CopyId({ value, children, className }: { value: string; children?: ReactNode; className?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await copyText(value);
    setCopied(ok ? 'скопировано' : 'не удалось');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <span className={`relative inline-flex ${className ?? ''}`} title={`${value} — двойной клик, чтобы скопировать`} onDoubleClick={copy}>
      {children ?? value}
      {copied && (
        <span role="status" className="pointer-events-none absolute -top-6 left-0 z-10 whitespace-nowrap rounded-control bg-text px-1.5 py-0.5 text-meta text-surface">
          {copied}
        </span>
      )}
    </span>
  );
}
