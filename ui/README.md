# PTH UI

React 19 + Vite 8 + Tailwind 4 + Storybook 10. Стилистика и примитивы — из `AI workspace`: токены `src/shared/styles/tokens.css`, компоненты `src/shared/ui`, тема `src/app/providers/ThemeProvider.tsx`.

## Команды

```bash
npm install
```

```bash
npm run dev
```

Открывает http://localhost:5173. Запросы `/v1` уходят на http://127.0.0.1:8000 (нужен запущенный API, см. [server/README.md](../server/README.md)).

```bash
npm run storybook
```

Storybook на порту 6006. Каждая история переключается между светлой и тёмной темой в тулбаре.

```bash
npm run test
```

Юнит-тесты раскладки графа.

```bash
npm run typecheck
```

```bash
npm run build-storybook
```

## Структура

- `src/features/lost/` — список потерянных элементов.
- `src/features/graph/` — холст графа (SVG), панель деталей, оболочка с фильтром.
- `src/shared/api/pthApi.ts` — тонкий клиент к API; доменных правил здесь нет.
- `src/features/pth/fixtures.ts` — демо-данные для историй.

## Переиспользование

Примитивы берутся из `src/shared/ui` (Button, Badge, Icon, Tabs, TextField, States, InlineAlert). Новые общие компоненты добавляй туда же, а не внутрь фичи, если их можно использовать повторно.
