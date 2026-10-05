# Качество требований, свидетельства и ПСИ

> Извлечено из `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

## 14. Качество требований, свидетельства и ПСИ

### 14.1. Детерминированные правила P0

| Rule ID | Проверка | Результат |
| --- | --- | --- |
| VAL-ID-01 | Canonical IDs уникальны и неизменяемы | Block write |
| VAL-REF-01 | Endpoints/aliases/revision refs существуют и доступны | Block write |
| VAL-SCHEMA-01 | Поля/типы/transitions соответствуют pinned schema | Block write |
| VAL-GRAPH-01 | Нет запрещённых циклов refines/supersedes | Block write |
| VAL-SOURCE-01 | Quote соответствует immutable source и locator | Block bind / finding по legacy |
| VAL-IMPORT-01 | Все scope fragments имеют disposition | Block complete import, не сохранение draft |
| VAL-FR-01 | У agreed FR есть проверяемый criterion либо scoped waiver | Block agreement / finding |
| VAL-NFR-01 | У agreed NFR есть metric, threshold, units и conditions либо explicit unresolved | Finding/block по policy |
| VAL-ADR-01 | accepted ADR содержит context/decision/consequences и требования-основания | Finding/block по policy |
| VAL-TEST-01 | TEST покрывает criterion/revision и имеет expected outcome | Finding/block readiness |
| VAL-CODE-01 | Code ref существует на pinned commit | Block verified link |
| VAL-EVID-01 | Evidence точно соответствует TEST revision и baseline code | Block verified coverage |
| VAL-FRESH-01 | Confirmation не относится к устаревшим основаниям | needs_review |
| VAL-TRACE-01 | Обязательная цепь покрытия не разорвана | Gap, а не утверждение ошибки кода |
| VAL-CTX-01 | Mandatory context inclusion и bundle freshness | Block completeness claim |

Детерминированная проверка заполненности criterion не доказывает его качество. «Работает хорошо» может пройти JSON schema, но semantic review должен создать Finding о непроверяемости.

### 14.2. Семантические проверки

Скилл pth-requirements-review проверяет: несогласованную терминологию; скрытые requirements в ADR; противоречия БТ/ТЗ; взаимно несовместимые ограничения; неполную декомпозицию; безусловные утверждения при отсутствии данных; несоответствие реализации заявленной архитектуре.

Finding содержит subject revisions, source quotes, proposed contradiction, explanation, reviewer/model provenance и confidence. ИИ не переводит его в confirmed violation без предусмотренного review. Для точного структурного противоречия в формальных полях допустим deterministic rule.

### 14.3. Coverage

Единица покрытия — obligation, например (requirement_revision, criterion_key, scope, obligation_type). Типы: source, decomposition, design, implementation, verification_method, executed_verification, acceptance.

Обязательность зависит от requirement type и baseline scope. В denominator входят применимые обязательства; unknown applicability отображается отдельно и не исчезает из отчёта.

Coverage ratio = fulfilled applicable obligations / all applicable required obligations. Waived obligations выводятся отдельным числом; не повышают success ratio. Отчёт содержит scope, denominator, unresolved applicability и policy_version.

Различаются:

- design coverage: подтверждённые актуальные ADR/CMP/INT связи;
- code trace coverage: проверенные code/commit links, ещё без доказательства поведения;
- verification design coverage: TEST покрывает criterion;
- execution coverage: применимый результат выполненного TEST;
- acceptance coverage: уполномоченный акт принятия конкретной baseline.

Связь TEST→FR без покрытия всех обязательных критериев не даёт 100%. Failed test считается executed, но не passed. Blocked/inconclusive отдельны.

### 14.4. Evidence validity

Evidence применимо, если совпадают TEST revision, проверяемые requirement/criterion revisions, target code commits, среда/нагрузка и scope. Допустимость повторного использования Evidence для нового commit задаётся explicit equivalence review с причиной; timestamp не достаточен.

Результат после изменения current requirements остаётся валидным историческим свидетельством старой baseline, но не текущего состояния. Историческую baseline нельзя переписывать, массово превращая её старые pass в fail.

Evidence input идёт от authenticated issuer. Уровни доверия: human_recorded, agent_claimed, trusted_ci, independently_reviewed. Порог достаточности задаёт readiness policy.

### 14.5. Состав проекта ПСИ

Генератор создаёт PSI Artifact и Markdown export со следующими разделами:

1. Цель, объект и scope испытаний.
2. Основания: baseline, требования, решения и версии.
3. Комплектность системы, среды и тестовых данных.
4. Условия запуска, зависимости и порядок выполнения.
5. Матрица требование/критерий → метод → TestCase.
6. Методики: предусловия, вход, шаги, ожидаемое поведение, измерения.
7. Критерии успеха, остановки и повторения.
8. Форма фиксации результатов, attachments и ответственные.
9. Непокрытые требования, неопределённые параметры и исключения.
10. Правила принятия результатов.

Генератор сначала переиспользует согласованные TEST; затем предлагает новые draft tests для gaps. Он не создает «успешные результаты» и не скрывает неполноту.

Первый релиз экспортирует Markdown/JSON и CSV matrix. DOCX ПСИ и корпоративные шаблоны — P1. Содержание ПСИ в реестре не зависит от наличия DOCX export.

### 14.6. Readiness

Отчёт содержит по scope: agreed requirements, unresolved decisions, stale relations, verified code reachability, applicable executed/pass/fail tests, waivers и unknowns. Итог: ready, not_ready, insufficient_data; основание видно.

Каждый readiness calculation фиксирует baseline_uid, assessment_uid, policies и evidence set. Для неизменяемой baseline новые test runs создают новый assessment, а не модифицируют baseline manifest.
