# Project Traceability Hub (PTH)

Рабочая спецификация и правила разработки сервиса трассировки требований. Кода пока нет.

- Источник: [Project_Traceability_System_Spec_v0.1.md](Project_Traceability_System_Spec_v0.1.md) — версия 0.1, проект для обсуждения.
- Для Claude и разработчиков: [CLAUDE.md](CLAUDE.md), затем [docs/index.md](docs/index.md).

## Синхронизация документации

```bash
python3 scripts/sync_spec.py
```

```bash
python3 scripts/sync_spec.py --check
```

## Запуск

API: см. [server/README.md](server/README.md). Коротко: `cd server && .venv/bin/python -m pth`, затем демо-данные `.venv/bin/python scripts/seed_demo.py`.

UI: `cd ui && npm install && npm run dev` (порт 5173, `/v1` проксируется на API). Storybook: `npm run storybook` (порт 6006).

Статус реализации по требованиям: [docs/implementation-status.md](docs/implementation-status.md).

## Структура

```text
Project_Traceability_System_Spec_v0.1.md   исходная спецификация (источник)
CLAUDE.md                                  навигатор и правила работы
scripts/sync_spec.py                       извлечения, реестр, паспорта SK
server/                                    FastAPI-срез API (модели, домен, тесты, openapi.json)
ui/                                        React + Storybook, компоненты из AI workspace
docs/
  index.md                                 карта документации
  spec/                                    извлечения по темам, реестр, структура ID, история
  spec/skills/                             паспорта SK-01…SK-13
  adr/                                     решения (ADR), шаблон
  skills-map.md, algorithms.md             карта скиллов, указатель алгоритмов
  planning.md, verification.md             план и проверка
  git-change-record.md                     запись результата в Git
```
