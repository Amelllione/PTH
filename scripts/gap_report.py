"""Отчёт «что есть в спеке, но не реализовано». Пишет docs/gap-report.md.

Источники: реестр ID (docs/spec/requirements-registry.md), приложение A спеки (US → ФТ),
статусы из docs/implementation-status.md. Всё, чего нет в статусах, считается «не начато»,
потому что реализация не подтверждена.
    python3 scripts/gap_report.py
"""
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = ROOT / "Project_Traceability_System_Spec_v0.1.md"
REGISTRY = ROOT / "docs/spec/requirements-registry.md"
STATUS = ROOT / "docs/implementation-status.md"
OUT = ROOT / "docs/gap-report.md"

ORDER = ["реализовано", "проверено", "частично", "не выполнено", "не проверено", "не начато", "решение не принято"]
ID_ROW = re.compile(r"^\| (PTH-(?:FR|NFR|AC|US)-\d{3}|DEC-\d{2}|SK-\d{2}) \| (.*?) \|")
TYPE_NAME = {"FR": "ФТ", "NFR": "НФТ", "AC": "Приёмка", "US": "User Story", "DEC": "Решение", "SK": "Скилл"}


def norm(status: str) -> str:
    s = status.replace("*", "").strip().lower()
    if s.startswith("реализовано") or s.startswith("реализован"):
        return "реализовано"
    if s.startswith("частично"):
        return "частично"
    if s.startswith("не выполнено"):
        return "не выполнено"
    if s.startswith("не проверено"):
        return "не проверено"
    if s.startswith("не начато"):
        return "не начато"
    return s or "не начато"


def load_status() -> dict[str, str]:
    result = {}
    for line in STATUS.read_text(encoding="utf-8").splitlines():
        m = ID_ROW.match(line)
        if m:
            result[m.group(1)] = norm(m.group(2))
    return result


def load_registry_ids() -> list[str]:
    ids = []
    for line in REGISTRY.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\| ([A-Z]+(?:-[A-Z]+)?-?\d+) \|", line) or re.match(r"^\| (PTH-[A-Z]+-\d{3}|DEC-\d{2}|SK-\d{2}) \|", line)
        if m:
            ids.append(m.group(1))
    return ids


def load_us_to_fr() -> dict[str, list[str]]:
    """Приложение A: строка «PTH-US-NNN | PTH-FR-…, … | …»."""
    text = SPEC.read_text(encoding="utf-8")
    appendix = text[text.index("## Приложение A"):]
    mapping = {}
    for line in appendix.splitlines():
        m = re.match(r"^\| (PTH-US-\d{3}) \| (.*?) \|", line)
        if m:
            mapping[m.group(1)] = re.findall(r"PTH-FR-\d{3}", m.group(2))
    return mapping


def us_status(us: str, mapping: dict[str, list[str]], status: dict[str, str]) -> str:
    frs = mapping.get(us, [])
    if not frs:
        return "не начато"
    states = [status.get(fr, "не начато") for fr in frs]
    if all(s == "реализовано" for s in states):
        return "реализовано"
    if any(s in {"реализовано", "частично"} for s in states):
        return "частично"
    return "не начато"


def main() -> None:
    status = load_status()
    mapping = load_us_to_fr()
    rows = []
    for ident in load_registry_ids():
        kind = ident.split("-")[1] if ident.startswith("PTH-") else ident.split("-")[0]
        if ident.startswith("DEC-"):
            state = "решение не принято"
        elif ident.startswith("SK-"):
            state = "не начато"
        elif kind == "US":
            state = us_status(ident, mapping, status)
        else:
            state = status.get(ident, "не начато")
        rows.append((kind if kind in TYPE_NAME else ident.split("-")[0], ident, state))

    counts = defaultdict(Counter)
    for kind, _, state in rows:
        counts[kind][state] += 1

    lines = [
        "# Что в спеке ещё не реализовано",
        "",
        "> Сгенерировано `python3 scripts/gap_report.py`. Не править вручную: отчёт пересчитывается из реестра спеки, приложения A и [implementation-status](implementation-status.md).",
        "",
        "Статус «не начато» означает, что реализация не отмечена в статус-документе. Это не доказательство отсутствия кода: непроверенные части могут работать. Для DEC — решение ещё не принято пользователем.",
        "",
        "## Сводка",
        "",
        "| Тип | Всего | " + " | ".join(ORDER) + " |",
        "| --- | ---: | " + " | ".join("---:" for _ in ORDER) + " |",
    ]
    for kind in ["US", "FR", "NFR", "AC", "DEC", "SK"]:
        c = counts.get(kind, Counter())
        total = sum(c.values())
        lines.append(f"| {TYPE_NAME[kind]} | {total} | " + " | ".join(str(c.get(s, 0)) for s in ORDER) + " |")

    lines += ["", "## Не реализовано (всё, кроме «реализовано»)", ""]
    for kind in ["US", "FR", "NFR", "AC", "DEC", "SK"]:
        items = [(i, s) for k, i, s in rows if k == kind and s != "реализовано"]
        if not items:
            continue
        lines += [f"### {TYPE_NAME[kind]} — {len(items)}", "", "| ID | Статус |", "| --- | --- |"]
        lines += [f"| {i} | {s} |" for i, s in items]
        lines.append("")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"записано {OUT}")
    for kind in ["US", "FR", "NFR", "AC", "DEC", "SK"]:
        c = counts.get(kind, Counter())
        print(TYPE_NAME[kind], dict(c))


if __name__ == "__main__":
    main()
