import { Children, Fragment, cloneElement, createElement, isValidElement, useEffect, type ReactElement, type ReactNode } from 'react';
import type { Components } from 'react-markdown';
import { Markdown, baseComponents } from '@/shared/ui';
import type { SourceMark } from '@/entities/pth/types';

/** Блоки, которые подсвечиваются целиком, если в их строках есть привязанная формулировка. */
const BLOCKS = ['tr', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote'] as const;

const TABLE_ROW = 'border-l-4 border-accent-text/60 bg-accent-soft/30';
const TABLE_ROW_ACTIVE = 'border-l-4 border-accent-text bg-[color-mix(in_srgb,var(--accent-text)_12%,transparent)]';
const TABLE_CELL = 'bg-[color-mix(in_srgb,var(--accent-text)_28%,transparent)] font-medium';
const LLM = 'border-l-4 border-dashed border-info-text bg-[color-mix(in_srgb,var(--info-text)_14%,transparent)]';
const LLM_UNVERIFIED = 'border-l-4 border-dashed border-warning-text bg-[color-mix(in_srgb,var(--warning-text)_14%,transparent)]';
const ACTIVE_RING = 'outline outline-2 -outline-offset-2 outline-accent-text';

/** Markdown-документ с подсветкой формулировок, из которых получены требования.
 *  Строка таблицы подсвечивается, а ячейки с формулировкой выделены сильнее; цитаты модели подсвечивают свой абзац. */
export function SourceMarkdown({ source, marks, active, onOpen }: {
  source: string;
  marks: SourceMark[];
  active: number | null;
  onOpen: (displayId: string) => void;
}) {
  const byLine = new Map<number, SourceMark[]>();
  for (const m of marks) for (let n = m.line; n <= m.end_line; n++) byLine.set(n, [...(byLine.get(n) ?? []), m]);
  const hit = (start: number, end: number) => {
    // Все привязки, попавшие в блок: у абзаца с двумя цитатами они на разных строках.
    const here = new Set<SourceMark>();
    let first: number | null = null;
    for (let n = start; n <= end; n++) {
      for (const m of byLine.get(n) ?? []) here.add(m);
      if (first === null && byLine.get(n)?.length) first = n;
    }
    return first === null ? null : { line: first, marks: [...here] };
  };

  const components: Components = { ...baseComponents };
  const table = components as Record<string, unknown>;
  type Props = { node?: { position?: { start: { line: number }; end: { line: number } } }; children?: ReactNode } & Record<string, unknown>;
  for (const tag of BLOCKS) {
    const Base = (baseComponents as Record<string, ((p: Record<string, unknown>) => ReactElement) | undefined>)[tag];
    table[tag] = ({ node, children, ...props }: Props) => {
      const pos = node?.position;
      const found = pos ? hit(pos.start.line, pos.end.line) : null;
      if (!found) return Base ? Base({ ...props, children }) : createElement(tag, props, children);
      const first = found.marks[0];
      const ids = [...new Set(found.marks.map((m) => m.display_id))];
      const isActive = found.marks.some((m) => m.line <= (active ?? -1) && (active ?? -1) <= m.end_line);
      const llm = first.via === 'llm';
      let body: ReactNode = children;
      // Цитаты модели подсвечиваются в самом тексте абзаца, а не только блоком целиком.
      if (tag !== 'tr') {
        const quotes = found.marks.filter((m) => m.via === 'llm' && m.quote).map((m) => ({ quote: m.quote as string, verified: m.verified !== false }));
        if (quotes.length > 0) body = markQuotes(children, quotes);
      }
      // Ячейки таблицы: формулировка выделена сильнее остальной строки.
      if (tag === 'tr' && !llm) {
        const cols = new Set(found.marks.flatMap((m) => m.cols));
        body = Children.toArray(children).map((child, i) =>
          cols.has(i) && isValidElement(child)
            ? cloneElement(child as ReactElement<{ className?: string }>, { className: `${(child.props as { className?: string }).className ?? ''} ${TABLE_CELL}` })
            : child);
      }
      const base = Base ? Base({ ...props, children: body }) : createElement(tag, props, body);
      const cls = llm ? (first.verified === false ? LLM_UNVERIFIED : LLM) : isActive ? TABLE_ROW_ACTIVE : TABLE_ROW;
      return cloneElement(base, {
        id: `src-line-${found.line}`, 'data-req': ids.join(' '), tabIndex: 0,
        title: llm ? `${ids.join(', ')}: цитата модели${first.verified === false ? ' (дословно в тексте не подтверждена)' : ''}` : `${ids.join(', ')}: получено из этой строки`,
        onClick: () => onOpen(ids[0]),
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') onOpen(ids[0]); },
        className: `${(base.props as { className?: string }).className ?? ''} cursor-pointer ${cls} ${isActive ? ACTIVE_RING : ''}`,
      } as Record<string, unknown>);
    };
  }
  useEffect(() => {
    if (active === null) return;
    // Блок, содержащий строку: у многострочных привязок id стоит на первой строке блока.
    const el = document.getElementById(`src-line-${active}`) ?? [...document.querySelectorAll('[id^="src-line-"]')].find((e) => Number(e.id.slice(9)) >= active);
    el?.scrollIntoView({ block: 'center' });
  }, [active, source]);
  return <Markdown source={source} components={components} />;
}

const MARK_OK = 'rounded-sm bg-[color-mix(in_srgb,var(--info-text)_32%,transparent)] px-0.5';
const MARK_WARN = 'rounded-sm bg-[color-mix(in_srgb,var(--warning-text)_32%,transparent)] px-0.5';

/** Оборачивает в <mark> цитаты внутри текстовых узлов (пробелы и переносы нестрого). Цитата через несколько узлов остаётся блочной подсветкой. */
function markQuotes(node: ReactNode, quotes: { quote: string; verified: boolean }[]): ReactNode {
  if (Array.isArray(node)) return node.map((child, i) => <Fragment key={i}>{markQuotes(child, quotes)}</Fragment>);
  if (typeof node !== 'string') return node;
  const pieces: ReactNode[] = [];
  let rest = node;
  let guard = 0;
  while (rest && guard++ < 50) {
    let best: { index: number; length: number; verified: boolean } | null = null;
    for (const q of quotes) {
      const words = q.quote.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (words.length === 0) continue;
      const m = new RegExp(words.join('\\s+')).exec(rest);
      if (m && (best === null || m.index < best.index)) best = { index: m.index, length: m[0].length, verified: q.verified };
    }
    if (!best) break;
    if (best.index > 0) pieces.push(rest.slice(0, best.index));
    pieces.push(<mark key={`${pieces.length}`} className={best.verified ? MARK_OK : MARK_WARN}>{rest.slice(best.index, best.index + best.length)}</mark>);
    rest = rest.slice(best.index + best.length);
  }
  if (rest) pieces.push(rest);
  return pieces.length === 1 ? pieces[0] : <>{pieces}</>;
}
