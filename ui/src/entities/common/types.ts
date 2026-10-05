/** Общие типы доменного слоя. Раздел 5.3 ТЗ. */

export type Id = string;
export type IsoDateTime = string;

/** Права проверяет сервер (R20). Скрытая кнопка не является защитой. */
export type Capabilities = Readonly<Record<string, boolean>>;

/** R02: канонические области материала. */
export type MaterialScope = 'request' | 'chat' | 'workspace' | 'btw';

export type RunState =
  'queued' | 'running' | 'streaming' | 'cancel_requested' | 'cancelled' | 'completed' | 'failed';

/** R21: транспорт не равен состоянию запуска. */
export type TransportState = 'online' | 'disconnected' | 'reconnecting' | 'reconciling' | 'failed';

export type PanelView =
  | { kind: 'closed' }
  | { kind: 'materials'; chatId: Id }
  | { kind: 'file'; materialId: Id; versionId?: Id }
  | { kind: 'sources'; answerId: Id; chunkId?: Id }
  | { kind: 'model'; modelId: Id }
  | { kind: 'user'; userId: Id }
  /** C24: персональные закладки на сообщения. */
  | { kind: 'saved' }
  /** S16: компактная история чата — дерево веток и вариантов (X19). */
  | { kind: 'history'; chatId: Id }
  /** S18: карточка задачи рядом с её чатом (X28). */
  | { kind: 'task'; taskId: Id }
  | { kind: 'connection'; connectionId: Id };

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** 5.5: стабильный code, безопасное сообщение, признак повтора. */
export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'quota_exceeded'
  | 'unsupported_format'
  | 'processing_failed'
  | 'provider_unavailable'
  | 'context_overflow'
  | 'validation_failed'
  | 'network_unavailable';

export interface ApiError {
  code: ApiErrorCode;
  /** Текст для пользователя: без стеков и секретов. */
  message: string;
  retryable: boolean;
  correlationId: string;
  /** Ошибки полей формы: имя поля → сообщение. */
  fieldErrors?: Readonly<Record<string, string>>;
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
