import { createContext, useContext } from 'react';

/** Куда открыть источник: документ импорта, строка и требование, которое оттуда получено. */
export interface SourceFocus {
  uid: string;
  line: number;
  displayId?: string;
}

/** Переход к источнику из любого места интерфейса. Вне провайдера значение null: кнопки перехода не показываются. */
export const SourceNavContext = createContext<((focus: SourceFocus) => void) | null>(null);

export const useOpenSource = () => useContext(SourceNavContext);
