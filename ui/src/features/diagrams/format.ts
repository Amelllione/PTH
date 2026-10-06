/** Форматирование исходника схемы. SVG разбирается как XML и печатается с отступами в 2 пробела; при ошибке разбора возвращается null. */
export function formatSvg(source: string): string | null {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const walk = (node: Element, depth: number): string => {
    const pad = '  '.repeat(depth);
    const attrs = Array.from(node.attributes).map((a) => ` ${a.name}="${attr(a.value)}"`).join('');
    const kids = Array.from(node.childNodes).filter((n) => n.nodeType === 1 || (n.nodeType === 3 && (n.textContent ?? '').trim()));
    if (kids.length === 0) return `${pad}<${node.tagName}${attrs}/>`;
    // Элемент только с текстом остаётся в одну строку: так не меняется содержимое <text> и <title>.
    if (kids.every((n) => n.nodeType === 3)) return `${pad}<${node.tagName}${attrs}>${esc(node.textContent?.trim() ?? '')}</${node.tagName}>`;
    const inner = kids.map((n) => (n.nodeType === 1 ? walk(n as Element, depth + 1) : `${'  '.repeat(depth + 1)}${esc((n.textContent ?? '').trim())}`)).join('\n');
    return `${pad}<${node.tagName}${attrs}>\n${inner}\n${pad}</${node.tagName}>`;
  };
  return `${walk(doc.documentElement, 0)}\n`;
}

/** Mermaid: убирает пробелы в конце строк и лишние пустые строки, отступы автора не трогает. */
export function tidyMermaid(source: string): string {
  return `${source.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
