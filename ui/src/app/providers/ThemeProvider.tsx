import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ResolvedTheme, ThemePreference } from '@/entities/common/types';
import { readStored, writeStored } from '@/shared/lib/storage';

const STORAGE_KEY = 'aiw.theme-preference';

/**
 * Каталог задаёт тему панелью «Тема» (управляемое значение) и не пишет выбор в хранилище
 * приложения. Чтобы переключатель внутри истории не сбрасывался при её перемонтировании,
 * помним выбор на время сеанса предпросмотра. Запись привязана к значению панели: как только
 * на панели выбирают другую тему, прежний выбор перестаёт подходить и не применяется.
 */
let catalogOverride: { base: ThemePreference; value: ThemePreference } | null = null;

function isPreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function systemTheme(): ResolvedTheme {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readStoredPreference(): ThemePreference {
  const stored = readStored(STORAGE_KEY);
  return isPreference(stored) ? stored : 'system';
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Управляемое значение для каталога компонентов. */
  preference?: ThemePreference;
}

/** X01: тему применяет общий провайдер, а не локальные эффекты компонентов. */
export function ThemeProvider({ children, preference: controlled }: ThemeProviderProps) {
  const [stored, setStored] = useState<ThemePreference>(() =>
    controlled
      ? catalogOverride?.base === controlled
        ? catalogOverride.value
        : controlled
      : readStoredPreference(),
  );
  // Управляемое значение (панель «Тема» каталога) задаёт исходную тему, а переключатель
  // внутри истории меняет её поверх; смена значения на панели снова применяется.
  const [lastControlled, setLastControlled] = useState(controlled);
  if (controlled !== lastControlled) {
    setLastControlled(controlled);
    if (controlled) setStored(controlled);
  }
  const preference = stored;
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const onChange = () => setSystem(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = preference === 'system' ? system : preference;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setStored(next);
      // В каталоге выбор живёт только в истории и не записывается в предпочтение приложения.
      if (controlled === undefined) writeStored(STORAGE_KEY, next);
      else catalogOverride = { base: controlled, value: next };
    },
    [controlled],
  );

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider не найден выше по дереву.');
  return value;
}
