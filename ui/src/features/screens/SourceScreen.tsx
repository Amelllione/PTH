import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge } from '@/shared/ui';
import { Loaded, Section } from './common';

/** Оригинал импорта: каждая строка с требованием подсвечена и подписана ID, который из неё получен. */
export function SourceScreen({ projectKey }: { projectKey: string }) {
  const imports = useAsync(`imports-src:${projectKey}`, () => pthApi.imports(projectKey));
  const [uid, setUid] = useState<string | null>(null);
  const source = useAsync(uid ? `source:${projectKey}:${uid}` : null, () => pthApi.source(projectKey, uid ?? ''));
  return (
    <Section title="Оригинал источника" hint="Строки спецификации, из которых получены требования. Подсвечены строки с ID.">
      <Loaded state={imports} retry={imports.reload} empty={{ title: 'Импортов нет', description: 'Сначала загрузите спецификацию.', isEmpty: (d) => d.filter((i) => i.uid).length === 0 }}>
        {(list) => (
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Импорт" value={uid ?? ''} onChange={(e) => setUid(e.target.value || null)} className="h-9 min-w-72 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
              <option value="">выберите импорт</option>
              {list.filter((i) => i.uid).map((i) => <option key={i.uid ?? i.source_sha256} value={i.uid ?? ''}>{i.source_name} · {new Date(i.created_at).toLocaleString('ru-RU')}</option>)}
            </select>
          </div>
        )}
      </Loaded>
      {uid && (
        <Loaded state={source} retry={source.reload}>
          {(s) => (
            <>
              <p className="text-meta text-text-muted">
                {s.source_name} · sha256 {s.source_sha256.slice(0, 16)}… · связанных строк: {s.fragments}
              </p>
              <ol className="max-h-[32rem] overflow-auto rounded-card border border-border bg-surface font-mono text-meta" aria-label="Строки источника">
                {s.lines.map((l) => (
                  <li key={l.no} className={`grid grid-cols-[3rem_1fr_auto] gap-2 px-2 py-0.5 ${l.display_id ? 'bg-accent-soft text-accent-text' : 'text-text'}`}>
                    <span className="text-right text-text-muted">{l.no}</span>
                    <span className="whitespace-pre-wrap break-all">{l.text || ' '}</span>
                    {l.display_id && <Badge label={l.display_id} tone="accent" />}
                  </li>
                ))}
              </ol>
            </>
          )}
        </Loaded>
      )}
    </Section>
  );
}
