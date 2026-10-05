# ADR-0004 — Git platform

- Статус: Proposed (рабочий вариант, ждёт решения пользователя)
- Дата: 2026-10-04
- Supersedes: —
- Связанные требования: [DEC-04](../spec/defaults.md)

## Контекст

Git platform. Вопрос раздела 20 спеки, DEC-04.

## Рассмотренные варианты

1. Рабочий вариант: Provider-neutral read-only remote + manifest API.
2. Альтернатива: PR-specific integration добавляет provider auth/webhooks.

## Решение и причины

Для старта разработки взят рабочий вариант: Provider-neutral read-only remote + manifest API. Спека предлагает его как исходный; это предложение, а не согласованное решение.

## Последствия

PR-specific integration добавляет provider auth/webhooks.

## Условия пересмотра

Пересмотреть после решения пользователя по документу или при изменении нагрузки, состава команды, клиентов или Git-платформы.
