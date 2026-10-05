import { Button } from '@/shared/ui';
import type { ProjectInfo } from '@/entities/pth/types';

export interface ProjectSwitcherProps {
  projects: ProjectInfo[];
  value: string;
  onChange: (key: string) => void;
  onCreate: () => void;
}

/** Выбор проекта. Проект — отдельное пространство спек, требований и связей. */
export function ProjectSwitcher({ projects, value, onChange, onCreate }: ProjectSwitcherProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-meta text-text-muted">
          Проект
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 min-w-48 rounded-control border border-control-border bg-surface px-2 text-ui text-text"
          >
            {projects.length === 0 && <option value={value}>{value} (ещё не создан)</option>}
            {projects.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key} — {p.name}
              </option>
            ))}
            {projects.length > 0 && !projects.some((p) => p.key === value) && (
              <option value={value}>{value} (нет в списке)</option>
            )}
          </select>
        </label>
        <Button variant="secondary" onClick={onCreate}>Новый проект</Button>
      </div>
    </div>
  );
}
