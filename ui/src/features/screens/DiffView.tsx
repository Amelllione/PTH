import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Loaded } from './common';
import type { FileDiff } from '@/entities/pth/types';

/** Строка diff; ids — требования, чьи формулировки стоят на этой строке (для сравнения источников). */
export type DiffLine = { type: 'ctx' | 'add' | 'del'; old: number | null; new: number | null; text: string; ids?: string[] };

const ADD = 'bg-[color-mix(in_srgb,var(--success-text)_16%,transparent)]';
const DEL = 'bg-[color-mix(in_srgb,var(--danger-text)_16%,transparent)]';
const ADD_STRONG = 'bg-[color-mix(in_srgb,var(--success-text)_28%,transparent)]';
const DEL_STRONG = 'bg-[color-mix(in_srgb,var(--danger-text)_28%,transparent)]';
const SIGN = { add: '+', del: '−', ctx: ' ' } as const;

/** Пары для split-вида: подряд идущие удалённые и добавленные строки ставятся рядом, как в GitHub. */
function toSplit(lines: DiffLine[]): [DiffLine | null, DiffLine | null][] {
  const rows: [DiffLine | null, DiffLine | null][] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type === 'ctx') { rows.push([lines[i], lines[i]]); i++; continue; }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'del') dels.push(lines[i++]);
    while (i < lines.length && lines[i].type === 'add') adds.push(lines[i++]);
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) rows.push([dels[k] ?? null, adds[k] ?? null]);
  }
  return rows;
}

const num = 'w-12 shrink-0 select-none px-2 text-right text-text-muted';

function Unified({ lines }: { lines: DiffLine[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} className={`flex ${l.type === 'add' ? ADD : l.type === 'del' ? DEL : ''}`}>
          <span className={`${num} ${l.type === 'add' ? ADD_STRONG : l.type === 'del' ? DEL_STRONG : ''}`}>{l.old ?? ''}</span>
          <span className={`${num} ${l.type === 'add' ? ADD_STRONG : l.type === 'del' ? DEL_STRONG : ''}`}>{l.new ?? ''}</span>
          <span className="w-4 shrink-0 select-none text-center text-text-muted">{SIGN[l.type]}</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-3">{l.text}</span>
          {l.ids && l.ids.length > 0 && <span className="shrink-0 pr-3 text-accent-text">{l.ids.join(', ')}</span>}
        </div>
      ))}
    </>
  );
}

function Split({ lines }: { lines: DiffLine[] }) {
  const cell = (l: DiffLine | null, side: 'old' | 'new') => (
    <div className={`flex min-w-0 flex-1 ${l ? (l.type === 'add' ? ADD : l.type === 'del' ? DEL : '') : 'bg-surface-muted/40'}`}>
      <span className={`${num} ${l?.type === 'add' ? ADD_STRONG : l?.type === 'del' ? DEL_STRONG : ''}`}>{l ? (side === 'old' ? l.old : l.new) ?? '' : ''}</span>
      <span className="w-4 shrink-0 select-none text-center text-text-muted">{l && l.type !== 'ctx' ? SIGN[l.type] : ''}</span>
      <span className="min-w-0 whitespace-pre-wrap break-all pr-3">{l?.text ?? ''}</span>
    </div>
  );
  return (
    <>
      {toSplit(lines).map(([a, b], i) => (
        <div key={i} className="flex divide-x divide-border">
          {cell(a && a.type !== 'add' ? a : null, 'old')}
          {cell(b && b.type !== 'del' ? b : null, 'new')}
        </div>
      ))}
    </>
  );
}

/** Diff файла как в GitHub: блоки, номера строк слева, цветные добавления и удаления; вид объединённый или двухколоночный. */
export function DiffView({ projectKey, sha, path }: { projectKey: string; sha: string; path: string }) {
  const data = useAsync(`diff:${projectKey}:${sha}:${path}`, () => pthApi.gitDiff(projectKey, sha, path));
  const [mode, setMode] = useState<'unified' | 'split'>('unified');
  return (
    <Loaded state={data} retry={data.reload} empty={{ title: 'Нет изменений', isEmpty: (d: FileDiff) => d.hunks.length === 0 && !d.binary }}>
      {(d) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-meta text-text-muted">
            <span>{d.binary ? 'Двоичный файл' : `${d.hunks.length} ${d.hunks.length === 1 ? 'блок' : 'блоков'} изменений`}</span>
            {!d.binary && (
              <div role="group" aria-label="Вид diff" className="inline-flex overflow-hidden rounded-control border border-control-border">
                {(['unified', 'split'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                    className={`px-2.5 py-1 text-meta ${mode === m ? 'bg-accent-soft text-accent-text' : 'bg-surface text-text-muted hover:bg-surface-muted'}`}>
                    {m === 'unified' ? 'Вместе' : 'Рядом'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {d.binary ? <p className="text-ui text-text-muted">Содержимое двоичного файла не показывается.</p> : (
            <div className="overflow-x-auto rounded-control border border-border bg-surface font-mono text-meta leading-5">
              {d.hunks.map((h, i) => (
                <div key={i}>
                  <div className="bg-accent-soft/50 px-3 py-1 text-accent-text">{h.header}</div>
                  {mode === 'unified' ? <Unified lines={h.lines} /> : <Split lines={h.lines} />}
                </div>
              ))}
            </div>
          )}
          {d.truncated && <p className="text-meta text-warning-text">Diff обрезан по размеру. Полный diff — в git.</p>}
        </div>
      )}
    </Loaded>
  );
}

/** Блоки изменений и переключатель вида: общий для diff файла коммита и сравнения версий источника. */
export function DiffHunks({ hunks }: { hunks: { header: string; lines: DiffLine[] }[] }) {
  const [mode, setMode] = useState<'unified' | 'split'>('unified');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <div role="group" aria-label="Вид diff" className="inline-flex overflow-hidden rounded-control border border-control-border">
          {(['unified', 'split'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-meta ${mode === m ? 'bg-accent-soft text-accent-text' : 'bg-surface text-text-muted hover:bg-surface-muted'}`}>
              {m === 'unified' ? 'Вместе' : 'Рядом'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-control border border-border bg-surface font-mono text-meta leading-5">
        {hunks.map((h, i) => (
          <div key={i}>
            <div className="bg-accent-soft/50 px-3 py-1 text-accent-text">{h.header}</div>
            {mode === 'unified' ? <Unified lines={h.lines} /> : <Split lines={h.lines} />}
          </div>
        ))}
      </div>
    </div>
  );
}
