"""HTTP-слой: маршруты /v1, обработка доменных ошибок и фабрика приложения."""
import os
from collections.abc import Iterator

from fastapi import APIRouter, Depends, FastAPI, Query, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pth import auth, domain, importer, jobs, llm
from pth.db import Base, make_engine, make_session_factory
from pth.models import (
    Artifact, ArtifactRevision, ChangeSet, ExtractionJob, ImportSession, Project, Relation, new_uid, utcnow,
)
from pth.schemas import (
    ArtifactIn, ArtifactOut, ChangeSetIn, ChangeSetOut, CommitIn, Direction, GraphOut, ImportDetail,
    ImportIn, ImportReport, LostOut, ProjectIn, ProjectOut, RelationIn, RelationOut, RevisionIn,
    RevisionOut, ExtractIn, ExtractOut, Proposal, ProposalsToChangeSetIn,
    ExtractionJobIn, ExtractionJobOut,
)

DEFAULT_DB = "sqlite:///./pth.db"
GRAPH_LIMIT_MAX = 200

def get_session(request: Request) -> Iterator[Session]:
    session = request.app.state.session_factory()
    try:
        yield session
    finally:
        session.close()


def guard(request: Request, session: Session = Depends(get_session)) -> None:
    """Общая проверка для всех /v1: чтение требует reader, запись — writer, без ключа проекта — admin."""
    principal = auth.authenticate(session, request.headers.get("authorization"))
    request.state.actor = principal.name
    request.state.principal_kind = principal.kind
    if request.url.path == "/v1/me":
        return  # любой действующий ключ может узнать свои права
    key = request.path_params.get("key")
    need = "reader" if request.method == "GET" else "writer"
    auth.authorize(principal, key, need)


router = APIRouter(prefix="/v1", tags=["PTH"], dependencies=[Depends(guard)])


def _page(response: Response, items: list, offset: int, limit: int) -> list:
    """Страница списка; общее число — в заголовке X-Total-Count (тело остаётся списком)."""
    response.headers["X-Total-Count"] = str(len(items))
    return items[offset:offset + limit]


def _artifact_out(session: Session, artifact: Artifact) -> ArtifactOut:
    rev = domain.latest_revision(session, artifact)
    return ArtifactOut(
        display_id=artifact.display_id, type=artifact.type, external_key=artifact.external_key,
        revision=rev.number, title=rev.title, text=rev.text, attributes=rev.attributes,
        exemption_reason=rev.exemption_reason, created_at=artifact.created_at,
    )


def _relation_out(session: Session, relation: Relation) -> RelationOut:
    return RelationOut(
        uid=relation.uid, type=relation.type, status=relation.status,
        source=session.get(Artifact, relation.source_uid).display_id,
        target=session.get(Artifact, relation.target_uid).display_id,
    )


# --- проекты -------------------------------------------------------------------

@router.post("/projects", status_code=201, response_model=ProjectOut, summary="Создать проект (только admin)")
def create_project(body: ProjectIn, session: Session = Depends(get_session)):
    project = domain.create_project(session, body.key, body.name)
    session.commit()
    return ProjectOut(key=project.key, name=project.name, created_at=project.created_at)


@router.get("/projects", response_model=list[ProjectOut], summary="Список проектов (только admin)")
def list_projects(session: Session = Depends(get_session)):
    return [ProjectOut(key=p.key, name=p.name, created_at=p.created_at)
            for p in session.scalars(select(Project).order_by(Project.key))]


@router.get("/projects/{key}", response_model=ProjectOut, summary="Проект по ключу")
def get_project(key: str, session: Session = Depends(get_session)):
    p = domain.get_project(session, key)
    return ProjectOut(key=p.key, name=p.name, created_at=p.created_at)


# --- артефакты и ревизии -------------------------------------------------------

@router.post("/projects/{key}/artifacts", status_code=201, response_model=ArtifactOut,
             summary="Создать артефакт (первая ревизия)")
def create_artifact(key: str, body: ArtifactIn, request: Request, session: Session = Depends(get_session)):
    artifact = domain.create_artifact(session, key, body.type, body.title, body.text,
                                      body.attributes, body.exemption_reason)
    domain.audit(session, key, request.state.actor, "artifact.create", artifact.display_id, {"type": body.type})
    session.commit()
    return _artifact_out(session, artifact)


@router.get("/projects/{key}/artifacts", response_model=list[ArtifactOut],
            summary="Список артефактов проекта (страницами; общее число — в X-Total-Count)")
def list_artifacts(response: Response, key: str, type: str | None = Query(default=None),
                   offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=500),
                   session: Session = Depends(get_session)):
    domain.get_project(session, key)
    rows, total = domain.artifacts_page(session, key, type, offset, limit)
    response.headers["X-Total-Count"] = str(total)
    return [_artifact_out(session, a) for a in rows]


@router.get("/projects/{key}/artifacts/{display_id}", response_model=ArtifactOut,
            summary="Артефакт с текущей ревизией")
def get_artifact(key: str, display_id: str, session: Session = Depends(get_session)):
    return _artifact_out(session, domain.get_artifact(session, key, display_id))


@router.post("/projects/{key}/artifacts/{display_id}/revisions", status_code=201,
             response_model=ArtifactOut, summary="Новая ревизия (старые не меняются)")
def add_revision(key: str, display_id: str, body: RevisionIn, request: Request, session: Session = Depends(get_session)):
    artifact, rev = domain.add_revision(session, key, display_id, body.title, body.text,
                                        body.attributes, body.exemption_reason, body.expected_revision)
    domain.audit(session, key, request.state.actor, "artifact.revise", display_id, {"revision": rev.number})
    session.commit()
    return _artifact_out(session, artifact)


@router.get("/projects/{key}/artifacts/{display_id}/revisions", response_model=list[RevisionOut],
            summary="История ревизий")
def list_revisions(key: str, display_id: str, session: Session = Depends(get_session)):
    artifact = domain.get_artifact(session, key, display_id)
    revs = session.scalars(select(ArtifactRevision).where(
        ArtifactRevision.artifact_uid == artifact.uid).order_by(ArtifactRevision.number))
    return [RevisionOut(number=r.number, title=r.title, text=r.text, attributes=r.attributes,
                        exemption_reason=r.exemption_reason, created_at=r.created_at) for r in revs]


# --- связи и коммиты -----------------------------------------------------------

@router.post("/projects/{key}/relations", status_code=201, response_model=RelationOut,
             summary="Создать связь по каталогу §6.1")
def create_relation(key: str, body: RelationIn, request: Request, session: Session = Depends(get_session)):
    relation = domain.create_relation(session, key, body.type, body.source, body.target)
    domain.audit(session, key, request.state.actor, "relation.create", f"{body.source}->{body.target}", {"type": body.type})
    session.commit()
    return _relation_out(session, relation)


@router.get("/projects/{key}/relations", response_model=list[RelationOut], summary="Связи проекта")
def list_relations(key: str, session: Session = Depends(get_session)):
    domain.get_project(session, key)
    rels = session.scalars(select(Relation).where(Relation.project_key == key)
                           .order_by(Relation.created_at))
    return [_relation_out(session, r) for r in rels]


@router.post("/projects/{key}/commits", status_code=201, response_model=ArtifactOut,
             summary="Зарегистрировать коммит и связать его с требованиями (implements)")
def create_commit(key: str, body: CommitIn, request: Request, session: Session = Depends(get_session)):
    commit = domain.create_commit(session, key, body.sha, body.title, body.implements)
    domain.audit(session, key, request.state.actor, "commit.register", body.sha, {"implements": body.implements})
    session.commit()
    return _artifact_out(session, commit)


# --- импорт принятой спецификации ----------------------------------------------

@router.post("/projects/{key}/imports", status_code=201, response_model=ImportReport,
             summary="Импорт принятой спецификации (идемпотентен по ID и тексту)")
def import_spec(
    key: str,
    body: ImportIn,
    request: Request,
    dry_run: bool = Query(default=False, description="Только предпросмотр: данные не меняются"),
    as_changeset: bool = Query(default=False, description="Сохранить план черновиком ChangeSet, данные не менять"),
    session: Session = Depends(get_session),
):
    if dry_run and as_changeset:
        raise domain.DomainError(422, "INVALID_MODE", "dry_run и as_changeset взаимоисключающи")
    try:
        report = importer.apply_import(session, key, body.source_name, body.text, dry_run, as_changeset)
        if not dry_run:
            domain.audit(session, key, request.state.actor, "import.apply" if not as_changeset else "import.changeset",
                         body.source_name, {"created": report["created"], "revised": report["revised"]})
            session.commit()
    except domain.DomainError:
        session.rollback()
        raise
    return ImportReport(**report)


@router.get("/projects/{key}/imports", response_model=list[ImportReport], summary="Журнал импортов")
def list_imports(key: str, response: Response, offset: int = Query(default=0, ge=0),
                 limit: int = Query(default=20, ge=1, le=500), session: Session = Depends(get_session)):
    domain.get_project(session, key)
    records = session.scalars(select(ImportSession).where(ImportSession.project_key == key)
                              .order_by(ImportSession.created_at))
    return _page(response, [ImportReport(**importer.report_of(r)) for r in records], offset, limit)


# --- выделение требований моделью (LM Studio) ----------------------------------

def _llm(request: Request) -> llm.LLMClient:
    state = request.app.state
    return llm.LLMClient(state.llm_base, state.llm_key, transport=state.llm_transport)


@router.get("/llm/models", response_model=list[str],
            summary="Модели LM Studio (только admin: проекта здесь нет)")
def llm_models(request: Request):
    return _llm(request).models()


@router.post("/projects/{key}/extractions", response_model=ExtractOut,
             summary="Выделить требования из текста моделью. Ничего не записывает.")
def extract(key: str, body: ExtractIn, request: Request, session: Session = Depends(get_session)):
    domain.get_project(session, key)
    raw = _llm(request).extract(body.model, body.text)
    proposals = llm.validate(raw, body.text, body.model)
    return ExtractOut(model=body.model, proposals=[Proposal(**p) for p in proposals],
                      skipped=len(raw) - len(proposals))


def _job_out(job: ExtractionJob) -> ExtractionJobOut:
    return ExtractionJobOut(
        uid=job.uid, state=job.state, model=job.model, source_name=job.source_name,
        chunks_total=job.chunks_total, chunks_done=job.chunks_done,
        proposals=[Proposal(**p) for p in job.proposals], skipped=job.skipped, errors=job.errors,
        created_at=job.created_at, finished_at=job.finished_at,
    )


@router.post("/projects/{key}/extractions/jobs", status_code=202, response_model=ExtractionJobOut,
             summary="Выделить требования по всему документу в фоне (по фрагментам)")
def start_extraction_job(key: str, body: ExtractionJobIn, request: Request, session: Session = Depends(get_session)):
    domain.get_project(session, key)
    job = ExtractionJob(uid=new_uid(), project_key=key, model=body.model, source_name=body.source_name,
                        state="queued", created_at=utcnow())
    session.add(job)
    session.commit()
    state = request.app.state  # фоновая задача не держит объект запроса
    make_client = lambda: llm.LLMClient(state.llm_base, state.llm_key, transport=state.llm_transport)  # noqa: E731
    jobs.start(state.session_factory, make_client, job.uid, body.text)
    return _job_out(job)


@router.get("/projects/{key}/extractions/jobs/{uid}", response_model=ExtractionJobOut,
            summary="Прогресс и результат фонового выделения")
def get_extraction_job(key: str, uid: str, session: Session = Depends(get_session)):
    job = session.scalar(select(ExtractionJob).where(ExtractionJob.project_key == key, ExtractionJob.uid == uid))
    if job is None:
        raise domain.DomainError(404, "JOB_NOT_FOUND", f"Задача {uid} не найдена")
    session.refresh(job)
    return _job_out(job)


@router.post("/projects/{key}/extractions/changesets", status_code=201, response_model=ChangeSetOut,
             summary="Предложения модели → черновик ChangeSet (применяется отдельно)")
def proposals_to_changeset(key: str, body: ProposalsToChangeSetIn, session: Session = Depends(get_session)):
    domain.get_project(session, key)
    operations = []
    next_number: dict[str, int] = {}
    for p in body.proposals:
        if p.type not in next_number:
            current = session.scalar(select(Artifact.number).where(
                Artifact.project_key == key, Artifact.type == p.type)
                .order_by(Artifact.number.desc()).limit(1))
            next_number[p.type] = (current or 0) + 1
        number = next_number[p.type]
        next_number[p.type] += 1
        operations.append({
            "op": "create_artifact", "display_id": f"{key}-{p.type}-{number:03d}", "type": p.type,
            "number": number, "title": p.title, "text": p.text,
            "attributes": {"provenance": {"source": "llm", "model": p.model, "quote": p.quote,
                                          "quote_verified": p.quote_verified}},
        })
    cs = ChangeSet(uid=new_uid(), project_key=key, title=body.title, state="draft",
                   operations=operations, created_at=utcnow())
    session.add(cs)
    session.commit()
    return _changeset_out(cs)


# --- черновики изменений (ChangeSet) --------------------------------------------

def _changeset_out(cs: ChangeSet) -> ChangeSetOut:
    return ChangeSetOut(uid=cs.uid, title=cs.title, state=cs.state, operations=cs.operations,
                        operation_count=len(cs.operations), last_error=cs.last_error,
                        created_at=cs.created_at, applied_at=cs.applied_at)


def _get_changeset(session: Session, key: str, uid: str) -> ChangeSet:
    cs = session.scalar(select(ChangeSet).where(ChangeSet.project_key == key, ChangeSet.uid == uid))
    if cs is None:
        raise domain.DomainError(404, "CHANGESET_NOT_FOUND", f"ChangeSet {uid} не найден")
    return cs


@router.post("/projects/{key}/changesets", status_code=201, response_model=ChangeSetOut,
             summary="Создать черновик изменений из списка операций")
def create_changeset(key: str, body: ChangeSetIn, request: Request, session: Session = Depends(get_session)):
    domain.get_project(session, key)
    cs = ChangeSet(uid=new_uid(), project_key=key, title=body.title, state="draft",
                   operations=body.operations, created_at=utcnow())
    session.add(cs)
    domain.audit(session, key, request.state.actor, "changeset.create", cs.uid, {"title": body.title})
    session.commit()
    return _changeset_out(cs)


@router.put("/projects/{key}/changesets/{uid}", response_model=ChangeSetOut,
            summary="Изменить черновик: название и операции (применённый не меняется)")
def edit_changeset(key: str, uid: str, body: dict, request: Request, session: Session = Depends(get_session)):
    cs = _get_changeset(session, key, uid)
    if cs.state != "draft":
        raise domain.DomainError(409, "CHANGESET_NOT_DRAFT", "Применённый ChangeSet не редактируется")
    if "title" in body:
        cs.title = str(body["title"]).strip()[:300] or cs.title
    if "operations" in body:
        ops = body["operations"]
        if not isinstance(ops, list) or not (1 <= len(ops) <= 1000) or not all(isinstance(o, dict) for o in ops):
            raise domain.DomainError(422, "INVALID_OPERATIONS", "operations: список из 1–1000 объектов")
        cs.operations = ops
    domain.audit(session, key, request.state.actor, "changeset.edit", uid, {"operations": len(cs.operations)})
    session.commit()
    return _changeset_out(cs)


@router.get("/projects/{key}/changesets", response_model=list[ChangeSetOut], summary="Черновики и применённые ChangeSet")
def list_changesets(key: str, response: Response, offset: int = Query(default=0, ge=0),
                    limit: int = Query(default=20, ge=1, le=500), session: Session = Depends(get_session)):
    domain.get_project(session, key)
    rows = session.scalars(select(ChangeSet).where(ChangeSet.project_key == key).order_by(ChangeSet.created_at))
    return _page(response, [_changeset_out(cs) for cs in rows], offset, limit)


@router.get("/projects/{key}/changesets/{uid}", response_model=ChangeSetOut, summary="ChangeSet с операциями")
def get_changeset(key: str, uid: str, session: Session = Depends(get_session)):
    return _changeset_out(_get_changeset(session, key, uid))


@router.post("/projects/{key}/changesets/{uid}/apply", response_model=ChangeSetOut,
             summary="Применить ChangeSet целиком; при ошибке ничего не записывается")
def apply_changeset(key: str, uid: str, request: Request, session: Session = Depends(get_session)):
    cs = _get_changeset(session, key, uid)
    if cs.state != "draft":
        raise domain.DomainError(409, "CHANGESET_NOT_DRAFT", "ChangeSet уже применён")
    try:
        importer.apply_operations(session, key, cs.operations)
    except domain.DomainError as exc:
        session.rollback()  # ни одна операция не остаётся записанной (NFR-001)
        failed = _get_changeset(session, key, uid)
        failed.last_error = exc.message
        session.commit()
        raise
    cs.state = "applied"
    cs.applied_at = utcnow()
    cs.last_error = None
    domain.audit(session, key, request.state.actor, "changeset.apply", uid,
                 {"title": cs.title, "operations": len(cs.operations)})
    if cs.source:
        importer.record_from_changeset(session, key, cs.source)
    session.commit()
    return _changeset_out(cs)


@router.get("/projects/{key}/imports/{uid}", response_model=ImportDetail,
            summary="Импорт с исходным текстом (провенанс)")
def get_import(key: str, uid: str, session: Session = Depends(get_session)):
    record = session.scalar(select(ImportSession).where(
        ImportSession.project_key == key, ImportSession.uid == uid))
    if record is None:
        raise domain.DomainError(404, "IMPORT_NOT_FOUND", f"Импорт {uid} не найден")
    return ImportDetail(**importer.report_of(record), source_text=record.source_text)


# --- для скиллов и программного доступа ----------------------------------------

@router.get("/me", summary="Права текущего ключа")
def me(request: Request, session: Session = Depends(get_session)):
    principal = auth.authenticate(session, request.headers.get("authorization"))
    return {"name": principal.name, "kind": principal.kind,
            "project_key": principal.project_key, "role": principal.role or ("admin" if principal.kind == "admin" else None)}


@router.get("/projects/{key}/search", response_model=list[ArtifactOut],
            summary="Поиск по ID, названию и тексту текущих ревизий")
def search(key: str, q: str = Query(min_length=1, max_length=200), type: str | None = Query(default=None),
           limit: int = Query(default=20, ge=1, le=200), session: Session = Depends(get_session)):
    domain.get_project(session, key)
    needle = q.strip().lower()
    query = select(Artifact).where(Artifact.project_key == key).order_by(Artifact.display_id)
    if type:
        query = query.where(Artifact.type == type)
    found = []
    for artifact in session.scalars(query):
        out = _artifact_out(session, artifact)
        haystack = f"{out.display_id} {out.title} {out.text}".lower()
        if needle in haystack:
            found.append(out)
            if len(found) >= limit:
                break
    return found


@router.get("/projects/{key}/context", summary="Контекст для задачи вокруг артефакта (ContextBundle, §10)")
def context(key: str, focus: str, depth: int = Query(default=1, ge=1, le=2), session: Session = Depends(get_session)):
    card = _artifact_out(session, domain.get_artifact(session, key, focus))
    graph = domain.graph(session, key, focus, depth, "both", GRAPH_LIMIT_MAX)
    lost_item = next((i for i in domain.lost_items(session, key)[0] if i["display_id"] == focus), None)
    drafts = session.scalars(select(ChangeSet).where(ChangeSet.project_key == key, ChangeSet.state == "draft"))
    return {
        "focus": card.model_dump(mode="json"),
        "graph": graph,
        "lost": lost_item,
        "excluded": card.exemption_reason is not None,
        "draft_changesets": [{"uid": d.uid, "title": d.title, "operations": len(d.operations)} for d in drafts],
        "completeness": "truncated" if graph["truncated"] else "complete",
        "generated_at": utcnow().isoformat(),
    }


@router.get("/projects/{key}/impact", summary="Влияние изменения: явные пути и кандидаты (§6.4)")
def impact(key: str, focus: str, depth: int = Query(default=2, ge=1, le=3), session: Session = Depends(get_session)):
    return domain.impact(session, key, focus, depth)


@router.put("/projects/{key}/repo", summary="Подключить репозиторий проекта (read-only, только admin)")
def set_repo(key: str, body: dict, request: Request, session: Session = Depends(get_session)):
    from pth import gitops
    from pth.models import ProjectRepo
    auth.authorize(auth.authenticate(session, request.headers.get("authorization")), None, "writer")
    domain.get_project(session, key)
    try:
        info = gitops.validate_repo(str(body.get("path", "")))
    except gitops.GitError as exc:
        raise domain.DomainError(422, "REPO_INVALID", str(exc))
    repo = session.get(ProjectRepo, key) or ProjectRepo(project_key=key)
    repo.path, repo.head, repo.updated_at = info["path"], info["head"], utcnow()
    session.add(repo)
    domain.audit(session, key, request.state.actor, "repo.connect", info["path"], {"head": info["head"]})
    session.commit()
    return {"path": repo.path, "head": repo.head}


@router.get("/projects/{key}/repo", summary="Состояние подключённого репозитория")
def get_repo(key: str, session: Session = Depends(get_session)):
    from pth import gitops
    from pth.models import ProjectRepo
    domain.get_project(session, key)
    repo = session.get(ProjectRepo, key)
    if repo is None:
        return {"connected": False, "note": "Без репозитория проверки CI не подтверждаются по Git (§13.2)."}
    try:
        now = gitops.validate_repo(repo.path)
        return {"connected": True, "path": repo.path, "head": now["head"], "available": True}
    except gitops.GitError as exc:
        return {"connected": True, "path": repo.path, "available": False, "note": str(exc)}


@router.post("/projects/{key}/ci/runs", status_code=201, summary="Результаты прогона тестов для коммита (от CI или раннера)")
def ci_run(key: str, body: dict, request: Request, session: Session = Depends(get_session)):
    from pth import gitops
    from pth.models import ProjectRepo
    domain.get_project(session, key)
    commit = str(body.get("commit", "")).strip().lower()
    results = body.get("results", [])
    if not isinstance(results, list) or not results or len(results) > 500:
        raise domain.DomainError(422, "INVALID_RESULTS", "results: список 1–500 записей {test, result}")
    repo = session.get(ProjectRepo, key)
    oid = None
    if repo is not None:
        try:
            oid = gitops.resolve_commit(repo.path, commit)
        except gitops.GitError:
            oid = None
        if oid is None:
            raise domain.DomainError(422, "COMMIT_NOT_FOUND", f"Коммит {commit or '—'} не найден в подключённом репозитории")
    trust = "trusted_ci" if request.state.principal_kind == "service" else "human_recorded"
    created = domain.record_ci_results(session, key, commit, oid, results, trust,
                                       request.state.actor, body.get("environment", {}))
    domain.audit(session, key, request.state.actor, "ci.run", commit, {"tests": len(created), "verified": oid is not None})
    session.commit()
    return {"commit": commit, "commit_oid": oid, "verified": oid is not None, "trust_level": trust,
            "evidence": created}


@router.get("/projects/{key}/review", summary="Замечания по правилам качества с состоянием решения")
def review(response: Response, key: str, severity: str | None = Query(default=None, pattern="^(error|warning|info)$"),
           offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=500),
           session: Session = Depends(get_session)):
    findings = domain.review_state(session, key, domain.review(session, key))
    if severity:
        findings = [f for f in findings if f["severity"] == severity]
    counts = {s: sum(1 for f in findings if f["severity"] == s) for s in ("error", "warning", "info")}
    total = len(findings)
    return {"counts": counts, "total": total, "findings": findings[offset:offset + limit]}


@router.post("/projects/{key}/review/decisions", status_code=201, summary="Принять или снять замечание с причиной")
def decide(key: str, body: dict, request: Request, session: Session = Depends(get_session)):
    d = domain.decide_review(session, key, str(body.get("rule", "")), str(body.get("display_id", "")),
                             str(body.get("state", "")), str(body.get("reason", "")), request.state.actor)
    session.commit()
    return {"rule": d.rule, "display_id": d.display_id, "state": d.state, "revision": d.revision, "reason": d.reason}


@router.get("/projects/{key}/audit", summary="Журнал аудита проекта (новые сверху)")
def audit_log(response: Response, key: str, offset: int = Query(default=0, ge=0),
              limit: int = Query(default=20, ge=1, le=500), session: Session = Depends(get_session)):
    from pth.models import AuditEvent
    domain.get_project(session, key)
    total = session.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.project_key == key)) or 0
    response.headers["X-Total-Count"] = str(total)
    rows = session.scalars(select(AuditEvent).where(AuditEvent.project_key == key)
                           .order_by(AuditEvent.created_at.desc()).offset(offset).limit(limit)).all()
    return [{"actor": e.actor, "action": e.action, "target": e.target, "details": e.details,
             "created_at": e.created_at.isoformat()} for e in rows]


@router.patch("/projects/{key}", response_model=ProjectOut, summary="Переименовать проект (только admin)")
def rename_project(key: str, body: dict, request: Request, session: Session = Depends(get_session)):
    auth.authorize(auth.authenticate(session, request.headers.get("authorization")), None, "writer")  # только admin
    project = domain.get_project(session, key)
    name = str(body.get("name", "")).strip()
    if not (1 <= len(name) <= 200):
        raise domain.DomainError(422, "INVALID_NAME", "Название от 1 до 200 символов")
    old = project.name
    project.name = name
    domain.audit(session, key, request.state.actor, "project.rename", key, {"from": old, "to": name})
    session.commit()
    return ProjectOut(key=project.key, name=project.name, created_at=project.created_at)


@router.get("/projects/{key}/baselines/compare", summary="Сравнение двух снимков")
def compare(key: str, a: str, b: str, session: Session = Depends(get_session)):
    return domain.compare_baselines(session, key, a, b)


@router.get("/projects/{key}/commits/{sha}", summary="Карточка коммита")
def commit_detail(key: str, sha: str, session: Session = Depends(get_session)):
    for c in list_commits(key, session=session):
        if c["sha"] == sha or (c["sha"] or "").startswith(sha):
            return {**c, "evidence": [e for e in list_evidence(key, session=session) if e["commit_sha"] == c["sha"]],
                    "reachability": "не проверено: нет подключения к Git-репозиторию"}
    raise domain.DomainError(404, "COMMIT_NOT_FOUND", f"Коммит {sha} не найден")


@router.get("/projects/{key}/sources/{uid}", summary="Исходный текст импорта с привязкой строк к требованиям")
def source_view(key: str, uid: str, session: Session = Depends(get_session)):
    record = session.scalar(select(ImportSession).where(ImportSession.project_key == key, ImportSession.uid == uid))
    if record is None:
        raise domain.DomainError(404, "IMPORT_NOT_FOUND", f"Импорт {uid} не найден")
    fragments = record.report.get("fragments", [])
    lines = record.source_text.splitlines()
    by_line = {f["line"]: f["display_id"] for f in fragments}
    return {"source_name": record.source_name, "source_sha256": record.source_sha256,
            "lines": [{"no": i + 1, "text": text, "display_id": by_line.get(i + 1)} for i, text in enumerate(lines)],
            "fragments": len(fragments)}


@router.post("/projects/{key}/evidence", status_code=201, summary="Записать результат проверки (неизменяемо)")
def add_evidence(key: str, body: dict, request: Request, session: Session = Depends(get_session)):
    ev = domain.record_evidence(session, key, body.get("test"), body.get("result"),
                                body.get("commit_sha"), body.get("environment", {}))
    domain.audit(session, key, request.state.actor, "evidence.record", body.get("test"),
                 {"result": ev.result, "commit_sha": ev.commit_sha})
    session.commit()
    return {"uid": ev.uid, "test": body.get("test"), "result": ev.result, "commit_sha": ev.commit_sha,
            "environment": ev.environment, "created_at": ev.created_at.isoformat()}


@router.get("/projects/{key}/compliance", summary="Соответствие требований проверкам (SK-11)")
def compliance(key: str, session: Session = Depends(get_session)):
    return domain.compliance(session, key)


@router.get("/projects/{key}/readiness", summary="Готовность: ready / not_ready / insufficient_data (SK-13)")
def readiness(key: str, session: Session = Depends(get_session)):
    return domain.readiness(session, key)


@router.get("/projects/{key}/psi", summary="Черновик ПСИ в markdown (SK-10)", response_class=PlainTextResponse)
def psi(key: str, session: Session = Depends(get_session)):
    return domain.psi_markdown(session, key)


@router.post("/projects/{key}/baselines", status_code=201, summary="Зафиксировать базовый снимок (SK-13)")
def create_baseline(key: str, body: dict, request: Request, session: Session = Depends(get_session)):
    base = domain.create_baseline(session, key, str(body.get("name", "baseline"))[:200])
    domain.audit(session, key, request.state.actor, "baseline.create", base.uid, {"name": base.name})
    session.commit()
    return {"uid": base.uid, "name": base.name, "artifacts": len(base.snapshot["artifacts"]),
            "relations": len(base.snapshot["relations"]), "taken_at": base.snapshot["taken_at"]}


@router.get("/projects/{key}/baselines", summary="Базовые снимки проекта")
def list_baselines(key: str, session: Session = Depends(get_session)):
    from pth.models import Baseline
    domain.get_project(session, key)
    rows = session.scalars(select(Baseline).where(Baseline.project_key == key).order_by(Baseline.created_at))
    return [{"uid": b.uid, "name": b.name, "created_at": b.created_at.isoformat(),
             "artifacts": len(b.snapshot["artifacts"])} for b in rows]


@router.get("/projects/{key}/commits", summary="Зарегистрированные коммиты и связанные требования")
def list_commits(key: str, response: Response = None, offset: int = Query(default=0, ge=0),
                 limit: int = Query(default=20, ge=1, le=500), session: Session = Depends(get_session)):
    domain.get_project(session, key)
    a = domain.analyze(session, key)
    out = []
    for art in a.by_uid.values():
        if art.type != "COMMIT":
            continue
        implements = [a.by_uid[r.target_uid].display_id for r in a.relations
                      if r.type == "implements" and r.source_uid == art.uid]
        out.append({"display_id": art.display_id, "sha": art.external_key,
                    "title": a.revisions[art.uid].title, "implements": implements,
                    "created_at": art.created_at.isoformat()})
    out = sorted(out, key=lambda c: c["created_at"], reverse=True)
    if response is not None:
        return _page(response, out, offset, limit)
    return out


@router.get("/projects/{key}/evidence", summary="Записанные свидетельства проверок")
def list_evidence(key: str, response: Response = None, offset: int = Query(default=0, ge=0),
                  limit: int = Query(default=20, ge=1, le=500), session: Session = Depends(get_session)):
    from pth.models import Evidence
    domain.get_project(session, key)
    rows = session.scalars(select(Evidence).where(Evidence.project_key == key).order_by(Evidence.created_at.desc())).all()
    tests = {a.uid: a.display_id for a in session.scalars(select(Artifact).where(Artifact.project_key == key))}
    out = [{"uid": e.uid, "test": tests.get(e.test_uid), "result": e.result, "commit_sha": e.commit_sha,
            "commit_oid": e.commit_oid, "verified": e.verified, "trust_level": e.trust_level, "issuer": e.issuer,
            "environment": e.environment, "created_at": e.created_at.isoformat()} for e in rows]
    if response is not None:
        return _page(response, out, offset, limit)
    return out


@router.get("/projects/{key}/baselines/{uid}", summary="Снимок: состав ревизий и связей")
def get_baseline(key: str, uid: str, session: Session = Depends(get_session)):
    from pth.models import Baseline
    base = session.scalar(select(Baseline).where(Baseline.project_key == key, Baseline.uid == uid))
    if base is None:
        raise domain.DomainError(404, "BASELINE_NOT_FOUND", f"Снимок {uid} не найден")
    return {"uid": base.uid, "name": base.name, "created_at": base.created_at.isoformat(), **base.snapshot}


@router.get("/keys", summary="API-ключи (без токенов; только admin)")
def list_keys(request: Request, session: Session = Depends(get_session)):
    from pth.models import ApiKey
    rows = session.scalars(select(ApiKey).order_by(ApiKey.created_at)).all()
    return [{"uid": k.uid, "name": k.name, "kind": k.kind, "project_key": k.project_key, "role": k.role,
             "revoked": k.revoked_at is not None, "created_at": k.created_at.isoformat()} for k in rows]


@router.post("/keys", status_code=201, summary="Выпустить ключ; токен возвращается один раз (только admin)")
def create_key(body: dict, request: Request, session: Session = Depends(get_session)):
    kind = body.get("kind", "service")
    try:
        token = auth.issue_key(session, name=str(body.get("name", "key"))[:200], kind=kind,
                               project_key=body.get("project_key"), role=body.get("role"))
    except ValueError as exc:
        raise domain.DomainError(422, "INVALID_KEY", str(exc))
    if body.get("project_key"):
        domain.audit(session, body["project_key"], request.state.actor, "key.issue", str(body.get("name")),
                     {"role": body.get("role")})
    session.commit()
    return {"token": token, "kind": kind, "project_key": body.get("project_key"), "role": body.get("role")}


@router.post("/keys/{uid}/revoke", summary="Отозвать ключ (только admin)")
def revoke_key(uid: str, session: Session = Depends(get_session)):
    auth.revoke(session, uid)
    session.commit()
    return {"uid": uid, "revoked": True}


@router.get("/projects/{key}/status", summary="Сводка проекта: счётчики по типам и состоянию")
def status(key: str, session: Session = Depends(get_session)):
    domain.get_project(session, key)
    by_type: dict[str, int] = {}
    for artifact in session.scalars(select(Artifact).where(Artifact.project_key == key)):
        by_type[artifact.type] = by_type.get(artifact.type, 0) + 1
    lost_total, excluded = domain.lost_items(session, key)
    lost_total = len(lost_total)
    drafts = session.scalar(select(func.count()).select_from(ChangeSet).where(
        ChangeSet.project_key == key, ChangeSet.state == "draft")) or 0
    imports = session.scalar(select(func.count()).select_from(ImportSession).where(ImportSession.project_key == key)) or 0
    return {"artifacts": by_type, "lost": lost_total, "excluded": len(excluded),
            "draft_changesets": drafts, "imports": imports,
            "relations": session.scalar(select(func.count()).select_from(Relation).where(Relation.project_key == key)) or 0}

# --- анализ --------------------------------------------------------------------

@router.get("/projects/{key}/lost", response_model=LostOut,
            summary="Потерянные элементы: требования без кода и US без ФТ/ADR")
def lost(
    response: Response,
    key: str,
    type: str | None = Query(default=None),
    priority: str | None = Query(default=None, pattern=r"^P[0-3]$"),
    reason: str | None = Query(default=None, pattern="^(no_code_link|no_reflection)$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=500),
    session: Session = Depends(get_session),
):
    items, excluded = domain.lost_items(session, key, type, priority, reason)
    total = len(items)
    return LostOut(total=total, items=items[offset:offset + limit], excluded=excluded)


@router.get("/projects/{key}/graph", response_model=GraphOut,
            summary="Локальный подграф вокруг артефакта")
def graph(
    key: str,
    focus: str,
    depth: int = Query(default=2, ge=1, le=3),
    direction: Direction = "both",
    limit: int = Query(default=GRAPH_LIMIT_MAX, ge=1, le=GRAPH_LIMIT_MAX),
    relation_types: str | None = Query(default=None, description="Через запятую: refines,motivates,implements"),
    session: Session = Depends(get_session),
):
    types = set(relation_types.split(",")) if relation_types else None
    if types and not types <= {"refines", "motivates", "implements"}:
        raise domain.DomainError(422, "INVALID_FILTER", "Неизвестный тип связи в relation_types")
    return domain.graph(session, key, focus, depth, direction, limit, types)


def _mark_interrupted_jobs(session_factory) -> None:
    """Фоновые задачи живут в памяти процесса: после перезапуска их не продолжить, только зафиксировать."""
    with session_factory() as session:
        stale = session.scalars(select(ExtractionJob).where(ExtractionJob.state.in_(["queued", "running"]))).all()
        for job in stale:
            job.state = "failed"
            job.finished_at = utcnow()
            job.errors = [*job.errors, "задача прервана перезапуском сервера; запустите выделение заново"]
        if stale:
            session.commit()


def create_app(database_url: str | None = None) -> FastAPI:
    url = database_url or os.environ.get("PTH_DATABASE_URL", DEFAULT_DB)
    engine = make_engine(url)
    from pth.migrations import migrate
    migrate(engine)

    app = FastAPI(
        title="Project Traceability Hub API",
        version="0.1.0",
        description="Минимальный срез API по спеке PTH v0.1: проекты, артефакты с ревизиями, связи, коммиты, потерянные элементы, граф. Аутентификация и ChangeSet ещё не реализованы.",
    )
    app.state.session_factory = make_session_factory(engine)
    _mark_interrupted_jobs(app.state.session_factory)
    app.state.llm_base = os.environ.get("PTH_LLM_BASE_URL", llm.DEFAULT_BASE)
    app.state.llm_key = os.environ.get("LM_API_TOKEN")
    app.state.llm_transport = None  # тесты подставляют имитацию LM Studio
    app.include_router(router)

    @app.exception_handler(domain.DomainError)
    async def domain_error(_: Request, exc: domain.DomainError):
        return JSONResponse(status_code=exc.status,
                            content={"error": {"code": exc.code, "message": exc.message}})

    return app
