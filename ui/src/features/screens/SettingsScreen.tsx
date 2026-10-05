import { useState } from 'react';
import { pthApi } from '@/shared/api/pthApi';
import { useAsync } from '@/shared/lib/useAsync';
import { Badge, Button, InlineAlert, Pager, TextField } from '@/shared/ui';
import { DataTable, Loaded, Section } from './common';
import type { AuditRow } from '@/entities/pth/types';

export function SettingsScreen({ projectKey }: { projectKey: string }) {
  const [version, setVersion] = useState(0);
  const me = useAsync(`me:${version}`, () => pthApi.me());
  const keys = useAsync(`keys:${version}`, () => pthApi.keys());
  const [auditPage, setAuditPage] = useState(0);
  const [auditSize, setAuditSize] = useState(20);
  const audit = useAsync(`audit:${projectKey}:${version}:${auditPage}:${auditSize}`, () =>
    pthApi.auditPage(projectKey, auditPage * auditSize, auditSize));
  const project = useAsync(`project:${projectKey}:${version}`, () => pthApi.projects());
  const [newName, setNewName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'reader' | 'writer'>('reader');
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issue = async () => {
    setError(null);
    setIssued(null);
    try {
      const r = await pthApi.createKey({ name: name.trim(), kind: 'service', project_key: projectKey, role });
      setIssued(r.token);
      setName('');
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выпустить ключ');
    }
  };

  const revoke = async (uid: string) => {
    setError(null);
    try {
      await pthApi.revokeKey(uid);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отозвать');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Текущий ключ">
        <Loaded state={me} retry={me.reload}>
          {(m) => (
            <div className="flex flex-wrap items-center gap-2 text-ui">
              <span>{m.name}</span>
              <Badge label={m.kind === 'admin' ? 'администратор' : `${m.role} · ${m.project_key}`} tone="accent" />
            </div>
          )}
        </Loaded>
      </Section>

      <Section title="Проект" hint="Переименовать может только администратор. Удаление проекта через интерфейс не предусмотрено: необратимая операция.">
        <form className="flex flex-wrap items-end gap-2" aria-label="Переименование проекта"
          onSubmit={async (e) => {
            e.preventDefault();
            setRenameError(null);
            try {
              await pthApi.renameProject(projectKey, newName.trim());
              setNewName('');
              setVersion((v) => v + 1);
            } catch (err) {
              setRenameError(err instanceof Error ? err.message : 'Не удалось переименовать');
            }
          }}>
          <TextField label="Новое название" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={200} className="w-72" />
          <Button type="submit" variant="secondary" disabled={!newName.trim()}>Переименовать</Button>
        </form>
        {renameError && <InlineAlert tone="danger" message={renameError} />}
        <Loaded state={project} retry={project.reload}>
          {(list) => <p className="text-meta text-text-muted">Текущее название: {list.find((p) => p.key === projectKey)?.name ?? '—'}</p>}
        </Loaded>
      </Section>

      <Section title="Журнал аудита" hint="Кто, что и когда изменил в проекте. Записи только добавляются.">
        <Loaded state={audit} retry={audit.reload} empty={{ title: 'Записей нет', isEmpty: (d) => d.items.length === 0 }}>
          {({ items: rows, total }: { items: AuditRow[]; total: number }) => (
            <>
            <DataTable caption="Журнал аудита" columns="10rem 9rem 12rem minmax(0,1fr) minmax(0,1.4fr)"
              footer={<Pager page={auditPage} pageSize={auditSize} total={total} onPage={setAuditPage} onPageSize={(s) => { setAuditSize(s); setAuditPage(0); }} label="Страницы журнала" />} headers={['Когда', 'Кто', 'Действие', 'Объект', 'Детали']}
              rows={rows.map((r) => [
                new Date(r.created_at).toLocaleString('ru-RU'),
                r.actor,
                r.action,
                <span key="t" className="font-mono text-meta">{r.target ?? '—'}</span>,
                <span key="d" className="font-mono text-meta">{JSON.stringify(r.details)}</span>,
              ])} />
            </>
          )}
        </Loaded>
      </Section>

      <Section title="Ключи доступа" hint="Токен показывается один раз. Выпускать и отзывать ключи может только администратор.">
        <div className="flex flex-wrap items-end gap-2">
          <TextField label="Имя ключа" hint="например ci-bot" value={name} onChange={(e) => setName(e.target.value)} className="w-56" />
          <label className="flex flex-col gap-1 text-meta text-text-muted">
            Роль в проекте {projectKey}
            <select value={role} onChange={(e) => setRole(e.target.value as 'reader' | 'writer')} className="h-9 rounded-control border border-control-border bg-surface px-2 text-ui text-text">
              <option value="reader">только чтение</option><option value="writer">чтение и запись</option>
            </select>
          </label>
          <Button variant="primary" disabled={!name.trim()} onClick={() => void issue()}>Выпустить ключ</Button>
        </div>
        {issued && (
          <InlineAlert tone="success" message={`Новый токен (скопируйте сейчас, второй раз он не показывается): ${issued}`} />
        )}
        {error && <InlineAlert tone="danger" message={error} />}
        <Loaded state={keys} retry={keys.reload} empty={{ title: 'Ключей нет', isEmpty: (d) => d.length === 0 }}>
          {(rows) => (
            <DataTable caption="Ключи" headers={['Имя', 'Тип', 'Проект', 'Роль', 'Статус', '']}
              rows={rows.map((k) => [k.name, k.kind, k.project_key ?? 'все', k.role ?? 'admin',
                k.revoked ? 'отозван' : 'действует',
                k.revoked ? '' : <button key={k.uid} type="button" className="underline" onClick={() => void revoke(k.uid)}>отозвать</button>])} />
          )}
        </Loaded>
      </Section>
    </div>
  );
}
