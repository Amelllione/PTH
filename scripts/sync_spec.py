#!/usr/bin/env python3
"""Синхронизация спецификации PTH с извлечениями в docs/spec.

python3 scripts/sync_spec.py          пересобрать извлечения, реестр и паспорта SK
python3 scripts/sync_spec.py --check  проверить актуальность; код 1 при расхождении

Исходник: Project_Traceability_System_Spec_v0.1.md в корне репозитория.
Разделы привязываются по заголовкам «## N.», а не по номерам строк: после правки
спеки извлечения пересобираются без ручной подгонки. Неразнесённый раздел — ошибка.
ADR создаются только если их ещё нет и потом ведутся вручную.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Project_Traceability_System_Spec_v0.1.md"
SPEC_DIR = ROOT / "docs" / "spec"
SKILLS_DIR = SPEC_DIR / "skills"
ADR_DIR = ROOT / "docs" / "adr"

# файл извлечения -> (заголовок, префиксы разделов верхнего уровня)
EXTRACTS = {
    "foundation.md": ("Основания и границы", ["## 1."]),
    "user-stories.md": ("Роли, сценарии и User Story", ["## 2.", "## 3."]),
    "functional-requirements.md": ("Функциональные требования", ["## 4."]),
    "data-model.md": ("Модель данных и правила связей", ["## 5.", "## 6."]),
    "workflows.md": ("ChangeSet, согласованность и импорт", ["## 7.", "## 8."]),
    "api.md": ("API-сервер", ["## 9."]),
    "context-and-mcp.md": ("Контекст ИИ, MCP и скиллы", ["## 10.", "## 11."]),
    "ui.md": ("UI для просмотра, анализа и изменения", ["## 12."]),
    "git-trace.md": ("Трассировка до Git-коммитов", ["## 13."]),
    "quality.md": ("Качество требований, свидетельства и ПСИ", ["## 14."]),
    "architecture.md": ("Архитектура и реализация", ["## 15."]),
    "nonfunctional.md": ("Нефункциональные требования", ["## 16."]),
    "acceptance.md": ("Приёмочные сценарии и трассировка", ["## 17.", "## Приложение A"]),
    "delivery.md": ("Порядок разработки и метрики", ["## 18.", "## 19."]),
    "defaults.md": ("Решения, требующие принятия", ["## 20."]),
    "handoff.md": ("Пакет передачи в разработку", ["## 21."]),
}

# DEC-NN -> slug для имени ADR (ADR-00NN-slug.md)
DEC_SLUGS = {
    "01": "canonical-source",
    "02": "first-client",
    "03": "deployment",
    "04": "git-platform",
    "05": "autonomy",
    "06": "source-formats",
    "07": "psi-format",
    "08": "team-size",
    "09": "load-slo",
    "10": "llm-in-service",
    "11": "schema-extensibility",
    "12": "retention",
    "13": "lost-requirements-definition",
}

ID_RE = re.compile(r"\b(PTH-(?:US|FR|NFR|AC)-\d{3}|DEC-\d{2}|SK-\d{2})\b")
TYPE_ORDER = {"PTH-US": 0, "PTH-FR": 1, "PTH-NFR": 2, "PTH-AC": 3, "DEC": 4, "SK": 5}
TYPE_NAME = {"PTH-US": "User Story", "PTH-FR": "ФТ", "PTH-NFR": "НФТ",
             "PTH-AC": "Приёмка", "DEC": "Решение", "SK": "Скилл"}
SK_ROW = re.compile(r"^\| SK-(\d{2}) / ([\w-]+) \| ")
DEC_ROW = re.compile(r"^\| DEC-(\d{2}) \| ")


def file_for_heading(line):
    for name, (_, prefixes) in EXTRACTS.items():
        if any(line.startswith(p) for p in prefixes):
            return name
    return None


def read_lines():
    return SOURCE.read_text(encoding="utf-8").splitlines()


def check_coverage(lines):
    unmapped = [l for l in lines if l.startswith("## ") and file_for_heading(l) is None]
    if unmapped:
        sys.exit("Не разнесены разделы спеки (добавь в EXTRACTS): " + "; ".join(unmapped))


def build_extracts(lines):
    chunks = {name: [] for name in EXTRACTS}
    current = None
    for line in lines:
        if line.startswith("## "):
            current = file_for_heading(line)
        if current is not None:
            chunks[current].append(line)
    out = {}
    for name, (title, _) in EXTRACTS.items():
        body = "\n".join(chunks[name]).rstrip() + "\n"
        out[SPEC_DIR / name] = (
            f"# {title}\n\n"
            f"> Извлечено из `{SOURCE.name}`. Не редактировать вручную: `python3 scripts/sync_spec.py`.\n\n"
            f"{body}"
        )
    return out


def build_registry(lines):
    found = {}
    current = None
    for n, line in enumerate(lines, 1):
        if line.startswith("## "):
            current = file_for_heading(line)
        for m in ID_RE.finditer(line):
            found.setdefault(m.group(1), (n, current))
    ids = sorted(found, key=lambda i: (TYPE_ORDER[prefix_of(i)], i))
    counts = {}
    for i in ids:
        counts[TYPE_NAME[prefix_of(i)]] = counts.get(TYPE_NAME[prefix_of(i)], 0) + 1
    out = [
        "# Реестр ID",
        "",
        f"> Сгенерировано из `{SOURCE.name}`. Не редактировать вручную: `python3 scripts/sync_spec.py`.",
        "",
        "Всего: " + ", ".join(f"{k} — {v}" for k, v in counts.items()) + ".",
        "",
        "| ID | Тип | Строка в спеке | Извлечение |",
        "| --- | --- | --- | --- |",
    ]
    for i in ids:
        n, name = found[i]
        link = f"[{name}]({name})" if name else "—"
        out.append(f"| {i} | {TYPE_NAME[prefix_of(i)]} | {n} | {link} |")
    return {SPEC_DIR / "requirements-registry.md": "\n".join(out) + "\n"}


def prefix_of(identifier):
    if identifier.startswith("PTH-"):
        return "-".join(identifier.split("-")[:2])
    return identifier.split("-")[0]


def build_skills(lines):
    rows = []
    for line in lines:
        m = SK_ROW.match(line)
        if m:
            cells = line.strip()[2:-2].split(" | ")
            assert len(cells) == 4, line
            rows.append((m.group(1), m.group(2), cells[1], cells[2], cells[3]))
    common = next(l for l in lines if l.startswith("Каждый скилл обязан"))
    out = {}
    index = [
        "# Паспорта скиллов SK-01…SK-13",
        "",
        f"> Сгенерировано из раздела 11.2 `{SOURCE.name}`. Не редактировать вручную: `python3 scripts/sync_spec.py`.",
        "",
        "Скиллы — часть разработки; исполняемых `SKILL.md` пока нет (статус planned). "
        "Целевой формат: `.claude/skills/<name>/SKILL.md`. Этапы — в [skills-map](../../skills-map.md).",
        "",
        "| ID | Имя | Паспорт |",
        "| --- | --- | --- |",
    ]
    for num, name, inp, outp, limits in rows:
        fname = f"SK-{num}-{name}.md"
        index.append(f"| SK-{num} | {name} | [{fname}]({fname}) |")
        out[SKILLS_DIR / fname] = "\n".join([
            f"# SK-{num} — {name}",
            "",
            f"> Сгенерировано из раздела 11.2 `{SOURCE.name}`. Не редактировать вручную.",
            "",
            "- Статус: planned — реализации нет.",
            f"- Целевой путь: `.claude/skills/{name}/SKILL.md`",
            "- Индекс: [skills](index.md)",
            "",
            "## Вход и обязательные шаги",
            "",
            inp,
            "",
            "## Выход",
            "",
            outp,
            "",
            "## Ошибки и границы",
            "",
            limits,
            "",
        ])
    index += ["", "## Общие правила", "", common, ""]
    out[SKILLS_DIR / "index.md"] = "\n".join(index)
    return out


def write_adrs_if_missing(lines):
    ADR_DIR.mkdir(parents=True, exist_ok=True)
    listing = [
        "# Индекс ADR",
        "",
        "Все решения из [defaults](../spec/defaults.md) (DEC-01…12) заведены как **Proposed** — "
        "рабочие варианты из спеки, пока пользователь не принял документ. Статус меняет только пользователь.",
        "",
        "| ADR | Статус | Вопрос | Источник |",
        "| --- | --- | --- | --- |",
    ]
    for line in lines:
        m = DEC_ROW.match(line)
        if not m:
            continue
        num = m.group(1)
        cells = line.strip()[2:-2].split(" | ")
        question, working, changes = cells[1], cells[2], cells[3]
        slug = DEC_SLUGS[num]
        fname = f"ADR-{int(num):04d}-{slug}.md"
        listing.append(f"| [ADR-{int(num):04d}]({fname}) | Proposed | {question} | [DEC-{num}](../spec/defaults.md) |")
        if any(p.name.startswith(f"ADR-{int(num):04d}-") for p in ADR_DIR.iterdir()):
            continue
        (ADR_DIR / fname).write_text("\n".join([
            f"# ADR-{int(num):04d} — {question}",
            "",
            "- Статус: Proposed (рабочий вариант, ждёт решения пользователя)",
            "- Дата: 2026-10-04",
            "- Supersedes: —",
            f"- Связанные требования: [DEC-{num}](../spec/defaults.md)",
            "",
            "## Контекст",
            "",
            f"{question}. Вопрос раздела 20 спеки, DEC-{num}.",
            "",
            "## Рассмотренные варианты",
            "",
            f"1. Рабочий вариант: {working}.",
            f"2. Альтернатива: {changes}.",
            "",
            "## Решение и причины",
            "",
            f"Для старта разработки взят рабочий вариант: {working}. "
            "Спека предлагает его как исходный; это предложение, а не согласованное решение.",
            "",
            "## Последствия",
            "",
            changes + ".",
            "",
            "## Условия пересмотра",
            "",
            "Пересмотреть после решения пользователя по документу или при изменении нагрузки, состава команды, клиентов или Git-платформы.",
            "",
        ]), encoding="utf-8")
    listing.append("")
    if not (ADR_DIR / "index.md").exists():
        (ADR_DIR / "index.md").write_text("\n".join(listing), encoding="utf-8")


def main():
    check = "--check" in sys.argv
    lines = read_lines()
    check_coverage(lines)
    expected = {}
    expected.update(build_extracts(lines))
    expected.update(build_registry(lines))
    expected.update(build_skills(lines))

    drift = [p for p, text in expected.items()
             if not p.exists() or p.read_text(encoding="utf-8") != text]
    if check:
        if drift:
            print("Расхождения с исходником:")
            for p in drift:
                print(f" - {p.relative_to(ROOT)}")
            sys.exit(1)
        print(f"OK: {len(expected)} генерируемых файлов актуальны")
        return

    for path, text in expected.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    write_adrs_if_missing(lines)
    print(f"Записано генерируемых файлов: {len(expected)}")


if __name__ == "__main__":
    main()
