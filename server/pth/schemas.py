"""Контракты API (Pydantic). Попадают в OpenAPI без отдельного описания."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ArtifactType = Literal["US", "FR", "NFR", "AC", "ADR", "COMMIT", "TEST"]
RelationType = Literal["refines", "motivates", "implements", "verifies"]
LostReason = Literal["no_code_link", "no_reflection"]
Direction = Literal["out", "in", "both"]


class ProjectIn(BaseModel):
    key: str = Field(pattern=r"^[A-Z][A-Z0-9]{1,9}$", examples=["PTH"])
    name: str = Field(min_length=1, max_length=200)


class ProjectOut(BaseModel):
    key: str
    name: str
    created_at: datetime


class ArtifactIn(BaseModel):
    type: ArtifactType
    title: str = Field(min_length=1, max_length=300)
    text: str = ""
    attributes: dict = Field(default_factory=dict, examples=[{"priority": "P0"}])
    exemption_reason: str | None = None


class RevisionIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    text: str = ""
    attributes: dict = Field(default_factory=dict)
    exemption_reason: str | None = None
    expected_revision: int | None = Field(
        default=None, description="Номер ревизии, на которую опирается правка; несовпадение даёт 409."
    )


class RevisionOut(BaseModel):
    number: int
    title: str
    text: str
    attributes: dict
    exemption_reason: str | None
    created_at: datetime


class ArtifactOut(BaseModel):
    display_id: str
    type: ArtifactType
    external_key: str | None
    revision: int
    title: str
    text: str
    attributes: dict
    exemption_reason: str | None
    created_at: datetime


class RelationIn(BaseModel):
    type: RelationType
    source: str = Field(description="display_id источника")
    target: str = Field(description="display_id цели")


class RelationOut(BaseModel):
    uid: str
    type: RelationType
    source: str
    target: str
    status: str


class CommitIn(BaseModel):
    sha: str = Field(pattern=r"^[0-9a-f]{7,40}$")
    title: str = Field(min_length=1, max_length=300)
    implements: list[str] = Field(default_factory=list, description="display_id требований, которые реализует коммит")


class ImportIn(BaseModel):
    source_name: str = Field(min_length=1, max_length=200, examples=["Project_Traceability_System_Spec_v0.1.md"])
    text: str = Field(min_length=1, max_length=10_000_000, description="Markdown принятой спецификации")


class ImportChange(BaseModel):
    display_id: str
    action: Literal["created", "revised"]


class ExtractIn(BaseModel):
    model: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=2_000_000)


class Proposal(BaseModel):
    type: Literal["US", "FR", "NFR", "AC"]
    title: str
    text: str
    quote: str
    quote_verified: bool
    model: str


class ExtractOut(BaseModel):
    model: str
    proposals: list[Proposal]
    skipped: int = Field(description="Элементов, которые не прошли проверку формата")


class ExtractionJobIn(BaseModel):
    model: str = Field(min_length=1, max_length=200)
    source_name: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=10_000_000)


class ExtractionJobOut(BaseModel):
    uid: str
    state: Literal["queued", "running", "succeeded", "failed"]
    model: str
    source_name: str
    chunks_total: int
    chunks_done: int
    proposals: list[Proposal]
    skipped: int
    errors: list[str]
    created_at: datetime
    finished_at: datetime | None


class ProposalsToChangeSetIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    proposals: list[Proposal] = Field(min_length=1, max_length=500)


class ChangeSetIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    operations: list[dict] = Field(min_length=1, max_length=1000)


class ChangeSetOut(BaseModel):
    uid: str
    title: str
    state: Literal["draft", "applied"]
    operations: list[dict]
    operation_count: int
    last_error: str | None
    created_at: datetime
    applied_at: datetime | None


class ImportReport(BaseModel):
    uid: str | None = Field(description="None для предпросмотра (dry_run) и черновика")
    changeset_uid: str | None = Field(default=None, description="Заполнено, если импорт создан как черновик")
    source_name: str
    source_sha256: str
    dry_run: bool
    created: int
    revised: int
    unchanged: int
    relations_created: int
    unparsed: list[str] = Field(description="Строки таблиц с ID, которые не удалось разобрать")
    changes: list[ImportChange] = Field(default_factory=list, description="Что создано или изменено")
    created_at: datetime


class ImportDetail(ImportReport):
    source_text: str


class LostItem(BaseModel):
    display_id: str
    type: ArtifactType
    title: str
    priority: str | None
    reasons: list[LostReason]
    last_commit: str | None
    recommended_action: str


class LostOut(BaseModel):
    total: int
    items: list[LostItem]
    excluded: list[str] = Field(description="Элементы с обоснованным исключением: не потеряны, а исключены")


class GraphNode(BaseModel):
    display_id: str
    type: ArtifactType
    title: str
    lost: bool
    reasons: list[LostReason]


class GraphEdge(BaseModel):
    type: RelationType
    source: str
    target: str


class GraphOut(BaseModel):
    focus: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    truncated: bool
