# Функциональные требования

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 4. Функциональные требования

ФТ ниже описывают обязательное поведение сервиса. Столбец «Основание» обеспечивает трассировку к User Story. Подробные контракты — в разделах 5–16.

### 4.1. Проекты, идентичность и история

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-001 | Сервер создаёт Project с неизменяемым project_key и независимыми правами | PTH-US-001, PTH-US-049 |
| PTH-FR-002 | Сервер выдаёт глобальный entity_uid и удобный display_id; клиент не может изменять/повторно использовать их | PTH-US-004, PTH-US-009 |
| PTH-FR-003 | Все изменения текста/атрибутов создают новые immutable revisions; исходная редакция сохраняется | PTH-US-012 |
| PTH-FR-004 | Для сущности сохраняются тип, lifecycle, автор, канал, источник, атрибуты и причина изменения | PTH-US-003, PTH-US-012 |
| PTH-FR-005 | Внешние ID хранятся как namespaced aliases; коллизия блокирует автоматическое сопоставление | PTH-US-004, PTH-US-008 |
| PTH-FR-006 | Архивирование, разделение, объединение и замена сохраняют историю и преемственность | PTH-US-014, PTH-US-022 |
| PTH-FR-007 | API поддерживает версионированные определения типов/полей с проверяемой миграцией | PTH-US-015, PTH-US-053 |
| PTH-FR-008 | Поиск поддерживает точный ID, полнотекстовый запрос, фильтры и cursor pagination | PTH-US-013, PTH-US-028 |

### 4.2. Источники и импорт

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-009 | SourceDocument хранит неизменяемые bytes/text, hash, формат и сведения о принятии конкретной редакции | PTH-US-002 |
| PTH-FR-010 | ImportSession содержит manifest частей и состояние их обработки; обработка повторяемая | PTH-US-003, PTH-US-006 |
| PTH-FR-011 | Извлечённая сущность ссылается на SourceFragment и цитату; вывод ИИ имеет provenance | PTH-US-003, PTH-US-007 |
| PTH-FR-012 | Импорт формирует черновой ChangeSet и не меняет канонические данные до apply | PTH-US-002, PTH-US-008, PTH-US-016 |
| PTH-FR-013 | Сервер проверяет полноту disposition исходных фрагментов и показывает непокрытые части | PTH-US-005, PTH-US-052 |
| PTH-FR-014 | Неоднозначности, противоречия и новые предложения сохраняются отдельно; принятие текста их не легализует | PTH-US-007, PTH-US-021 |
| PTH-FR-015 | Повторный импорт сохраняет IDs и предлагает semantic/structural diff; fuzzy match не выполняет слияние автоматически | PTH-US-004, PTH-US-008 |
| PTH-FR-016 | API поддерживает приостановку, продолжение и отмену ImportSession без частичной порчи модели | PTH-US-006, PTH-US-051 |

### 4.3. Связи и покрытие

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-017 | Relation имеет тип, направление, scope, lifecycle, evidence_basis и историю | PTH-US-010, PTH-US-011, PTH-US-027 |
| PTH-FR-018 | Сервер валидирует допустимые пары типов, проект, self-links, cardinality и запрещённые циклы | PTH-US-010, PTH-US-039 |
| PTH-FR-019 | API выдаёт входящие и исходящие связи, paths и локальный подграф с лимитами | PTH-US-034, PTH-US-046 |
| PTH-FR-020 | Предложенная ИИ связь не используется как подтверждённое покрытие до предусмотренного policy-перехода | PTH-US-027, PTH-US-039 |
| PTH-FR-021 | Coverage рассчитывается по применимым обязанностям, типам связей и состоянию редакций | PTH-US-039, PTH-US-042 |
| PTH-FR-022 | Обоснованное исключение имеет scope, срок, автора и аудит; отображается отдельно от покрытия | PTH-US-045 |

### 4.4. Изменения и анализ влияния

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-023 | Любая доменная мутация выполняется через ChangeSet/command API, включая UI, MCP и интеграции | PTH-US-016, PTH-US-026, PTH-US-047 |
| PTH-FR-024 | ChangeSet атомарно применяет изменения артефактов, связей, статусов и аудит | PTH-US-016 |
| PTH-FR-025 | Expected revision и graph_revision предотвращают перезапись устаревшего состояния | PTH-US-020 |
| PTH-FR-026 | Idempotency-Key обеспечивает повтор команды без повторного эффекта | PTH-US-006, PTH-US-016, PTH-US-037 |
| PTH-FR-027 | Анализ сравнивает base и proposed snapshot и использует правила влияния по типу связи/поля | PTH-US-017, PTH-US-035 |
| PTH-FR-028 | ImpactItem содержит путь, reason, rule_id, certainty, depth и рекомендуемое действие | PTH-US-017, PTH-US-023 |
| PTH-FR-029 | После значимого изменения ранее проверенные связи/свидетельства становятся needs_review или stale | PTH-US-018, PTH-US-041 |
| PTH-FR-030 | Разрешение needs_review фиксирует проверенные редакции и пояснение; при новой редакции оно устаревает | PTH-US-019 |
| PTH-FR-031 | Policy определяет применимые права, согласования и автономность по операциям и scope | PTH-US-021, PTH-US-049 |
| PTH-FR-032 | Undo создаёт компенсирующий ChangeSet; конфликт с последующими правками не обходится | PTH-US-022 |
| PTH-FR-033 | Обход графа ограничен budget, предотвращает бесконечные циклы и явно сообщает truncation | PTH-US-017, PTH-US-024, PTH-US-046 |
| PTH-FR-034 | Supersedes ADR и unresolved contradictions отражаются в контексте и влиянии | PTH-US-023, PTH-US-024 |

### 4.5. Контекст ИИ, MCP и скиллы

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-035 | ContextBundle собирается по IDs, задаче, компоненту или code ref и фиксирует revisions | PTH-US-024, PTH-US-029 |
| PTH-FR-036 | Применимые проектные/компонентные ограничения включаются независимо от прямых связей | PTH-US-024 |
| PTH-FR-037 | Bundle сохраняет manifest, policy_version, budget, omissions, источники и validity state | PTH-US-025 |
| PTH-FR-038 | При нехватке бюджета обязательного контекста сервер возвращает явное incomplete и блокирует подтверждение полноты | PTH-US-024, PTH-US-025 |
| PTH-FR-039 | ИИ получает структурированные JSON-ответы, version IDs и deep links без доступа к БД | PTH-US-026, PTH-US-030 |
| PTH-FR-040 | MCP tools используют те же application services и authorization, что REST | PTH-US-026, PTH-US-049 |
| PTH-FR-041 | Поставляется набор скиллов с описанными входами, шагами, результатами и сценариями ошибок | PTH-US-026 |
| PTH-FR-042 | Отчёт об ответе ИИ содержит ссылки на использованные revisions и отделяет unsupported claims | PTH-US-028 |
| PTH-FR-043 | План реализации сохраняется как связанный Artifact; план не считается реализацией | PTH-US-029 |
| PTH-FR-044 | AgentRun фиксирует используемый bundle, skill_version, изменения, findings и коммиты | PTH-US-025, PTH-US-033 |

### 4.6. Git и код

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-045 | API регистрирует repository identity, read-only integration и mutable ref observations | PTH-US-031 |
| PTH-FR-046 | Commit идентифицируется repository_uid + object_format + full_oid; SHA проверяется коннектором | PTH-US-033, PTH-US-037 |
| PTH-FR-047 | CodeReference фиксирует commit, path и optional symbol/range/blob_oid; проверяется существование | PTH-US-032 |
| PTH-FR-048 | API создаёт commit/entity links с roles и evidence_basis; кодовая связь не доказывает выполнение требования | PTH-US-033, PTH-US-034 |
| PTH-FR-049 | Интеграция принимает CI manifest и Git trailers как источники ссылок, валидируя ID и доступ | PTH-US-033, PTH-US-037 |
| PTH-FR-050 | UI/API показывает прямые и транзитивные пути requirement↔commit, разрывы и revision mismatch | PTH-US-034 |
| PTH-FR-051 | Анализ Git diff показывает кандидатов затронутых требований/решений и основания сопоставления | PTH-US-035 |
| PTH-FR-052 | Reachability проверяется относительно baseline/release ref; timestamp и один SHA недостаточны | PTH-US-036 |
| PTH-FR-053 | Squash/rebase/revert/rename не переписывают commit identity; сохраняются mapping/provenance и review flags | PTH-US-038 |
| PTH-FR-054 | Несвязанные коммиты доступны как gap; exemption поддерживается для технических правок | PTH-US-037, PTH-US-042 |

### 4.7. Проверки, ПСИ и baseline

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-055 | Structural validation выполняется сервером с воспроизводимыми rule IDs | PTH-US-039 |
| PTH-FR-056 | Semantic review создаёт findings с цитатами, provenance и confidence, а не безусловные ошибки | PTH-US-023, PTH-US-039 |
| PTH-FR-057 | TestCase содержит метод, предусловия, данные, шаги, ожидаемый результат и metric contract | PTH-US-040 |
| PTH-FR-058 | Проект ПСИ строится из baseline, TestCase и coverage gaps, сохраняется версионированно | PTH-US-040, PTH-US-044 |
| PTH-FR-059 | Неопределённые пороги/условия обозначаются как gaps; ИИ не принимает их молча | PTH-US-007, PTH-US-040 |
| PTH-FR-060 | Evidence хранит result, test revision, baseline, repo commits, environment и attachments hashes | PTH-US-041 |
| PTH-FR-061 | Readiness различает specified, designed, implemented, verified, accepted и waived | PTH-US-042 |
| PTH-FR-062 | Baseline фиксирует полный manifest revisions/relations/policies и Git-heads, затем неизменяема | PTH-US-043 |
| PTH-FR-063 | Экспорт создаёт Markdown/JSON/CSV-матрицу/Markdown-ПСИ с baseline и ссылками; изменения назад только через import | PTH-US-044 |
| PTH-FR-064 | Актуальность Evidence пересчитывается при изменении требования, TestCase, применимых условий или target code | PTH-US-018, PTH-US-041, PTH-US-042 |

### 4.8. UI, API и эксплуатация

| ID | Требование | Основание |
| --- | --- | --- |
| PTH-FR-065 | UI предоставляет реестр, карточку, timeline/diff, граф, impact view и matrix view | PTH-US-009, PTH-US-012, PTH-US-046 |
| PTH-FR-066 | UI редактирует drafts ChangeSet; перед apply показывает diff, validation и analysis status | PTH-US-047 |
| PTH-FR-067 | UI имеет inbox findings/needs_review/gaps с фильтрами и переходами | PTH-US-048 |
| PTH-FR-068 | Source view показывает оригинальную структуру, фрагменты, disposition и сущности | PTH-US-005, PTH-US-052 |
| PTH-FR-069 | API публикует версионированный OpenAPI, error codes и schemas; обязательные операции доступны без UI | PTH-US-026, PTH-US-030, PTH-US-047 |
| PTH-FR-070 | Authentication различает user/service principal; RBAC и project scope проверяются на каждой операции | PTH-US-049 |
| PTH-FR-071 | API управляет ключами, отзывом, capability scopes и журналом использования | PTH-US-021, PTH-US-049 |
| PTH-FR-072 | AuditEvent содержит actor, on_behalf_of, channel, request/run/change IDs, time и changes | PTH-US-012, PTH-US-050 |
| PTH-FR-073 | Job API предоставляет queued/running/succeeded/failed/cancelled, progress и resumable errors | PTH-US-051 |
| PTH-FR-074 | Backup/restore восстанавливает DB, sources, attachments, manifests и audit; есть проверка целостности | PTH-US-050 |
| PTH-FR-075 | Экспорт/удаление/retention проекта выполняются API-командами с правами и сохранением tombstone IDs | PTH-US-014, PTH-US-050 |
| PTH-FR-076 | Уведомления об изменениях доступны через SSE/polling; webhook delivery идемпотентна и повторяемая | PTH-US-018, PTH-US-037, PTH-US-051 |
| PTH-FR-077 | Шаблоны типов, отчётов и ПСИ версионируются и применяются явно | PTH-US-053 |
| PTH-FR-078 | Межпроектные ссылки проверяют права обеих сторон и не раскрывают закрытые данные | PTH-US-054 |
| PTH-FR-079 | Для каждого FR, NFR и AC вычисляется наличие связи implements от COMMIT и обоснованного исключения; для каждой US — наличие refines от ФТ или motivates к ADR. Статусы вычисляются, не вводятся вручную | PTH-US-055 |
| PTH-FR-080 | Список потерянных собирает FR, NFR и AC без implements и обоснованного исключения; US без refines от ФТ и без motivates к ADR; фрагменты принятого источника, не сопоставленные с сущностями | PTH-US-055, PTH-US-005 |
| PTH-FR-081 | Запись потерянного содержит причину (нет связей, US без ФТ или ADR, связь на удалённый или переименованный код, commit без проверки), последний известный commit и рекомендуемое действие; список фильтруется по приоритету, релизу, владельцу и baseline | PTH-US-055, PTH-US-042 |
| PTH-FR-082 | Graph API возвращает подграф по центру, глубине и фильтрам типа и направления; узлы несут краткие атрибуты для панели деталей; полный граф не выгружается целиком | PTH-US-046, PTH-US-056 |
| PTH-FR-083 | Панель деталей подгружает по ID текущую ревизию, статус, связи, код и проверки, историю; подгрузка не сбрасывает положение и фокус графа | PTH-US-012, PTH-US-056 |
| PTH-FR-084 | Граф подсвечивает потерянные требования и маркеры влияния из §12.3 текстом или иконкой; фильтр «только потерянные» показывает их и непосредственных соседей | PTH-US-055, PTH-US-056 |

PTH-FR-007 и PTH-FR-077 — P1; PTH-FR-078 — P2. Остальные требования — P0. В P0 схемы предопределены, но их версия хранится и читается API; произвольное редактирование схем появляется в P1.
