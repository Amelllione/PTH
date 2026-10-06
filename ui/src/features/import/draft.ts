import type { Proposal } from '@/entities/pth/types';
import { locateQuote } from './quote';

export type ItemType = 'US' | 'FR' | 'NFR' | 'AC';

/** Элемент будущего черновика: правится в интерфейсе до создания. */
export interface DraftItem {
  ref: string;
  include: boolean;
  type: ItemType;
  title: string;
  text: string;
  priority: string | null;
  /** table — строка таблицы Markdown, llm — предложение модели. */
  via: 'table' | 'llm';
  action: 'created' | 'revised' | 'unchanged';
  display_id: string | null;
  external_key: string | null;
  number: number | null;
  line: number | null;
  cols: number[];
  quote: string | null;
  verified: boolean | null;
  model: string | null;
  /** Для существующего элемента: текущие значения, чтобы видеть, что меняется. */
  current: { title: string; text: string; priority: string | null } | null;
}

/** Связь черновика: source и target — ref элемента черновика или display_id существующего. */
export interface DraftLink {
  id: string;
  type: 'refines' | 'motivates';
  source: string;
  target: string;
  /** Откуда связь: найдена в столбце «Основание» или добавлена вручную. */
  origin: 'basis' | 'manual';
}

/** Допустимые типы концов связи, как на сервере (RELATION_RULES). */
export const LINK_RULES: Record<DraftLink['type'], { source: string[]; target: string[]; label: string }> = {
  refines: { source: ['FR', 'NFR', 'AC', 'US'], target: ['US', 'FR', 'NFR'], label: 'уточняет' },
  motivates: { source: ['US', 'FR', 'NFR'], target: ['ADR'], label: 'опирается на решение' },
};

export const TYPE_LABEL: Record<string, string> = { US: 'User story', FR: 'Функциональное', NFR: 'Нефункциональное', AC: 'Приёмочный критерий', ADR: 'Решение' };

export interface PreviewResponse {
  items: {
    ref: string; display_id: string; external_key: string; type: ItemType; number: number; title: string; text: string;
    priority: string | null; action: 'created' | 'revised' | 'unchanged'; current: DraftItem['current']; line: number; cols: number[]; basis: string;
  }[];
  relations: { type: 'refines'; source: string; target: string }[];
  unparsed: string[];
}

export function itemsFromPreview(prev: PreviewResponse): { items: DraftItem[]; links: DraftLink[] } {
  const items: DraftItem[] = prev.items.map((p) => ({
    ref: p.ref, include: p.action !== 'unchanged', type: p.type, title: p.title, text: p.text, priority: p.priority, via: 'table', action: p.action,
    display_id: p.display_id, external_key: p.external_key, number: p.number, line: p.line, cols: p.cols, quote: null, verified: null, model: null, current: p.current,
  }));
  const links: DraftLink[] = prev.relations.map((r, i) => ({ id: `b${i}`, type: r.type, source: r.source, target: r.target, origin: 'basis' }));
  return { items, links };
}

export function itemsFromProposals(proposals: Proposal[], text: string): DraftItem[] {
  return proposals.map((p, i) => {
    const spot = p.quote ? locateQuote(text, p.quote) : null;
    return {
      ref: `П${i + 1}`, include: Boolean(spot) && p.quote_verified, type: p.type, title: p.title, text: p.text, priority: null, via: 'llm', action: 'created',
      display_id: null, external_key: null, number: null, line: null, cols: [], quote: p.quote || null, verified: Boolean(spot), model: p.model, current: null,
    };
  });
}

/** Отметки для подсветки источника: строки таблицы и найденные цитаты. Только включённые элементы. */
export function marksOf(items: DraftItem[], text: string) {
  const marks: { display_id: string; line: number; end_line: number; via: 'table' | 'llm'; cols: number[]; quote?: string | null; verified?: boolean | null; start_col?: number | null; end_col?: number | null }[] = [];
  for (const it of items) {
    if (!it.include) continue;
    if (it.via === 'table' && it.line) marks.push({ display_id: it.ref, line: it.line, end_line: it.line, via: 'table', cols: it.cols });
    else if (it.quote) {
      const spot = locateQuote(text, it.quote);
      if (spot) marks.push({ display_id: it.ref, via: 'llm', cols: [], quote: it.quote, verified: it.verified, ...spot });
    }
  }
  return marks;
}
