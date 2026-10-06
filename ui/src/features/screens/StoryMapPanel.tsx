import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Button, InlineAlert, TextField, Tooltip } from '@/shared/ui';
import { Loaded, Section } from './common';
import type { StoryMap } from '@/entities/pth/types';

const STATUS_RU: Record<string, string> = { planned: 'планируется', frozen: 'зафиксирован', released: 'выпущен', cancelled: 'отменён' };

/** USM (User Story Mapping, карта историй): колонки — активности пользователей, строки — релизы, карточки — user story с ФТ под ними. */
export function StoryMapPanel({ projectKey, onOpenCard }: { projectKey: string; /** Открыть US в отдельной вкладке. */ onOpenCard: (displayId: string) => void }) {
  const [version, setVersion] = useState(0);
  const map = useAsync(`story-map:${projectKey}:${version}`, () => pthApi.storyMap(projectKey));
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /** Перенос карточки: смена релиза (с уточняющими требованиями) и/или активности (новая ревизия US с атрибутом activity). */
  const move = async (id: string, from: string | null, to: string | null, fromActivity: string, toActivity: string) => {
    setError(null); setNote(null);
    try {
      if (from !== to) await pthApi.moveReleaseItem(projectKey, { display_id: id, from_release: from, to_release: to, with_related: true });
      if (fromActivity !== toActivity) {
        const card = await pthApi.artifact(projectKey, id);
        await pthApi.addRevision(projectKey, id, { title: card.title, text: card.text, attributes: { ...card.attributes, activity: toActivity }, exemption_reason: card.exemption_reason });
      }
      setNote(`${id} перенесён`);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось перенести');
    }
  };
  return (
    <Section title="USM" hint="Нажмите на карточку, чтобы открыть US в отдельной вкладке. Перетащите карточку в другую ячейку или выберите релиз в самой карточке: так меняются релиз и активность. Колонки — активности (атрибут activity у user story, а если его нет — роль из «Как <роль>, хочу…»). Строки — релизы по порядку. Карточка — user story, под ней уточняющие ФТ: точка показывает реализацию, галочка — проверку.">
      {error && <InlineAlert tone="danger" message={error} />}
      {note && <InlineAlert tone="success" message={note} />}
      <NewRelease projectKey={projectKey} onCreated={(name) => { setNote(`Релиз ${name} создан: перетащите в него карточки`); setVersion((v) => v + 1); }} onError={setError} />
      <Loaded state={map} retry={map.reload} empty={{ title: 'User story нет', description: 'Карта строится из US и уточняющих их ФТ.', isEmpty: (d) => d.cards.length === 0 }}>
        {(d) => (
          <>
            <p className="text-meta text-text-muted">
              US на карте: {d.cards.length}, в релизах: {d.cards.filter((c) => c.release).length}, не запланировано: {d.cards.filter((c) => !c.release).length}. Колонок: {d.activities.length}, карту можно прокручивать вправо. Если US входит в несколько релизов, она показана в самом раннем.
            </p>
            <Grid d={d} onOpen={onOpenCard} onMove={move} />
          </>
        )}
      </Loaded>
    </Section>
  );
}

type MoveFn = (id: string, from: string | null, to: string | null, fromActivity: string, toActivity: string) => void;

function Grid({ d, onOpen, onMove }: { d: StoryMap; onOpen: (id: string) => void; onMove: MoveFn }) {
  const rows = [...d.releases.map((r) => ({ uid: r.uid as string | null, label: r.name, hint: STATUS_RU[r.status] ?? r.status })), { uid: null, label: 'Не запланировано', hint: 'в релизы не входит' }];
  const cols = d.activities;
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <div className="grid w-max" style={{ gridTemplateColumns: `6.5rem repeat(${cols.length}, 11rem)` }}>
        <div className="border-b border-border bg-surface-muted/40 p-3" />
        {cols.map((c) => <div key={c} className="border-b border-l border-border bg-surface-muted/40 p-2 text-meta font-semibold text-text">{c}</div>)}
        {rows.map((row) => (
          <Row key={row.uid ?? 'backlog'} label={row.label} hint={row.hint} cols={cols}
            rowUid={row.uid} releases={d.releases} cards={(c) => d.cards.filter((x) => x.activity === c && x.release === row.uid)} onOpen={onOpen} onMove={onMove} />
        ))}
      </div>
    </div>
  );
}

function Row({ label, hint, cols, cards, onOpen, onMove, rowUid, releases }: { label: string; hint: string; cols: string[]; cards: (activity: string) => StoryMap['cards']; onOpen: (id: string) => void; onMove: MoveFn; rowUid: string | null; releases: StoryMap['releases'] }) {
  return (
    <>
      <div className="border-b border-border p-2">
        <div className="text-meta font-semibold text-text">{label}</div>
        <div className="text-meta text-text-muted">{hint}</div>
      </div>
      {cols.map((c) => (
        <div key={c} className="flex min-h-14 flex-col gap-1.5 border-b border-l border-border p-1.5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const d = JSON.parse(e.dataTransfer.getData('application/x-pth-card')) as { id: string; release: string | null; activity: string };
              if (d.release !== rowUid || d.activity !== c) onMove(d.id, d.release, rowUid, d.activity, c);
            } catch { /* чужой объект перетаскивания */ }
          }}>
          {cards(c).map((card) => (
            <div key={card.display_id} draggable
              onDragStart={(e) => e.dataTransfer.setData('application/x-pth-card', JSON.stringify({ id: card.display_id, release: card.release, activity: card.activity }))}
              className="flex cursor-grab flex-col gap-1 rounded-control border border-border bg-surface p-1.5 text-left hover:bg-surface-muted/60">
              <button type="button" onClick={() => onOpen(card.display_id)} className="flex flex-col gap-1 text-left">
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-meta text-accent-text">{card.display_id}</span>
                {card.priority && <span className="text-meta text-text-muted">{card.priority}</span>}
              </span>
              <span className="break-words text-meta leading-snug text-text">{card.title}</span>
              <Dependencies d={card.dependencies} />
              {card.requirements.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1">
                  {card.requirements.slice(0, 4).map((r) => (
                    <li key={r.display_id} className="flex items-baseline gap-1.5 text-meta text-text-muted" title={r.title}>
                      <Tooltip align="start" label={r.implemented ? 'Реализовано: есть коммит со связью implements' : 'Не реализовано: ни один коммит не заявил реализацию этого требования'}>
                        <span tabIndex={0} aria-label={r.implemented ? 'реализовано' : 'не реализовано'} className={r.implemented ? 'text-success-text' : 'text-text-muted'}>{r.implemented ? '●' : '○'}</span>
                      </Tooltip>
                      <Tooltip align="start" label={CHECK_HINT[r.status ?? 'no_test'] ?? 'Не проверено'}>
                        <span tabIndex={0} aria-label={r.status === 'verified' ? 'проверено' : 'не проверено'} className={r.status === 'verified' ? 'text-success-text' : r.status === 'failed' ? 'text-danger-text' : 'text-text-muted'}>{r.status === 'verified' ? '✓' : r.status === 'failed' ? '✗' : '–'}</span>
                      </Tooltip>
                      <span className="font-mono">{r.display_id}</span>
                    </li>
                  ))}
                  {card.requirements.length > 4 && <li className="text-meta text-text-muted">и ещё {card.requirements.length - 4}</li>}
                </ul>
              )}
              </button>
              <label className="flex items-center gap-1.5 text-meta text-text-muted">релиз
                <select value={card.release ?? ''} aria-label={`Релиз для ${card.display_id}`}
                  onChange={(e) => onMove(card.display_id, card.release, e.target.value || null, card.activity, card.activity)}
                  className="h-7 min-w-0 flex-1 rounded-control border border-control-border bg-surface px-1 text-meta text-text">
                  <option value="">не запланировано</option>
                  {releases.filter((r) => r.status === 'planned' || r.uid === card.release).map((r) => <option key={r.uid} value={r.uid}>{r.name}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/** Новый релиз прямо с карты: появляется новой строкой, в неё переносятся карточки. */
function NewRelease({ projectKey, onCreated, onError }: { projectKey: string; onCreated: (name: string) => void; onError: (m: string | null) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="flex flex-wrap items-end gap-2" aria-label="Новый релиз на карте" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); onError(null);
      try { await pthApi.createRelease(projectKey, { name: name.trim(), description: '' }); onCreated(name.trim()); setName(''); }
      catch (err) { onError(err instanceof Error ? err.message : 'Не удалось создать релиз'); }
      finally { setBusy(false); }
    }}>
      <TextField label="Новый релиз" hint="название, например 0.2" value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
      <Button type="submit" variant="secondary" disabled={!name.trim() || busy} loading={busy}>Создать релиз</Button>
    </form>
  );
}

const CHECK_HINT: Record<string, string> = {
  verified: 'Проверено: все тесты требования прошли, результат новее последней правки',
  partial: 'Проверено частично: набор тестов неполный',
  failed: 'Проверка упала: последний запуск теста не прошёл',
  stale: 'Проверка устарела: требование или код изменились после последнего запуска',
  not_verified: 'Не проверено: тест не запускался или результат не подтверждён',
  no_test: 'Не проверено: у требования нет теста',
};

/** Как US взята в релиз: вместе со всеми уточняющими требованиями, частично или одна. */
function Dependencies({ d }: { d: { taken: number; total: number } | null }) {
  if (!d) return null;
  const full = d.total > 0 && d.taken === d.total;
  const none = d.total > 0 && d.taken === 0;
  const label = d.total === 0 ? 'нет ФТ' : full ? `с зависимостями ${d.taken}/${d.total}` : none ? `без зависимостей 0/${d.total}` : `частично ${d.taken}/${d.total}`;
  const hint = d.total === 0
    ? 'У этой US нет уточняющих ФТ, НФТ и AC, брать с ней нечего'
    : full ? 'US взята в релиз вместе со всеми уточняющими требованиями'
    : none ? `US взята в релиз одна: ни одного из ${d.total} уточняющих требований в релизе нет`
    : `В релиз взяты не все уточняющие требования: ${d.taken} из ${d.total}`;
  const tone = full ? 'border-success-text text-success-text' : d.total === 0 ? 'border-border text-text-muted' : 'border-warning-text text-warning-text';
  return (
    <Tooltip align="start" label={hint}>
      <span tabIndex={0} aria-label={`${label}. ${hint}`} className={`inline-flex rounded-full border px-1.5 py-0.5 text-meta ${tone}`}>{label}</span>
    </Tooltip>
  );
}
