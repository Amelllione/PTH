import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';

/** Стили элементов Markdown на токенах темы. Сырой HTML в тексте не исполняется (react-markdown его не рендерит). */
export const baseComponents: Components = {
  h1: (p) => <h1 className="mb-3 mt-6 text-section font-semibold text-text first:mt-0" {...p} />,
  h2: (p) => <h2 className="mb-2 mt-5 border-b border-border pb-1 text-ui font-semibold text-text first:mt-0" {...p} />,
  h3: (p) => <h3 className="mb-1.5 mt-4 text-ui font-semibold text-text" {...p} />,
  p: (p) => <p className="my-2 text-ui leading-relaxed text-text" {...p} />,
  ul: (p) => <ul className="my-2 list-disc pl-6 text-ui text-text" {...p} />,
  ol: (p) => <ol className="my-2 list-decimal pl-6 text-ui text-text" {...p} />,
  li: (p) => <li className="my-0.5" {...p} />,
  a: ({ href, children, ...p }) => href?.startsWith('/v1/')
    ? <ApiFileLink href={href}>{children}</ApiFileLink>
    : <a href={href} target="_blank" rel="noreferrer noopener" className="text-accent-text underline underline-offset-2" {...p}>{children}</a>,
  code: (p) => <code className="rounded-control bg-surface-muted px-1 py-0.5 font-mono text-meta" {...p} />,
  pre: (p) => <pre className="my-3 overflow-auto rounded-control bg-surface-muted p-3 font-mono text-meta" {...p} />,
  blockquote: (p) => <blockquote className="my-3 border-l-2 border-border pl-3 text-text-muted" {...p} />,
  hr: () => <hr className="my-4 border-border" />,
  table: (p) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-ui" {...p} /></div>,
  th: (p) => <th className="border-b border-border px-3 py-1.5 text-left text-meta font-medium text-text-muted" {...p} />,
  td: (p) => <td className="border-b border-border px-3 py-1.5 align-top text-text" {...p} />,
};

/** Ссылка на файл PTH: скачивается запросом с токеном, имя берётся из текста ссылки. */
function ApiFileLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [error, setError] = useState(false);
  const name = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : 'file';
  return (
    <>
      <button type="button" className="text-accent-text underline underline-offset-2" onClick={() => { setError(false); pthApi.downloadFile(href, name).catch(() => setError(true)); }}>{children}</button>
      {error && <span role="alert" className="ml-2 text-meta text-danger-text">не удалось скачать</span>}
    </>
  );
}

/** Отрисовка Markdown (GFM: таблицы, списки, зачёркивание). */
export function Markdown({ source, components = baseComponents }: { source: string; /** Свои компоненты разметки; по умолчанию стандартное оформление. */ components?: Components }) {
  return (
    <div className="max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{source}</ReactMarkdown>
    </div>
  );
}
