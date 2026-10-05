"""Разбиение спецификации на фрагменты для модели: по заголовкам, затем по абзацам."""
import re


def split_spec(text: str, max_chars: int = 3000) -> list[tuple[str, str]]:
    """Возвращает (заголовок, текст) для каждого фрагмента. Фрагмент не длиннее max_chars,
    кроме одиночного абзаца, который сам длиннее лимита (его модель всё равно получит целиком)."""
    sections: list[tuple[str, list[str]]] = []
    title = "(начало)"
    buf: list[str] = []
    for line in text.splitlines():
        if re.match(r"^#{1,4} ", line):
            if any(s.strip() for s in buf):
                sections.append((title, buf))
            title, buf = line.lstrip("#").strip(), [line]
        else:
            buf.append(line)
    if any(s.strip() for s in buf):
        sections.append((title, buf))

    chunks: list[tuple[str, str]] = []
    for title, lines in sections:
        current = ""
        for paragraph in re.split(r"\n\s*\n", "\n".join(lines)):
            paragraph = paragraph.strip("\n")
            if not paragraph.strip():
                continue
            if current and len(current) + len(paragraph) + 2 > max_chars:
                chunks.append((title, current.strip()))
                current = ""
            current = f"{current}\n\n{paragraph}" if current else paragraph
        if current.strip():
            chunks.append((title, current.strip()))
    return chunks
