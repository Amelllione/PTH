export interface QuoteSpot {
  line: number;
  end_line: number;
  start_col: number;
  end_col: number;
}

/** Где в тексте стоит цитата: пробелы и переносы сравниваются нестрого. null — такой фразы в тексте нет. */
export function locateQuote(text: string, quote: string): QuoteSpot | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const found = new RegExp(pattern).exec(text);
  if (!found) return null;
  const start = found.index;
  const end = start + found[0].length;
  const lineOf = (pos: number) => text.slice(0, pos).split('\n').length;
  const colOf = (pos: number) => pos - (text.lastIndexOf('\n', pos - 1) + 1);
  return { line: lineOf(start), end_line: lineOf(end), start_col: colOf(start), end_col: colOf(end) };
}
