# Решения, требующие принятия

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 20. Решения, требующие принятия

Вопросы ниже не блокируют чтение спецификации. У каждого есть выбранный рабочий вариант; при принятии документа его можно оставить или изменить.

| ID | Вопрос | Рабочий вариант | Что меняется при другом выборе |
| --- | --- | --- | --- |
| DEC-01 | Канонические требования в файлах или сервисе? | После импорта — сервис; файлы — источники/exports | File-first требует двусторонней синхронизации и правил merge |
| DEC-02 | Первый клиент Claude? | Claude Code | Claude Desktop/claude.ai требуют отдельного подключения/eval |
| DEC-03 | Deployment | Self-hosted Docker Compose | SaaS требует tenancy, billing/операционный SLA |
| DEC-04 | Git platform | Provider-neutral read-only remote + manifest API | PR-specific integration добавляет provider auth/webhooks |
| DEC-05 | Автономность | Принятый import scope и delegated tasks без повторных подтверждений; новые решения по policy | Более строгий/свободный режим меняет capabilities и UI review |
| DEC-06 | Формат источника P0 | Markdown/text/JSON | DOCX/PDF parsing существенно расширяет import |
| DEC-07 | ПСИ P0 | Versioned model + Markdown/JSON/CSV | Корпоративный DOCX export — отдельный шаблон/adaptor |
| DEC-08 | Размер команды | Один владелец, несколько проектов, scoped service accounts | Массовая команда требует дополнительных collaboration/SLA целей |
| DEC-09 | Нагрузка и SLO | Reference deployment раздела 16 | После реальных volumes обновляются NFR и acceptance load suite |
| DEC-10 | LLM внутри сервиса | Нет обязательного LLM; Claude приносит proposals/findings | Server-side agents требуют provider routing, quotas и eval |
| DEC-11 | Schema extensibility | Фиксированный versioned набор P0, API изменения в P1 | Полная динамическая схема в P0 усложняет migrations/UI/rules |
| DEC-12 | Retention исходников/кода | Исторические revisions и источники сохраняются; code anchored в Git | Изменение хранения влияет на replay/restore и access |
| DEC-13 | Что считать потерянным элементом? | Потерянные: (а) FR, NFR, AC без implements от COMMIT и без обоснованного исключения; (б) US без refines от ФТ и без motivates к ADR; (в) фрагменты источника без сопоставления. Отсутствие TEST — отдельное состояние «не проверено», не «потеряно» | Строгое определение (с TEST) расширит список и шум; узкое (только код) скроет user story без отражения в ФТ/ADR |

Open issue: как именно подтверждение принятия внешнего текста передаётся Claude. Предлагается пользовательская инструкция с hash/source revision, записанная сервисным аккаунтом on_behalf_of; если требуется независимое подтверждение личности, добавить UI acceptance command/одноразовый signed import token.

Open issue: корпоративная структура и обязательные разделы ПСИ. До получения шаблона используется структура раздела 14.5.

Open issue: конкретный Git host и auth. До уточнения адаптер работает с настроенным remote и read-only credentials; нельзя обещать готовые deep links на PR всех платформ.
