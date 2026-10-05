"""Доменные правила: создание, ревизии, связи, список потерянных, граф.

Реализован подмножество каталога связей спеки (§6.1): refines, motivates, implements.
Все операции выполняются в одной сессии; вызывающий делает commit.
"""
import re
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pth.models import Artifact, ArtifactRevision, Project, Relation, new_uid, utcnow

REQUIREMENT_TYPES = {"FR", "NFR", "AC"}
VERIFIABLE_TYPES = {"FR", "NFR", "AC"}
RELATION_RULES: dict[str, tuple[set[str], set[str]]] = {
    "refines": ({"FR", "NFR", "AC", "US"}, {"US", "FR", "NFR"}),
    "motivates": ({"US", "FR", "NFR"}, {"ADR"}),
    "implements": ({"COMMIT"}, {"FR", "NFR", "AC", "US"}),
    "verifies": ({"TEST"}, {"FR", "NFR", "AC"}),
}
RECOMMENDED = {
    "no_code_link": "связать с коммитом (implements) или указать обоснованное исключение",
    "no_reflection": "добавить ФТ с refines к этой US или ADR с motivates",
}


class DomainError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass
class Analysis:
    by_uid: dict[str, Artifact] = field(default_factory=dict)
    revisions: dict[str, ArtifactRevision] = field(default_factory=dict)
    relations: list[Relation] = field(default_factory=list)
    implemented_by: dict[str, Artifact] = field(default_factory=dict)
    reflected: set[str] = field(default_factory=set)

    def reasons(self, artifact: Artifact) -> list[str]:
        rev = self.revisions[artifact.uid]
        if rev.exemption_reason or artifact.type == "COMMIT" or artifact.type == "ADR":
            return []
        found = []
        if artifact.type in REQUIREMENT_TYPES and artifact.uid not in self.implemented_by:
            found.append("no_code_link")
        if artifact.type == "US" and artifact.uid not in self.reflected:
            found.append("no_reflection")
        return found


# --- поиск -------------------------------------------------------------------

def get_project(session: Session, key: str) -> Project:
    project = session.get(Project, key)
    if project is None:
        raise DomainError(404, "PROJECT_NOT_FOUND", f"Проект {key} не найден")
    return project


def get_artifact(session: Session, key: str, display_id: str) -> Artifact:
    artifact = session.scalar(
        select(Artifact).where(Artifact.project_key == key, Artifact.display_id == display_id)
    )
    if artifact is None:
        raise DomainError(404, "ARTIFACT_NOT_FOUND", f"Артефакт {display_id} не найден")
    return artifact


def latest_revision(session: Session, artifact: Artifact) -> ArtifactRevision:
    return session.scalar(
        select(ArtifactRevision)
        .where(ArtifactRevision.artifact_uid == artifact.uid)
        .order_by(ArtifactRevision.number.desc())
        .limit(1)
    )


def _next_number(session: Session, key: str, type_: str) -> int:
    current = session.scalar(
        select(Artifact.number)
        .where(Artifact.project_key == key, Artifact.type == type_)
        .order_by(Artifact.number.desc())
        .limit(1)
    )
    return (current or 0) + 1


# --- команды -------------------------------------------------------------------

def create_project(session: Session, key: str, name: str) -> Project:
    if session.get(Project, key) is not None:
        raise DomainError(409, "PROJECT_EXISTS", f"Проект {key} уже существует")
    project = Project(key=key, name=name, created_at=utcnow())
    session.add(project)
    session.flush()
    return project


def _add_artifact(session, key, type_, title, text, attributes, exemption_reason, external_key=None):
    number = _next_number(session, key, type_)
    artifact = Artifact(
        uid=new_uid(), project_key=key, type=type_, number=number,
        display_id=f"{key}-{type_}-{number:03d}", external_key=external_key, created_at=utcnow(),
    )
    session.add(artifact)
    session.add(ArtifactRevision(
        uid=new_uid(), artifact_uid=artifact.uid, number=1, title=title, text=text,
        attributes=attributes, exemption_reason=exemption_reason, created_at=utcnow(),
    ))
    session.flush()
    return artifact


def check_test_coverage(type_: str, attributes: dict) -> None:
    """Неполный набор тестов должен перечислять, что именно не покрыто, иначе он не фиксируется как неполный."""
    if type_ != "TEST":
        return
    coverage = attributes.get("coverage", "full")
    if coverage not in {"full", "partial"}:
        raise DomainError(422, "INVALID_COVERAGE", "coverage: full | partial")
    if coverage == "partial" and not str(attributes.get("coverage_gaps", "")).strip():
        raise DomainError(422, "COVERAGE_GAPS_REQUIRED",
                          "Неполный набор тестов: укажите coverage_gaps — что не покрыто")


def create_artifact(session, key, type_, title, text, attributes, exemption_reason):
    get_project(session, key)
    if type_ == "COMMIT":
        raise DomainError(422, "USE_COMMIT_ENDPOINT", "Коммиты создаются через /commits")
    check_test_coverage(type_, attributes)
    return _add_artifact(session, key, type_, title, text, attributes, exemption_reason)


def add_revision(session, key, display_id, title, text, attributes, exemption_reason, expected_revision):
    artifact = get_artifact(session, key, display_id)
    if artifact.type == "TEST":
        check_test_coverage("TEST", attributes)
    current = latest_revision(session, artifact)
    if expected_revision is not None and expected_revision != current.number:
        raise DomainError(
            409, "REVISION_CONFLICT",
            f"Ожидалась ревизия {expected_revision}, текущая {current.number}",
        )
    rev = ArtifactRevision(
        uid=new_uid(), artifact_uid=artifact.uid, number=current.number + 1, title=title,
        text=text, attributes=attributes, exemption_reason=exemption_reason, created_at=utcnow(),
    )
    session.add(rev)
    session.flush()
    return artifact, rev


def create_relation(session, key, type_, source_id, target_id) -> Relation:
    source = get_artifact(session, key, source_id)
    target = get_artifact(session, key, target_id)
    if source.uid == target.uid:
        raise DomainError(422, "INVALID_RELATION", "Связь с самим собой запрещена")
    allowed_source, allowed_target = RELATION_RULES[type_]
    if source.type not in allowed_source or target.type not in allowed_target:
        raise DomainError(
            422, "INVALID_RELATION",
            f"{type_}: {source.type} → {target.type} не разрешено каталогом связей",
        )
    exists = session.scalar(select(Relation).where(
        Relation.type == type_, Relation.source_uid == source.uid, Relation.target_uid == target.uid,
    ))
    if exists is not None:
        raise DomainError(409, "DUPLICATE_RELATION", "Такая связь уже есть")
    relation = Relation(uid=new_uid(), project_key=key, type=type_, source_uid=source.uid,
                        target_uid=target.uid, status="confirmed", created_at=utcnow())
    session.add(relation)
    session.flush()
    return relation


def create_commit(session, key, sha, title, implements):
    get_project(session, key)
    if session.scalar(select(Artifact).where(
        Artifact.project_key == key, Artifact.external_key == sha,
    )) is not None:
        raise DomainError(409, "COMMIT_EXISTS", f"Коммит {sha} уже зарегистрирован")
    targets = [get_artifact(session, key, d) for d in implements]
    for t in targets:
        if t.type not in RELATION_RULES["implements"][1]:
            raise DomainError(422, "INVALID_RELATION", f"Коммит не может реализовывать {t.type}")
    commit = _add_artifact(session, key, "COMMIT", title, sha, {"sha": sha}, None, external_key=sha)
    for t in targets:
        session.add(Relation(uid=new_uid(), project_key=key, type="implements",
                             source_uid=commit.uid, target_uid=t.uid, status="confirmed",
                             created_at=utcnow()))
    session.flush()
    return commit


# --- аналитика -----------------------------------------------------------------

def analyze(session: Session, key: str) -> Analysis:
    a = Analysis()
    arts = list(session.scalars(select(Artifact).where(Artifact.project_key == key)))
    a.by_uid = {x.uid: x for x in arts}
    if arts:
        revs = session.scalars(select(ArtifactRevision).where(
            ArtifactRevision.artifact_uid.in_(list(a.by_uid))).order_by(ArtifactRevision.number))
        for r in revs:  # по возрастанию номера: остаётся последняя
            a.revisions[r.artifact_uid] = r
    a.relations = list(session.scalars(select(Relation).where(
        Relation.project_key == key, Relation.status == "confirmed").order_by(Relation.created_at)))
    for r in a.relations:
        s, t = a.by_uid[r.source_uid], a.by_uid[r.target_uid]
        if r.type == "implements":
            a.implemented_by[t.uid] = s
        elif r.type == "refines" and s.type == "FR" and t.type == "US":
            a.reflected.add(t.uid)
        elif r.type == "motivates" and s.type == "US" and t.type == "ADR":
            a.reflected.add(s.uid)
    return a


def lost_items(session: Session, key: str, type_filter: str | None = None,
               priority: str | None = None, reason: str | None = None) -> tuple[list[dict], list[str]]:
    """Возвращает потерянные элементы и display_id исключённых (обоснованное исключение)."""
    get_project(session, key)
    a = analyze(session, key)
    items, excluded = [], []
    for art in a.by_uid.values():
        rev = a.revisions[art.uid]
        if rev.exemption_reason and art.type in REQUIREMENT_TYPES | {"US"}:
            excluded.append(art.display_id)
        reasons = a.reasons(art)
        if not reasons or (type_filter and art.type != type_filter):
            continue
        if priority and rev.attributes.get("priority") != priority:
            continue
        if reason and reason not in reasons:
            continue
        last = a.implemented_by.get(art.uid)
        items.append({
            "display_id": art.display_id, "type": art.type, "title": rev.title,
            "priority": rev.attributes.get("priority"), "reasons": reasons,
            "last_commit": last.display_id if last else None,
            "recommended_action": "; ".join(RECOMMENDED[r] for r in reasons),
        })
    # Сначала несвязанные с кодом: реализация — более поздний этап, чем связь требования с ФТ/ADR.
    items.sort(key=lambda i: ("no_code_link" not in i["reasons"], i["priority"] or "P9", i["display_id"]))
    return items, sorted(excluded)


def graph(session, key, focus, depth, direction, limit, relation_types=None) -> dict:
    get_project(session, key)
    a = analyze(session, key)
    start = get_artifact(session, key, focus)
    out_adj, in_adj = {}, {}
    relations = [r for r in a.relations if not relation_types or r.type in relation_types]
    for r in relations:
        out_adj.setdefault(r.source_uid, []).append(r)
        in_adj.setdefault(r.target_uid, []).append(r)

    visited = {start.uid: 0}
    queue = deque([start.uid])
    truncated = False
    while queue:
        uid = queue.popleft()
        if visited[uid] >= depth:
            continue
        neighbours = []
        if direction in ("out", "both"):
            neighbours += [r.target_uid for r in out_adj.get(uid, [])]
        if direction in ("in", "both"):
            neighbours += [r.source_uid for r in in_adj.get(uid, [])]
        for nxt in neighbours:
            if nxt in visited:
                continue
            if len(visited) >= limit:
                truncated = True
                continue
            visited[nxt] = visited[uid] + 1
            queue.append(nxt)

    nodes = []
    for uid in visited:
        art = a.by_uid[uid]
        reasons = a.reasons(art)
        nodes.append({"display_id": art.display_id, "type": art.type,
                      "title": a.revisions[uid].title, "lost": bool(reasons), "reasons": reasons})
    edges = [{"type": r.type, "source": a.by_uid[r.source_uid].display_id,
              "target": a.by_uid[r.target_uid].display_id}
             for r in relations if r.source_uid in visited and r.target_uid in visited]
    return {"focus": focus, "nodes": nodes, "edges": edges, "truncated": truncated}


# --- проверка качества требований (детерминированные правила, DEC-10) -----------

NUMBER = re.compile(r"\d")
VAGUE = re.compile(r"\b(быстро|удобно|легко|по возможности|при необходимости|как можно)\b", re.IGNORECASE)


def review(session: Session, key: str) -> list[dict]:
    """Замечания по правилам, которые не требуют модели. Каждое — с ID, правилом и пояснением."""
    get_project(session, key)
    a = analyze(session, key)
    findings: list[dict] = []

    def add(severity: str, rule: str, art: Artifact, message: str) -> None:
        findings.append({"severity": severity, "rule": rule, "display_id": art.display_id, "message": message})

    titles: dict[str, list[Artifact]] = {}
    for art in sorted(a.by_uid.values(), key=lambda x: x.display_id):
        if art.type in {"COMMIT", "ADR"}:
            continue
        rev = a.revisions[art.uid]
        if rev.exemption_reason and not rev.exemption_reason.strip():
            add("error", "EXEMPTION_NO_REASON", art, "Исключение без пояснения")
        if art.type in {"US", "FR", "NFR"} and not rev.attributes.get("priority") and not rev.exemption_reason:
            add("warning", "NO_PRIORITY", art, "Не указан приоритет")
        if art.type == "NFR" and not NUMBER.search(f"{rev.title} {rev.text}"):
            add("warning", "NFR_NO_CRITERION", art, "Нефункциональное требование без числового критерия")
        if VAGUE.search(f"{rev.title} {rev.text}"):
            add("info", "VAGUE_WORDING", art, "Расплывчатая формулировка: " + VAGUE.search(f"{rev.title} {rev.text}").group(0))
        if art.type == "AC" and not any(r.type == "refines" and r.source_uid == art.uid for r in a.relations):
            add("warning", "AC_NOT_LINKED", art, "Приёмочный сценарий не связан с требованием")
        if art.type == "FR" and not any(r.type == "refines" and r.source_uid == art.uid for r in a.relations):
            add("warning", "FR_NOT_LINKED", art, "ФТ не уточняет ни одну user story")
        titles.setdefault(" ".join(rev.title.lower().split()), []).append(art)

    for group in titles.values():
        if len(group) > 1:
            for art in group:
                add("warning", "DUPLICATE_TITLE", art,
                    "Одинаковое название у: " + ", ".join(g.display_id for g in group if g.uid != art.uid))
    for item in lost_items(session, key)[0]:
        if "no_reflection" in item["reasons"]:
            add("error", "LOST_USER_STORY", a.by_uid[next(u for u, x in a.by_uid.items() if x.display_id == item["display_id"])],
                "User story без ФТ и без ADR")
    return findings


# --- анализ влияния (§6.4): явные пути по каталогу связей ----------------------

IMPACT_RULES = {
    # изменение родителя (US/FR) затрагивает уточняющие требования
    ("refines", "in"): ("IMP-REFINES-CHILD", "explicit", "проверить уточняющие требования"),
    # изменение уточняющего требования — кандидат для проверки покрытия родителя
    ("refines", "out"): ("IMP-REFINES-PARENT", "candidate", "проверить покрытие родительского требования"),
    # изменение требования затрагивает коммиты, которые его реализуют
    ("implements", "out"): ("IMP-IMPLEMENTS", "explicit", "перепроверить реализацию коммитом"),
    # изменение требования затрагивает ADR, на которое оно опирается
    ("motivates", "out"): ("IMP-MOTIVATES", "explicit", "пересмотреть основание решения"),
}


def impact(session: Session, key: str, focus: str, depth: int = 2, limit: int = 200) -> dict:
    """Обход от изменяемого элемента по правилам IMPACT_RULES. Каждый элемент — с путём и правилом."""
    get_project(session, key)
    a = analyze(session, key)
    start = get_artifact(session, key, focus)
    edges_from: dict[str, list[tuple[Relation, str]]] = {}
    for r in a.relations:
        edges_from.setdefault(r.target_uid, []).append((r, "in"))   # кто ссылается на изменяемый
        edges_from.setdefault(r.source_uid, []).append((r, "out"))  # на что ссылается изменяемый
    visited = {start.uid: ()}
    items: list[dict] = []
    frontier = [start.uid]
    truncated = False
    for level in range(1, depth + 1):
        next_frontier = []
        for uid in frontier:
            for rel, direction in edges_from.get(uid, []):
                rule = IMPACT_RULES.get((rel.type, direction))
                if rule is None:
                    continue
                other = rel.source_uid if direction == "in" else rel.target_uid
                if other in visited or other == start.uid:
                    continue
                if len(items) >= limit:
                    truncated = True
                    break
                visited[other] = visited[uid] + (a.by_uid[uid].display_id,)
                art = a.by_uid[other]
                rule_id, certainty, action = rule
                items.append({"display_id": art.display_id, "type": art.type, "depth": level,
                              "path": [*visited[other], art.display_id], "rule_id": rule_id,
                              "certainty": certainty, "action": action})
                next_frontier.append(other)
        frontier = next_frontier
    items.sort(key=lambda i: (i["depth"], i["display_id"]))
    return {"focus": focus, "items": items, "truncated": truncated,
            "note": "Явные пути по каталогу связей. Кандидаты не являются нарушениями."}


# --- проверки: свидетельства, соответствие, ПСИ, готовность (SK-10, SK-11, SK-13) ---

IMPACT_RULES[("verifies", "in")] = ("IMP-VERIFIES", "explicit", "перепроверить тест на соответствие")


def record_evidence(session: Session, key: str, test_id: str, result: str,
                    commit_sha: str | None, environment: dict) -> "Evidence":
    from pth.models import Evidence
    test = get_artifact(session, key, test_id)
    if test.type != "TEST":
        raise DomainError(422, "NOT_A_TEST", f"{test_id} — не TEST")
    if result not in {"pass", "fail", "blocked", "inconclusive"}:
        raise DomainError(422, "INVALID_RESULT", "result: pass | fail | blocked | inconclusive")
    ev = Evidence(uid=new_uid(), project_key=key, test_uid=test.uid, commit_sha=commit_sha,
                  result=result, environment=environment, created_at=utcnow())
    session.add(ev)
    session.flush()
    return ev


def record_ci_results(session: Session, key: str, commit: str, oid: str | None, results: list[dict],
                      trust: str, issuer: str, environment: dict) -> list[dict]:
    """Пишет свидетельство на каждый тест из результата. verified — коммит найден в репозитории."""
    from pth.models import Evidence
    out = []
    for item in results:
        if not isinstance(item, dict):
            raise DomainError(422, "INVALID_RESULTS", "каждая запись — объект {test, result}")
        test = get_artifact(session, key, str(item.get("test", "")))
        if test.type != "TEST":
            raise DomainError(422, "NOT_A_TEST", f"{test.display_id} — не TEST")
        result = str(item.get("result", ""))
        if result not in {"pass", "fail", "blocked", "inconclusive"}:
            raise DomainError(422, "INVALID_RESULT", "result: pass | fail | blocked | inconclusive")
        ev = Evidence(uid=new_uid(), project_key=key, test_uid=test.uid, commit_sha=commit or None,
                      commit_oid=oid, verified=oid is not None, trust_level=trust, issuer=issuer,
                      result=result, environment=environment, created_at=utcnow())
        session.add(ev)
        out.append({"test": test.display_id, "result": result, "verified": ev.verified, "trust_level": trust})
    session.flush()
    return out


def current_head(session: Session, key: str) -> str | None:
    """HEAD подключённого репозитория (читается сейчас). None — репозиторий не подключён или недоступен."""
    from pth import gitops
    from pth.models import ProjectRepo
    repo = session.get(ProjectRepo, key)
    if repo is None:
        return None
    try:
        return gitops.validate_repo(repo.path)["head"]
    except gitops.GitError:
        return None


def test_status(session: Session, key: str) -> dict:
    """Состояние каждого TEST: запускался ли, результат, на каком коммите, актуален ли для HEAD.
    Требования без теста — отдельным списком: тест не написан."""
    from pth.models import Evidence
    get_project(session, key)
    a = analyze(session, key)
    head = current_head(session, key)
    verifies: dict[str, list[str]] = {}
    for r in a.relations:
        if r.type == "verifies":
            verifies.setdefault(r.source_uid, []).append(a.by_uid[r.target_uid].display_id)
    tests = []
    for art in sorted((x for x in a.by_uid.values() if x.type == "TEST"), key=lambda x: x.display_id):
        last = session.scalar(select(Evidence).where(Evidence.test_uid == art.uid)
                              .order_by(Evidence.created_at.desc()).limit(1))
        command = a.revisions[art.uid].attributes.get("command")
        if last is None:
            state, commit = "not_run", None
        else:
            commit = last.commit_oid or last.commit_sha
            if last.result == "fail":
                state = "failed"
            elif last.result != "pass":
                state = "inconclusive"
            elif not (last.verified or last.trust_level == "human_recorded"):
                state = "pending_verification"
            elif head is not None and commit and not head.startswith(commit) and commit != head:
                state = "passed_old_commit"
            else:
                state = "passed_current" if head is not None else "passed"
        coverage = a.revisions[art.uid].attributes.get("coverage", "full")
        tests.append({"test": art.display_id, "title": a.revisions[art.uid].title, "command": command,
                      "coverage": coverage, "coverage_gaps": a.revisions[art.uid].attributes.get("coverage_gaps"),
                      "requirements": sorted(verifies.get(art.uid, [])), "state": state,
                      "commit": commit, "result": last.result if last else None,
                      "ran_at": last.created_at.isoformat() if last else None})
    covered = {r for t in tests for r in t["requirements"]}
    untested = sorted(i.display_id for i in a.by_uid.values()
                      if i.type in VERIFIABLE_TYPES and i.display_id not in covered
                      and not a.revisions[i.uid].exemption_reason)
    counts: dict[str, int] = {}
    for t in tests:
        counts[t["state"]] = counts.get(t["state"], 0) + 1
    return {"head": head, "tests": tests, "counts": counts, "requirements_without_test": untested}


def compliance(session: Session, key: str) -> dict:
    """Для каждого FR/NFR/AC: verified | failed | not_verified | stale | no_test | excluded.

    verified — все тесты, связанные через verifies, имеют последнее свидетельство pass, и оно
    создано не раньше последней ревизии требования. Иначе — stale. Коммит и статус реализации
    здесь не учитываются: это отдельная проверка.
    """
    from pth.models import Evidence
    get_project(session, key)
    a = analyze(session, key)
    head = current_head(session, key)
    verifies: dict[str, list[Artifact]] = {}
    for r in a.relations:
        if r.type == "verifies":
            verifies.setdefault(r.target_uid, []).append(a.by_uid[r.source_uid])
    items = []
    for art in sorted(a.by_uid.values(), key=lambda x: x.display_id):
        if art.type not in VERIFIABLE_TYPES:
            continue
        rev = a.revisions[art.uid]
        if rev.exemption_reason:
            items.append({"display_id": art.display_id, "status": "excluded", "tests": []})
            continue
        tests = verifies.get(art.uid, [])
        if not tests:
            items.append({"display_id": art.display_id, "status": "no_test", "tests": []})
            continue
        statuses = []
        for test in tests:
            last = session.scalar(select(Evidence).where(Evidence.test_uid == test.uid)
                                  .order_by(Evidence.created_at.desc()).limit(1))
            if last is None:
                statuses.append((test.display_id, "not_verified"))
            elif not (last.verified or last.trust_level == "human_recorded"):
                # Свидетельство CI без проверки коммита в Git — «ожидает проверки», readiness его не считает (§13.2)
                statuses.append((test.display_id, "not_verified"))
            elif head is not None and last.commit_oid and last.commit_oid != head:
                # Свидетельство для другого коммита: для текущего кода не действует (§14.4)
                statuses.append((test.display_id, "stale"))
            elif last.result == "fail":
                statuses.append((test.display_id, "failed"))
            elif last.result != "pass":
                statuses.append((test.display_id, "not_verified"))
            elif _aware(last.created_at) < _aware(rev.created_at):
                statuses.append((test.display_id, "stale"))
            else:
                statuses.append((test.display_id, "verified"))
        values = {s for _, s in statuses}
        overall = next((s for s in ("failed", "stale", "not_verified") if s in values), None)
        if overall is None:
            partial = any(a.revisions[t.uid].attributes.get("coverage") == "partial" for t in tests)
            overall = "partial" if partial else "verified"  # неполный набор тестов не считается полной проверкой
        items.append({"display_id": art.display_id, "status": overall,
                      "tests": [{"display_id": t, "status": s} for t, s in statuses]})
    counts: dict[str, int] = {}
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    return {"counts": counts, "items": items}


def _aware(value):
    from datetime import timezone
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def readiness(session: Session, key: str) -> dict:
    """ready — все проверяемые требования (кроме исключённых) verified; иначе not_ready. Без данных — insufficient_data."""
    report = compliance(session, key)
    relevant = [i for i in report["items"] if i["status"] != "excluded"]
    if not relevant:
        verdict = "insufficient_data"
    elif all(i["status"] == "verified" for i in relevant):
        verdict = "ready"
    else:
        verdict = "not_ready"
    blocking = [{"display_id": i["display_id"], "status": i["status"]}
                for i in relevant if i["status"] != "verified"]
    return {"verdict": verdict, "total": len(relevant), "blocking": blocking, "counts": report["counts"]}


def psi_markdown(session: Session, key: str) -> str:
    """Черновик ПСИ: по каждому требованию — условие проверки, тесты и последний результат, отдельно пробелы."""
    report = compliance(session, key)
    arts = {a.display_id: a for a in session.scalars(select(Artifact).where(Artifact.project_key == key))}
    lines = [f"# Программа и методика испытаний — {key} (черновик)", "",
             "Сгенерировано из требований и свидетельств. Пороги и условия берутся из текста требований, не придуманы.", ""]
    gaps = [i for i in report["items"] if i["status"] in {"no_test", "not_verified", "stale", "failed"}]
    lines += ["## Проверки", "", "| Требование | Название | Тесты | Статус |", "| --- | --- | --- | --- |"]
    for item in report["items"]:
        if item["status"] == "excluded":
            continue
        art = arts[item["display_id"]]
        tests = ", ".join(t["display_id"] for t in item["tests"]) or "—"
        title = session.scalar(select(ArtifactRevision.title).where(
            ArtifactRevision.artifact_uid == art.uid).order_by(ArtifactRevision.number.desc()).limit(1))
        lines.append(f"| {item['display_id']} | {title} | {tests} | {item['status']} |")
    lines += ["", "## Пробелы", ""]
    lines += [f"- {g['display_id']}: {g['status']}" for g in gaps] or ["- нет"]
    return "\n".join(lines) + "\n"


def create_baseline(session: Session, key: str, name: str) -> "Baseline":
    from pth.models import Baseline
    a = analyze(session, key)
    snapshot = {
        "artifacts": {art.display_id: a.revisions[art.uid].number for art in a.by_uid.values()},
        "relations": sorted([r.type, a.by_uid[r.source_uid].display_id, a.by_uid[r.target_uid].display_id]
                            for r in a.relations),
        "taken_at": utcnow().isoformat(),
    }
    base = Baseline(uid=new_uid(), project_key=key, name=name, snapshot=snapshot, created_at=utcnow())
    session.add(base)
    session.flush()
    return base


# --- аудит и решения по замечаниям ----------------------------------------------

def audit(session: Session, key: str, actor: str, action: str, target: str | None = None,
          details: dict | None = None) -> None:
    """Добавляет запись аудита в ту же транзакцию, что и изменение (NFR-009)."""
    from pth.models import AuditEvent
    session.add(AuditEvent(uid=new_uid(), project_key=key, actor=actor or "unknown", action=action,
                           target=target, details=details or {}, created_at=utcnow()))


def decide_review(session: Session, key: str, rule: str, display_id: str, state: str, reason: str,
                  actor: str) -> "ReviewDecision":
    from pth.models import ReviewDecision
    if state not in {"resolved", "dismissed"}:
        raise DomainError(422, "INVALID_STATE", "state: resolved | dismissed")
    if not reason.strip():
        raise DomainError(422, "REASON_REQUIRED", "Решение без причины не принимается")
    artifact = get_artifact(session, key, display_id)
    rev = latest_revision(session, artifact).number
    decision = ReviewDecision(uid=new_uid(), project_key=key, rule=rule, display_id=display_id,
                              revision=rev, state=state, reason=reason.strip(), actor=actor,
                              created_at=utcnow())
    session.add(decision)
    audit(session, key, actor, "review.decide", f"{rule}:{display_id}", {"state": state, "revision": rev})
    session.flush()
    return decision


def review_state(session: Session, key: str, findings: list[dict]) -> list[dict]:
    """Добавляет к каждому замечанию состояние: open | resolved | dismissed | reopened."""
    from pth.models import ReviewDecision
    arts = {a.display_id: a for a in session.scalars(select(Artifact).where(Artifact.project_key == key))}
    decisions = session.scalars(select(ReviewDecision).where(ReviewDecision.project_key == key)
                                .order_by(ReviewDecision.created_at)).all()
    last: dict[tuple[str, str], ReviewDecision] = {}
    for d in decisions:
        last[(d.rule, d.display_id)] = d
    out = []
    for f in findings:
        d = last.get((f["rule"], f["display_id"]))
        state = "open"
        if d is not None:
            current = domain_latest_number(session, arts.get(f["display_id"]))
            if current != d.revision:
                state = "reopened"  # элемент изменился после решения
            else:
                state = d.state
        out.append({**f, "state": state, "decision": None if d is None else {
            "state": d.state, "reason": d.reason, "actor": d.actor, "revision": d.revision}})
    return out


def domain_latest_number(session: Session, artifact) -> int | None:
    if artifact is None:
        return None
    return latest_revision(session, artifact).number


def artifacts_page(session: Session, key: str, type_: str | None, offset: int, limit: int) -> tuple[list, int]:
    query = select(Artifact).where(Artifact.project_key == key)
    if type_:
        query = query.where(Artifact.type == type_)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = session.scalars(query.order_by(Artifact.display_id).offset(offset).limit(limit)).all()
    return rows, total


def compare_baselines(session: Session, key: str, a_uid: str, b_uid: str) -> dict:
    from pth.models import Baseline
    a = session.scalar(select(Baseline).where(Baseline.project_key == key, Baseline.uid == a_uid))
    b = session.scalar(select(Baseline).where(Baseline.project_key == key, Baseline.uid == b_uid))
    if a is None or b is None:
        raise DomainError(404, "BASELINE_NOT_FOUND", "Один из снимков не найден")
    sa, sb = a.snapshot["artifacts"], b.snapshot["artifacts"]
    ra, rb = {tuple(x) for x in a.snapshot["relations"]}, {tuple(x) for x in b.snapshot["relations"]}
    return {
        "a": a.name, "b": b.name,
        "added": sorted(set(sb) - set(sa)),
        "removed": sorted(set(sa) - set(sb)),
        "changed": sorted(k for k in set(sa) & set(sb) if sa[k] != sb[k]),
        "relations_added": [list(x) for x in sorted(rb - ra)],
        "relations_removed": [list(x) for x in sorted(ra - rb)],
    }
