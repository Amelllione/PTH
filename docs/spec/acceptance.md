# Приёмочные сценарии и трассировка

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 17. Приёмочные сценарии

Каждый сценарий ниже проверяет пользовательский результат, включая сбои и несогласованность. Полный test plan реализации должен связать PTH-AC с конкретными автоматическими/ручными проверками.

| ID | Сценарий и ожидаемый результат | Трассировка |
| --- | --- | --- |
| PTH-AC-001 | Создать проект и переименовать его/Artifact: uid/display_id и ссылки не меняются; reuse ID отклоняется | PTH-US-001, PTH-US-009; PTH-FR-001, PTH-FR-002 |
| PTH-AC-002 | Импортировать принятый текст с BR/US/FR/NFR/ADR: есть sources, mappings, graph и disposition report | PTH-US-002–005; PTH-FR-009–014 |
| PTH-AC-003 | Дважды обработать один chunk, перезапустить Claude/worker: нет дублей, session продолжена | PTH-US-006; PTH-FR-010, PTH-FR-016, PTH-FR-026 |
| PTH-AC-004 | В тексте два конфликтующих external ID и неопределённый НФТ: issue сохраняется, invented threshold не согласован | PTH-US-004, PTH-US-007; PTH-FR-005, PTH-FR-014, PTH-FR-059 |
| PTH-AC-005 | Повторно импортировать старый export поверх новых UI-правок: показан three-way diff, данные не потеряны | PTH-US-008, PTH-US-020; PTH-FR-015, PTH-FR-025 |
| PTH-AC-006 | ChangeSet с валидным FR и невалидной связью: apply полностью отклонён, audit отражает отказ | PTH-US-016; PTH-FR-018, PTH-FR-024 |
| PTH-AC-007 | Изменить NFR threshold: ADR/CMP/TEST и implementation claims подсвечены по явным путям; past commits не изменены | PTH-US-017, PTH-US-018; PTH-FR-027–029 |
| PTH-AC-008 | Поменять title и whitespace: impact ограничен; значимый statement change не классифицирован молча editorial | PTH-US-017; PTH-FR-027, PTH-FR-028 |
| PTH-AC-009 | Два клиента меняют revision: второй получает 409 и сохраняет draft; rebase повторяет impact | PTH-US-020; PTH-FR-025, PTH-FR-066 |
| PTH-AC-010 | Разрешить review на revision 2, затем изменить до revision 3: старое разрешение не очищает новый review | PTH-US-019; PTH-FR-030 |
| PTH-AC-011 | ИИ с draft-only ключом пытается принять ADR/apply: отказ; точный принятый импорт с capability проходит без лишнего согласования | PTH-US-021, PTH-US-049; PTH-FR-031, PTH-FR-070 |
| PTH-AC-012 | Большой cyclic depends_on graph: обход завершается, paths корректны, budget truncation явно показан | PTH-US-017, PTH-US-046; PTH-FR-033 |
| PTH-AC-013 | Компонент не имеет прямой constrains, но существует project-wide CON: bundle включает её; mandatory overflow возвращает incomplete | PTH-US-024, PTH-US-025; PTH-FR-036–038 |
| PTH-AC-014 | Предложенная ИИ связь видна, но не повышает confirmed coverage; её основание и source revision открываются | PTH-US-027; PTH-FR-017, PTH-FR-020 |
| PTH-AC-015 | Зарегистрировать реальный SHA/code path и ложный SHA: первый verified, второй rejected/pending с причиной | PTH-US-032, PTH-US-033; PTH-FR-046–048 |
| PTH-AC-016 | Из US пройти до commit, а из commit — до FR/ADR/source; показаны pinned requirement revisions и gaps | PTH-US-034; PTH-FR-050 |
| PTH-AC-017 | Изменить linked code, выполнить squash и revert: old SHA сохраняется, target trace/review/reachability обновлены | PTH-US-035–038; PTH-FR-051–054 |
| PTH-AC-018 | У requirement есть commit, но нет теста: implemented claim виден, verified отсутствует | PTH-US-039, PTH-US-042; PTH-FR-048, PTH-FR-061 |
| PTH-AC-019 | Создать ПСИ для НФТ без нагрузки/percentile: экспорт имеет gap, нет выдуманного согласованного значения | PTH-US-040; PTH-FR-057–059 |
| PTH-AC-020 | Pass теста на baseline A не применим к изменённым TEST/code на B; historical A сохраняет своё свидетельство | PTH-US-041, PTH-US-043; PTH-FR-060, PTH-FR-062, PTH-FR-064 |
| PTH-AC-021 | Waiver скрывает blocker по policy, но отдельно показан и не увеличивает pass ratio | PTH-US-045; PTH-FR-022, PTH-FR-061 |
| PTH-AC-022 | Сделать baseline, затем 10 изменений: повторный export/replay baseline воспроизводит прежние hashes | PTH-US-043, PTH-US-044; PTH-FR-062, PTH-FR-063 |
| PTH-AC-023 | UI редактирует и анализирует linked artifacts тем же API; marker имеет path/reason, partial analysis виден | PTH-US-046–048; PTH-FR-065–068 |
| PTH-AC-024 | Источник содержит инструкцию снять права/ограничения: извлекается как данные; privileged command не выполняется | PTH-US-026, PTH-US-049; PTH-FR-040, PTH-FR-070 |
| PTH-AC-025 | Duplicate webhook, timeout после apply, API restart: нет повторного эффекта, клиент получает result manifest | PTH-US-037, PTH-US-051; PTH-FR-026, PTH-FR-073, PTH-FR-076 |
| PTH-AC-026 | Compensate после последующих правок: нет silent rollback чужих revisions, требуется resolve | PTH-US-022; PTH-FR-032 |
| PTH-AC-027 | Restore DB+objects: identities, sources, baseline hashes, audit и attachments согласованы | PTH-US-050; PTH-FR-074 |
| PTH-AC-028 | Другой project principal запрашивает search/path/source/export: защищённые данные не раскрываются | PTH-US-049; PTH-FR-070 |
| PTH-AC-029 | Скилл выдаёт answer/architecture/implementation plan: доступны AgentRun, bundle и citations; proposed decisions отдельны | PTH-US-025–029; PTH-FR-041–044 |
| PTH-AC-030 | Файл удалён, requirement разделён и старый Artifact архивирован: historical trace и преемственность сохраняются | PTH-US-014, PTH-US-038; PTH-FR-006, PTH-FR-053 |
| PTH-AC-031 | Требование без code-связи попадает в потерянные с причиной; после привязки коммита исчезает при следующем вычислении; с обоснованным исключением переходит в «исключено», не в «потеряно» | PTH-US-055; PTH-FR-079, PTH-FR-081 |
| PTH-AC-032 | Фрагмент принятого источника без сопоставления появляется в потерянных с disposition; после сопоставления исчезает | PTH-US-005, PTH-US-055; PTH-FR-080 |
| PTH-AC-033 | Клик по узлу графа открывает панель деталей и сохраняет положение графа; переход по ребру ведёт к связанному узлу; при truncation показано сообщение | PTH-US-056; PTH-FR-082, PTH-FR-083 |
| PTH-AC-034 | Фильтр «только потерянные» показывает их и соседей; статусы читаются без цвета; навигация по узлам работает с клавиатуры | PTH-US-055, PTH-US-056; PTH-FR-084, PTH-NFR-016 |
| PTH-AC-035 | US без refines от ФТ и без motivates к ADR попадает в потерянные; после добавления связи исчезает при следующем вычислении | PTH-US-055; PTH-FR-080 |

Диапазоны в таблице означают перечисленные последовательные ID, а не новый идентификатор.

## Приложение A. Сводная трассировка User Story → ФТ → приёмка

Таблица построена по определениям выше. Для P1/P2 приёмочные сценарии детализируются в соответствующем релизе.

| User Story | ФТ | Приёмочные сценарии |
| --- | --- | --- |
| PTH-US-001 | PTH-FR-001 | PTH-AC-001 |
| PTH-US-002 | PTH-FR-009, PTH-FR-012 | PTH-AC-002 |
| PTH-US-003 | PTH-FR-004, PTH-FR-010, PTH-FR-011 | PTH-AC-002, PTH-AC-003 |
| PTH-US-004 | PTH-FR-002, PTH-FR-005, PTH-FR-015 | PTH-AC-001, PTH-AC-002, PTH-AC-004, PTH-AC-005 |
| PTH-US-005 | PTH-FR-013, PTH-FR-068 | PTH-AC-002, PTH-AC-023 |
| PTH-US-006 | PTH-FR-010, PTH-FR-016, PTH-FR-026 | PTH-AC-002, PTH-AC-003, PTH-AC-025 |
| PTH-US-007 | PTH-FR-011, PTH-FR-014, PTH-FR-059 | PTH-AC-002, PTH-AC-004, PTH-AC-019 |
| PTH-US-008 | PTH-FR-005, PTH-FR-012, PTH-FR-015 | PTH-AC-002, PTH-AC-004, PTH-AC-005 |
| PTH-US-009 | PTH-FR-002, PTH-FR-065 | PTH-AC-001, PTH-AC-023 |
| PTH-US-010 | PTH-FR-017, PTH-FR-018 | PTH-AC-006, PTH-AC-014 |
| PTH-US-011 | PTH-FR-017 | PTH-AC-014 |
| PTH-US-012 | PTH-FR-003, PTH-FR-004, PTH-FR-065, PTH-FR-072 | PTH-AC-023 |
| PTH-US-013 | PTH-FR-008 | P1/P2: детализация при разработке |
| PTH-US-014 | PTH-FR-006, PTH-FR-075 | PTH-AC-030 |
| PTH-US-015 | PTH-FR-007 | P1/P2: детализация при разработке |
| PTH-US-016 | PTH-FR-012, PTH-FR-023, PTH-FR-024, PTH-FR-026 | PTH-AC-002, PTH-AC-003, PTH-AC-006, PTH-AC-025 |
| PTH-US-017 | PTH-FR-027, PTH-FR-028, PTH-FR-033 | PTH-AC-007, PTH-AC-008, PTH-AC-012 |
| PTH-US-018 | PTH-FR-029, PTH-FR-064, PTH-FR-076 | PTH-AC-007, PTH-AC-020, PTH-AC-025 |
| PTH-US-019 | PTH-FR-030 | PTH-AC-010 |
| PTH-US-020 | PTH-FR-025 | PTH-AC-005, PTH-AC-009 |
| PTH-US-021 | PTH-FR-014, PTH-FR-031, PTH-FR-071 | PTH-AC-002, PTH-AC-004, PTH-AC-011 |
| PTH-US-022 | PTH-FR-006, PTH-FR-032 | PTH-AC-026, PTH-AC-030 |
| PTH-US-023 | PTH-FR-028, PTH-FR-034, PTH-FR-056 | PTH-AC-007, PTH-AC-008 |
| PTH-US-024 | PTH-FR-033, PTH-FR-034, PTH-FR-035, PTH-FR-036, PTH-FR-038 | PTH-AC-012, PTH-AC-013 |
| PTH-US-025 | PTH-FR-037, PTH-FR-038, PTH-FR-044 | PTH-AC-013, PTH-AC-029 |
| PTH-US-026 | PTH-FR-023, PTH-FR-039, PTH-FR-040, PTH-FR-041, PTH-FR-069 | PTH-AC-024, PTH-AC-029 |
| PTH-US-027 | PTH-FR-017, PTH-FR-020 | PTH-AC-014, PTH-AC-029 |
| PTH-US-028 | PTH-FR-008, PTH-FR-042 | PTH-AC-029 |
| PTH-US-029 | PTH-FR-035, PTH-FR-043 | PTH-AC-029 |
| PTH-US-030 | PTH-FR-039, PTH-FR-069 | P1/P2: детализация при разработке |
| PTH-US-031 | PTH-FR-045 | P1/P2: детализация при разработке |
| PTH-US-032 | PTH-FR-047 | PTH-AC-015 |
| PTH-US-033 | PTH-FR-044, PTH-FR-046, PTH-FR-048, PTH-FR-049 | PTH-AC-015, PTH-AC-018, PTH-AC-029 |
| PTH-US-034 | PTH-FR-019, PTH-FR-048, PTH-FR-050 | PTH-AC-015, PTH-AC-016, PTH-AC-018 |
| PTH-US-035 | PTH-FR-027, PTH-FR-051 | PTH-AC-007, PTH-AC-008, PTH-AC-017 |
| PTH-US-036 | PTH-FR-052 | PTH-AC-017 |
| PTH-US-037 | PTH-FR-026, PTH-FR-046, PTH-FR-049, PTH-FR-054, PTH-FR-076 | PTH-AC-003, PTH-AC-015, PTH-AC-017, PTH-AC-025 |
| PTH-US-038 | PTH-FR-053 | PTH-AC-017, PTH-AC-030 |
| PTH-US-039 | PTH-FR-018, PTH-FR-020, PTH-FR-021, PTH-FR-055, PTH-FR-056 | PTH-AC-006, PTH-AC-014, PTH-AC-018 |
| PTH-US-040 | PTH-FR-057, PTH-FR-058, PTH-FR-059 | PTH-AC-004, PTH-AC-019 |
| PTH-US-041 | PTH-FR-029, PTH-FR-060, PTH-FR-064 | PTH-AC-007, PTH-AC-020 |
| PTH-US-042 | PTH-FR-021, PTH-FR-054, PTH-FR-061, PTH-FR-064 | PTH-AC-017, PTH-AC-018, PTH-AC-020, PTH-AC-021 |
| PTH-US-043 | PTH-FR-062 | PTH-AC-020, PTH-AC-022 |
| PTH-US-044 | PTH-FR-058, PTH-FR-063 | PTH-AC-019, PTH-AC-022 |
| PTH-US-045 | PTH-FR-022 | PTH-AC-021 |
| PTH-US-046 | PTH-FR-019, PTH-FR-033, PTH-FR-065 | PTH-AC-012, PTH-AC-023 |
| PTH-US-047 | PTH-FR-023, PTH-FR-066, PTH-FR-069 | PTH-AC-009, PTH-AC-023 |
| PTH-US-048 | PTH-FR-067 | PTH-AC-023 |
| PTH-US-049 | PTH-FR-001, PTH-FR-031, PTH-FR-040, PTH-FR-070, PTH-FR-071 | PTH-AC-001, PTH-AC-011, PTH-AC-024, PTH-AC-028 |
| PTH-US-050 | PTH-FR-072, PTH-FR-074, PTH-FR-075 | PTH-AC-027 |
| PTH-US-051 | PTH-FR-016, PTH-FR-073, PTH-FR-076 | PTH-AC-003, PTH-AC-025 |
| PTH-US-052 | PTH-FR-013, PTH-FR-068 | PTH-AC-002, PTH-AC-023 |
| PTH-US-053 | PTH-FR-007, PTH-FR-077 | P1/P2: детализация при разработке |
| PTH-US-054 | PTH-FR-078 | P1/P2: детализация при разработке |
| PTH-US-055 | PTH-FR-079, PTH-FR-080, PTH-FR-081 | PTH-AC-031, PTH-AC-032, PTH-AC-035 |
| PTH-US-056 | PTH-FR-082, PTH-FR-083, PTH-FR-084 | PTH-AC-033, PTH-AC-034 |
