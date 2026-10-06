import { useEffect, useState } from 'react';

export type DiagramFormat = 'mermaid' | 'svg';

/** Mermaid требует уникальный id на каждую отрисовку: повтор id оставляет пустую схему. */
let renderCounter = 0;

const isDark = () => document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

/** Показ схемы: Mermaid рисуется библиотекой в строгом режиме, SVG выводится как изображение, поэтому скрипты внутри не выполняются. */
export function DiagramView({ format, source, title }: { format: DiagramFormat; source: string; title?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (format !== 'mermaid') return;
    let cancelled = false;
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        // Библиотека тяжёлая: подгружается только когда нужна схема Mermaid.
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: isDark() ? 'dark' : 'default' });
        await mermaid.parse(source);
        const id = `mmd-${++renderCounter}`;
        const out = await mermaid.render(id, source);
        document.getElementById(`d${id}`)?.remove();
        if (!cancelled) setSvg(out.svg);
      } catch (err) {
        if (!cancelled) { setSvg(null); setError(err instanceof Error ? err.message : 'Не удалось построить схему'); }
      }
    }, 250); // небольшая пауза, чтобы живой просмотр не перерисовывался на каждую букву
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [format, source]);

  if (format === 'svg') {
    return (
      <div className="overflow-auto rounded-control border border-border bg-white p-3">
        <img alt={title ?? 'Схема'} className="mx-auto max-h-[70vh] max-w-full" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`} />
      </div>
    );
  }
  if (error) {
    return <p role="alert" className="whitespace-pre-wrap rounded-control border border-border bg-surface p-3 font-mono text-meta text-danger-text">Ошибка Mermaid: {error}</p>;
  }
  if (svg === null) return <p className="text-ui text-text-muted">Строим схему…</p>;
  return <div role="img" aria-label={title ?? 'Схема'} className="overflow-auto rounded-control border border-border bg-surface p-3 [&_svg]:mx-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Формат схемы из атрибутов артефакта. Без атрибута считаем Mermaid. */
export function formatOf(attributes: Record<string, unknown>): DiagramFormat {
  return attributes.format === 'svg' ? 'svg' : 'mermaid';
}
