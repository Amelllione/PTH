import { Fragment, useState } from 'react';
import type { RevisionItem } from '@/entities/pth/types';
import { Button } from '@/shared/ui';

type Piece = { kind: 'same' | 'removed' | 'added'; text: string };

/** Разница по словам: LCS на токенах «слово или пробелы». Тексты требований короткие, квадрат допустим. */
export function wordDiff(before: string, after: string): Piece[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: Piece[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ kind: 'removed', text: a[i] }); i++; }
    else { out.push({ kind: 'added', text: b[j] }); j++; }
  }
  while (i < n) out.push({ kind: 'removed', text: a[i++] });
  while (j < m) out.push({ kind: 'added', text: b[j++] });
  return out;
}

function sameJson(x: unknown, y: unknown) {
  return JSON.stringify(x) === JSON.stringify(y);
}

/** Что поменялось между предыдущей и текущей ревизией: заголовок, текст, атрибуты, исключение. */
function changesOf(prev: RevisionItem, cur: RevisionItem): string[] {
  const out: string[] = [];
  if (prev.title !== cur.title) out.push('заголовок');
  if (prev.text !== cur.text) out.push('текст');
  const keys = new Set([...Object.keys(prev.attributes), ...Object.keys(cur.attributes)]);
  const changedAttrs = [...keys].filter((k) => !sameJson(prev.attributes[k], cur.attributes[k]));
  if (changedAttrs.length) out.push(`атрибуты: ${changedAttrs.join(', ')}`);
  if ((prev.exemption_reason ?? '') !== (cur.exemption_reason ?? '')) out.push('исключение');
  return out;
}

export function Diff({ before, after }: { before: string; after: string }) {
  if (before === after) return <p className="text-meta text-text-muted">Без изменений.</p>;
  return (
    <p className="whitespace-pre-wrap text-ui leading-relaxed">
      {wordDiff(before, after).map((p, k) => (
        <Fragment key={k}>
          {p.kind === 'same' && p.text}
          {p.kind === 'removed' && <del className="text-danger-text line-through">{p.text}</del>}
          {p.kind === 'added' && <ins className="text-success-text underline decoration-1 underline-offset-2">{p.text}</ins>}
        </Fragment>
      ))}
    </p>
  );
}

/** История ревизий: новые сверху, у каждой — что изменилось относительно предыдущей. */
export function RevisionHistory({ revs, textHidden = false }: { revs: RevisionItem[]; /** Не показывать разницу исходника (схемы): только факт изменения. */ textHidden?: boolean }) {
  const ordered = [...revs].sort((x, y) => y.number - x.number);
  const [open, setOpen] = useState<number | null>(ordered[0]?.number ?? null);
  return (
    <ol className="flex flex-col gap-2">
      {ordered.map((r, idx) => {
        const prev = ordered[idx + 1];
        const isOpen = open === r.number;
        const changes = prev ? changesOf(prev, r) : [];
        return (
          <li key={r.number} className="flex flex-col gap-2 rounded-control border border-border bg-surface-muted/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-ui font-medium">ревизия {r.number}{idx === 0 ? ' (текущая)' : ''}</span>
                <span className="text-meta text-text-muted">
                  {prev ? (changes.length ? `изменено: ${changes.join('; ')}` : 'без изменений по полям') : 'первая ревизия'}
                </span>
              </div>
              {prev && (
                <Button size="sm" variant="secondary" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.number)}>
                  {isOpen ? 'Скрыть' : 'Что изменилось'}
                </Button>
              )}
            </div>
            {isOpen && prev && (
              <div className="flex flex-col gap-3 border-t border-border pt-3">
                {prev.title !== r.title && (
                  <div className="flex flex-col gap-1">
                    <span className="text-meta text-text-muted">Заголовок</span>
                    <Diff before={prev.title} after={r.title} />
                  </div>
                )}
                {prev.text !== r.text && textHidden && <p className="text-meta text-text-muted">Изменён исходник схемы.</p>}
                {prev.text !== r.text && !textHidden && (
                  <div className="flex flex-col gap-1">
                    <span className="text-meta text-text-muted">Текст</span>
                    <Diff before={prev.text} after={r.text} />
                  </div>
                )}
                {!sameJson(prev.attributes, r.attributes) && (
                  <div className="flex flex-col gap-1 text-meta">
                    <span className="text-text-muted">Атрибуты</span>
                    {[...new Set([...Object.keys(prev.attributes), ...Object.keys(r.attributes)])]
                      .filter((k) => !sameJson(prev.attributes[k], r.attributes[k]))
                      .map((k) => (
                        <span key={k} className="font-mono">
                          {k}: <del className="text-danger-text">{String(prev.attributes[k] ?? '—')}</del>{' → '}
                          <ins className="text-success-text">{String(r.attributes[k] ?? '—')}</ins>
                        </span>
                      ))}
                  </div>
                )}
                {(prev.exemption_reason ?? '') !== (r.exemption_reason ?? '') && (
                  <div className="flex flex-col gap-1 text-meta">
                    <span className="text-text-muted">Исключение</span>
                    <span>
                      <del className="text-danger-text">{prev.exemption_reason || '—'}</del>{' → '}
                      <ins className="text-success-text">{r.exemption_reason || '—'}</ins>
                    </span>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
