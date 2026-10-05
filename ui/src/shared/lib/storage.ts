/** R22, X01: недоступное хранилище не ломает интерфейс — работаем в памяти сеанса. */
const memory = new Map<string, string>();

export function readStored(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeStored(key: string, value: string): void {
  memory.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* хранилище недоступно: значение остаётся в памяти сеанса */
  }
}

export function removeStored(key: string): void {
  memory.delete(key);
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* хранилище недоступно */
  }
}

export function readStoredJson<T>(key: string, fallback: T): T {
  const raw = readStored(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  writeStored(key, JSON.stringify(value));
}
