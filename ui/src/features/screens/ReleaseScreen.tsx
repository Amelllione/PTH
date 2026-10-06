import { useState } from 'react';
import { Button, Tabs } from '@/shared/ui';
import { ReleasesPanel } from './ReleasesPanel';
import { StoryMapPanel } from './StoryMapPanel';
import { ArtifactCard } from './ArtifactCard';

/** Вкладка «Релиз»: релизы как наборы требований с фиксацией и выпуском по тегу, USM (карта историй).
 *  US, открытая с USM, живёт в отдельной вкладке рядом, как коммит на вкладке «Код». */
export function ReleaseScreen({ projectKey }: { projectKey: string }) {
  const [tab, setTab] = useState<string>('releases');
  const [open, setOpen] = useState<string[]>([]);
  const openCard = (id: string) => {
    setOpen((o) => (o.includes(id) ? o : [...o, id]));
    setTab(`a:${id}`);
  };
  const closeCard = (id: string) => {
    setOpen((o) => o.filter((x) => x !== id));
    setTab('map');
  };
  return (
    <div className="flex flex-col gap-4">
      <Tabs label="Разделы релиза" idPrefix="release" selectedId={tab} onChange={setTab}
        items={[{ id: 'releases', label: 'Релизы' }, { id: 'map', label: 'USM' }, ...open.map((id) => ({ id: `a:${id}`, label: id }))]} />
      <div role="tabpanel" id={`release-panel-${tab}`} aria-labelledby={`release-tab-${tab}`}>
        {tab === 'releases' && <ReleasesPanel projectKey={projectKey} />}
        {tab === 'map' && <StoryMapPanel projectKey={projectKey} onOpenCard={openCard} />}
        {tab.startsWith('a:') && <CardTab key={tab} projectKey={projectKey} id={tab.slice(2)} onClose={() => closeCard(tab.slice(2))} />}
      </div>
    </div>
  );
}

/** Содержимое вкладки US: карточка; переход по связям меняет показываемый элемент внутри вкладки. */
function CardTab({ projectKey, id, onClose }: { projectKey: string; id: string; onClose: () => void }) {
  const [shown, setShown] = useState(id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Закрыть вкладку</Button>
        {shown !== id && <Button variant="secondary" size="sm" onClick={() => setShown(id)}>Вернуться к {id}</Button>}
      </div>
      <ArtifactCard key={shown} projectKey={projectKey} displayId={shown} onOpen={setShown} />
    </div>
  );
}
