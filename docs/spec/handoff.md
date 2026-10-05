# Пакет передачи в разработку

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 21. Пакет передачи в разработку

### 21.1. Результаты реализации

1. Репозиторий server/worker/UI/MCP/SDK/skills и Docker Compose.
2. Миграции, model schemas и seed relation/validation/impact rules.
3. OpenAPI/JSON Schema, примеры import/change/context/CI manifests.
4. Реальный Claude Code skill pack SK-01–13, README подключения и eval cases.
5. UI экраны раздела 12 с integration tests критичных flows.
6. Provider-neutral Git connector и CI manifest tooling.
7. TEST/Evidence/PSI/coverage/readiness pipeline.
8. Backup/restore, observability и deployment guide.
9. Демонстрационный проект и собственная трассировка PTH требований до implementation commits.

Этот Markdown — спецификация. Он не является уже работающим сервером, OpenAPI implementation, установленным skill pack или UI.

### 21.2. Инструкция для старта Claude

~~~text
Используй принятую редакцию Project_Traceability_System_Spec как источник.
Не считай решения со статусом «предложение» уже принятыми, если пользователь
не принял документ целиком или не дал отдельное указание.

Сначала определи фазу:
— если PTH ещё не реализован, создай план E0–E6, contracts и backlog,
  сохраняя PTH-US/PTH-FR/PTH-NFR/PTH-AC ID и trace manifest в Git;
— если сервис доступен, импортируй принятую редакцию через pth-import-spec,
  сохрани происхождение, коллизии, gaps и результат раскладки.

При разработке фичи получай актуальный контекст и применимые ограничения.
Все правки canonical model выполняй через API/ChangeSet.
Предложения отделяй от принятых требований и решений.
Связывай фактические коммиты с конкретными редакциями требований.
Не объявляй выполнение требования доказанным только по commit link.
~~~

### 21.3. Технические источники

Источники ниже проверены 2026-10-04. Они подтверждают возможности внешних инструментов; модель PTH, API, thresholds и workflow этого документа являются проектными предложениями.

- [Claude Code: Skills](https://code.claude.com/docs/en/skills) — формат SKILL.md и supporting files; вызов скиллов в Claude Code.
- [Claude Code: MCP](https://code.claude.com/docs/en/mcp) — подключение внешних tools. Фактический transport/auth проверяется в целевой среде.
- [MCP: Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — tools schemas и annotations; версия протокола при реализации фиксируется отдельно.
- [Git: interpret-trailers](https://git-scm.com/docs/git-interpret-trailers) — парсинг структурированных trailers в commit messages.
