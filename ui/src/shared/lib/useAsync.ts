import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Загрузка с отменой устаревших ответов. `key` задаёт запрос: смена ключа перезапускает загрузку.
 * `null` — запроса нет (например, ещё не выбран узел).
 */
export function useAsync<T>(key: string | null, load: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: false });

  useEffect(() => {
    if (key === null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    load()
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : 'Неизвестная ошибка',
            loading: false,
          });
        }
      });
    return () => {
      active = false;
    };
    // load соответствует текущему key; перезапуск — через key или reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
