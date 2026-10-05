"""Импорт принятой спецификации (спека, §8; SK-01 в минимальном виде).

Импорт строит план операций, который можно: применить сразу (`apply`), посмотреть (`dry_run`)
или сохранить черновиком ChangeSet (`as_changeset`). Планирование только читает данные; запись
выполняет `execute_op` внутри одной транзакции. Таблицы DEC, SK и ADR не импортируются.
"""
import hashlib
import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from pth import domain
from pth.models import Artifact, ArtifactRevision, ImportSession, Relation, new_uid, utcnow

ID_CELL = re.compile(r"^PTH-(US|FR|NFR|AC)-(\d{3})$")
REF = re.compile(r"PTH-US-\d{3}")
SEPARATOR = re.compile(r"^\|?\s*:?-{3,}")
OUT_OF_SCOPE = re.compile(r"^(DEC|SK|ADR)-\d+$")


@dataclass
class Row:
    id: str
    type: str
    number: int
    title: str
    text: str
    attributes: dict
    basis: str
    line: int = 0


@dataclass
class Plan:
    operations: list[dict] = field(default_factory=list)
    changes: list[dict] = field(default_factory=list)
    created: int = 0
    revised: int = 0
    unchanged: int = 0
    relations_created: int = 0
    unparsed: list[str] = field(default_factory=list)
    fragments: list[dict] = field(default_factory=list)


def parse_spec(text: str) -> tuple[list[Row], list[str]]:
    """Разбирает таблицы с колонкой «ID». Возвращает строки и нераспознанные строки с ID."""
    rows: list[Row] = []
    unparsed: list[str] = []
    header: list[str] | None = None
    for line_no, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if not stripped.startswith("|"):
            header = None
            continue
        if SEPARATOR.match(stripped):
            continue
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if header is None:
            header = cells
            continue
        if header[0] != "ID" or not cells:
            continue
        if OUT_OF_SCOPE.match(cells[0]):
            continue
        match = ID_CELL.match(cells[0])
        if not match or len(cells) < 3:
            unparsed.append(stripped[:120])
            continue
        type_ = match.group(1)
        attributes = {}
        if type_ == "US" and len(cells) >= 4 and header[3] == "Приоритет":
            attributes["priority"] = cells[3]
        rows.append(Row(
            id=cells[0], type=type_, number=int(match.group(2)), title=cells[1],
            text=cells[2] if type_ == "US" else "",
            attributes=attributes,
            basis=cells[-1] if type_ != "US" else "",
            line=line_no,
        ))
    return rows, unparsed


def plan_import(session: Session, key: str, text: str) -> Plan:
    """Только чтение: строит операции так, чтобы их применение дало ровно этот отчёт.

    display_id строится от ключа проекта (SHOP-FR-001), внешний ID документа (PTH-FR-001)
    сохраняется как external_key — по спеке §1.5 импортированный проект получает свой ключ.
    """
    domain.get_project(session, key)
    rows, unparsed = parse_spec(text)
    plan = Plan(unparsed=unparsed)
    display = {row.id: f"{key}-{row.type}-{row.number:03d}" for row in rows}
    known: dict[str, Artifact] = {}  # внешний ID -> уже существующий артефакт проекта

    for row in rows:
        artifact = session.scalar(select(Artifact).where(
            Artifact.project_key == key, Artifact.external_key == row.id))
        if artifact is None:
            plan.operations.append({"op": "create_artifact", "display_id": display[row.id],
                                    "external_key": row.id, "type": row.type, "number": row.number,
                                    "title": row.title, "text": row.text, "attributes": row.attributes})
            plan.created += 1
            plan.changes.append({"display_id": display[row.id], "action": "created"})
            continue
        known[row.id] = artifact
        current = domain.latest_revision(session, artifact)
        if (current.title, current.text, current.attributes) == (row.title, row.text, row.attributes):
            plan.unchanged += 1
            continue
        plan.operations.append({"op": "add_revision", "display_id": artifact.display_id, "title": row.title,
                                "text": row.text, "attributes": row.attributes})
        plan.revised += 1
        plan.changes.append({"display_id": artifact.display_id, "action": "revised"})

    for row in rows:
        plan.fragments.append({"display_id": display[row.id], "external_key": row.id, "line": row.line})

    planned: set[tuple[str, str]] = set()
    for row in rows:
        if row.type == "US" or not row.basis:
            continue
        if row.id in known:
            source_display, source_art = known[row.id].display_id, known[row.id]
        else:
            source_display, source_art = display[row.id], None
        for ref in dict.fromkeys(REF.findall(row.basis)):
            if ref in known:
                target_display, target_art = known[ref].display_id, known[ref]
            elif ref in display:
                target_display, target_art = display[ref], None
            else:
                target_art = session.scalar(select(Artifact).where(
                    Artifact.project_key == key, Artifact.external_key == ref))
                if target_art is None:
                    continue  # цели нет ни в файле, ни в проекте
                target_display = target_art.display_id
            pair = (source_display, target_display)
            if pair in planned:
                continue
            if source_art is not None and target_art is not None:
                already = session.scalar(select(Relation).where(
                    Relation.type == "refines", Relation.source_uid == source_art.uid,
                    Relation.target_uid == target_art.uid))
                if already is not None:
                    continue
            planned.add(pair)
            plan.operations.append({"op": "create_relation", "type": "refines",
                                    "source": source_display, "target": target_display})
            plan.relations_created += 1
    return plan


def execute_op(session: Session, key: str, op: dict) -> None:
    """Применяет одну операцию. Любая ошибка — DomainError; откат делает вызывающий."""
    kind = op.get("op")
    if kind == "create_artifact":
        number = op["number"]
        if session.scalar(select(Artifact).where(Artifact.project_key == key,
                                                 Artifact.display_id == op["display_id"])):
            raise domain.DomainError(409, "ARTIFACT_EXISTS", f"{op['display_id']} уже есть в проекте")
        artifact = Artifact(uid=new_uid(), project_key=key, type=op["type"], number=number,
                            display_id=op["display_id"], external_key=op.get("external_key", op["display_id"]),
                            created_at=utcnow())
        session.add(artifact)
        session.add(ArtifactRevision(uid=new_uid(), artifact_uid=artifact.uid, number=1,
                                     title=op["title"], text=op.get("text", ""),
                                     attributes=op.get("attributes", {}), exemption_reason=None,
                                     created_at=utcnow()))
        session.flush()
    elif kind == "add_revision":
        artifact = domain.get_artifact(session, key, op["display_id"])
        current = domain.latest_revision(session, artifact)
        expected = op.get("expected_revision")
        if expected is not None and expected != current.number:
            raise domain.DomainError(409, "REVISION_CONFLICT",
                                     f"{op['display_id']}: ожидалась ревизия {expected}, текущая {current.number}")
        session.add(ArtifactRevision(uid=new_uid(), artifact_uid=artifact.uid, number=current.number + 1,
                                     title=op["title"], text=op.get("text", ""),
                                     attributes=op.get("attributes", {}),
                                     exemption_reason=op.get("exemption_reason", current.exemption_reason),
                                     created_at=utcnow()))
        session.flush()
    elif kind == "create_relation":
        domain.create_relation(session, key, op["type"], op["source"], op["target"])
    elif kind == "delete_relation":
        from pth.models import Relation as RelationModel
        source = domain.get_artifact(session, key, op["source"])
        target = domain.get_artifact(session, key, op["target"])
        rel = session.scalar(select(RelationModel).where(
            RelationModel.type == op["type"], RelationModel.source_uid == source.uid,
            RelationModel.target_uid == target.uid))
        if rel is None:
            raise domain.DomainError(404, "RELATION_NOT_FOUND", f"Связи {op['type']} {op['source']}→{op['target']} нет")
        session.delete(rel)
        session.flush()
    else:
        raise domain.DomainError(422, "INVALID_OPERATION", f"Неизвестная операция: {kind!r}")


def apply_operations(session: Session, key: str, operations: list[dict]) -> None:
    for op in operations:
        execute_op(session, key, op)


def apply_import(session: Session, key: str, source_name: str, text: str,
                 dry_run: bool = False, as_changeset: bool = False) -> dict:
    """Возвращает отчёт. dry_run — откат; as_changeset — черновик без записи данных."""
    plan = plan_import(session, key, text)
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    counts = {"created": plan.created, "revised": plan.revised, "unchanged": plan.unchanged,
              "relations_created": plan.relations_created, "unparsed": plan.unparsed,
              "changes": plan.changes, "fragments": plan.fragments}
    report = {"uid": None, "changeset_uid": None, "source_name": source_name, "source_sha256": sha,
              "created_at": utcnow(), "dry_run": dry_run, **counts}

    if as_changeset:
        from pth.models import ChangeSet
        cs = ChangeSet(uid=new_uid(), project_key=key, title=f"Импорт {source_name}", state="draft",
                       operations=plan.operations, created_at=utcnow(),
                       source={"name": source_name, "sha256": sha, "text": text, "report": counts})
        session.add(cs)
        session.flush()
        report["changeset_uid"] = cs.uid
        return report

    apply_operations(session, key, plan.operations)
    if dry_run:
        session.rollback()
        return report
    record = ImportSession(uid=new_uid(), project_key=key, source_name=source_name, source_sha256=sha,
                           source_text=text, report=counts, created_at=report["created_at"])
    session.add(record)
    session.flush()
    report["uid"] = record.uid
    return report


def record_from_changeset(session: Session, key: str, source: dict) -> str:
    """Создаёт запись ImportSession при применении черновика из импорта."""
    record = ImportSession(uid=new_uid(), project_key=key, source_name=source["name"],
                           source_sha256=source["sha256"], source_text=source["text"],
                           report=source["report"], created_at=utcnow())
    session.add(record)
    session.flush()
    return record.uid


def report_of(record: ImportSession) -> dict:
    return {"uid": record.uid, "changeset_uid": None, "source_name": record.source_name, "dry_run": False,
            "source_sha256": record.source_sha256, "created_at": record.created_at, **record.report}
