# Паспорта скиллов SK-01…SK-13

> Сгенерировано из раздела 11.2 `Project_Traceability_System_Spec_v0.1.md`. Не редактировать вручную: `python3 scripts/sync_spec.py`.

Скиллы — часть разработки; исполняемых `SKILL.md` пока нет (статус planned). Целевой формат: `.claude/skills/<name>/SKILL.md`. Этапы — в [skills-map](../../skills-map.md).

| ID | Имя | Паспорт |
| --- | --- | --- |
| SK-01 | pth-import-spec | [SK-01-pth-import-spec.md](SK-01-pth-import-spec.md) |
| SK-02 | pth-project-context | [SK-02-pth-project-context.md](SK-02-pth-project-context.md) |
| SK-03 | pth-change | [SK-03-pth-change.md](SK-03-pth-change.md) |
| SK-04 | pth-impact | [SK-04-pth-impact.md](SK-04-pth-impact.md) |
| SK-05 | pth-requirements-review | [SK-05-pth-requirements-review.md](SK-05-pth-requirements-review.md) |
| SK-06 | pth-architecture | [SK-06-pth-architecture.md](SK-06-pth-architecture.md) |
| SK-07 | pth-plan-implementation | [SK-07-pth-plan-implementation.md](SK-07-pth-plan-implementation.md) |
| SK-08 | pth-implement-traced | [SK-08-pth-implement-traced.md](SK-08-pth-implement-traced.md) |
| SK-09 | pth-register-code | [SK-09-pth-register-code.md](SK-09-pth-register-code.md) |
| SK-10 | pth-build-psi | [SK-10-pth-build-psi.md](SK-10-pth-build-psi.md) |
| SK-11 | pth-verify-compliance | [SK-11-pth-verify-compliance.md](SK-11-pth-verify-compliance.md) |
| SK-12 | pth-project-answer | [SK-12-pth-project-answer.md](SK-12-pth-project-answer.md) |
| SK-13 | pth-release-baseline | [SK-13-pth-release-baseline.md](SK-13-pth-release-baseline.md) |

## Общие правила

Каждый скилл обязан: определить проект; прочитать capabilities; использовать server IDs; создать AgentRun; записать bundle/source provenance; соблюдать idempotency; завершить run с outcome; не выдавать partial success за complete.
