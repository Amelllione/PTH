# Карта скиллов

Паспорта: [spec/skills](spec/skills/index.md). Этапы — из [раздела 18.1](spec/delivery.md). Скиллы создаются вместе со своими серверными операциями, а не «после backend».

| Скилл | Назначение | Этап | Примечание |
| --- | --- | --- | --- |
| [SK-01 pth-import-spec](spec/skills/SK-01-pth-import-spec.md) | Импорт принятой спеки | E2 | Зависит от source identity и ChangeSet |
| [SK-02 pth-project-context](spec/skills/SK-02-pth-project-context.md) | Контекст для задачи | E2 | Зависит от ContextBundle и capabilities |
| [SK-03 pth-change](spec/skills/SK-03-pth-change.md) | Изменение через ChangeSet | E3 | Правки только через API |
| [SK-04 pth-impact](spec/skills/SK-04-pth-impact.md) | Анализ влияния | E3 | Нужны типизированные связи и ревизии |
| [SK-05 pth-requirements-review](spec/skills/SK-05-pth-requirements-review.md) | Проверка требований | E3 | — |
| [SK-06 pth-architecture](spec/skills/SK-06-pth-architecture.md) | Архитектурные предложения | не назначен | §18.1 не задаёт этап — уточнить при планировании |
| [SK-07 pth-plan-implementation](spec/skills/SK-07-pth-plan-implementation.md) | План реализации | E4 | Не повышает статус реализации |
| [SK-08 pth-implement-traced](spec/skills/SK-08-pth-implement-traced.md) | Реализация с трассировкой | E4 | — |
| [SK-09 pth-register-code](spec/skills/SK-09-pth-register-code.md) | Регистрация коммитов | E4 | Указание ID в сообщении не равно доказательству |
| [SK-10 pth-build-psi](spec/skills/SK-10-pth-build-psi.md) | Черновик ПСИ | E5 | Пороги не придумываются |
| [SK-11 pth-verify-compliance](spec/skills/SK-11-pth-verify-compliance.md) | Проверка соответствия | E5 | ИИ-заключение без теста не получает pass |
| [SK-12 pth-project-answer](spec/skills/SK-12-pth-project-answer.md) | Ответы по проекту | не назначен | §18.1 не задаёт этап — уточнить |
| [SK-13 pth-release-baseline](spec/skills/SK-13-pth-release-baseline.md) | Релизный baseline | E5 | Принятие релиза — отдельное право |
