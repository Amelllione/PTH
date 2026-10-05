/** Типы ответов API PTH. Соответствуют server/openapi.json (схемы LostOut, GraphOut, ArtifactOut). */

export type ArtifactType = 'US' | 'FR' | 'NFR' | 'AC' | 'ADR' | 'COMMIT';
export type RelationType = 'refines' | 'motivates' | 'implements';
export type LostReason = 'no_code_link' | 'no_reflection';

export interface LostItem {
  display_id: string;
  type: ArtifactType;
  title: string;
  priority: string | null;
  reasons: LostReason[];
  last_commit: string | null;
  recommended_action: string;
}

export interface LostList {
  total: number;
  items: LostItem[];
  /** Элементы с обоснованным исключением: не потеряны, а исключены. */
  excluded: string[];
}

export interface RevisionItem {
  number: number;
  title: string;
  text: string;
  attributes: Record<string, unknown>;
  exemption_reason: string | null;
  created_at: string;
}

export interface GraphNode {
  display_id: string;
  type: ArtifactType;
  title: string;
  lost: boolean;
  reasons: LostReason[];
}

export interface GraphEdge {
  type: RelationType;
  source: string;
  target: string;
}

export interface GraphData {
  focus: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
}

export interface ArtifactDetail {
  display_id: string;
  type: ArtifactType;
  external_key: string | null;
  revision: number;
  title: string;
  text: string;
  attributes: Record<string, unknown>;
  exemption_reason: string | null;
  created_at: string;
}

export interface ImportChange {
  display_id: string;
  action: 'created' | 'revised';
}

export interface ImportReport {
  uid: string | null;
  changeset_uid: string | null;
  source_name: string;
  source_sha256: string;
  dry_run: boolean;
  created: number;
  revised: number;
  unchanged: number;
  relations_created: number;
  unparsed: string[];
  changes: ImportChange[];
  created_at: string;
}

export type ImportMode = 'dry_run' | 'changeset' | 'apply';

export interface Proposal {
  type: 'US' | 'FR' | 'NFR' | 'AC';
  title: string;
  text: string;
  quote: string;
  quote_verified: boolean;
  model: string;
}

export interface ExtractResult {
  model: string;
  proposals: Proposal[];
  skipped: number;
}

export interface ExtractionJob {
  uid: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  model: string;
  source_name: string;
  chunks_total: number;
  chunks_done: number;
  proposals: Proposal[];
  skipped: number;
  errors: string[];
  created_at: string;
  finished_at: string | null;
}

export interface ProjectInfo {
  key: string;
  name: string;
  created_at: string;
}

export interface ChangeSet {
  uid: string;
  title: string;
  state: 'draft' | 'applied';
  operations: Record<string, unknown>[];
  operation_count: number;
  last_error: string | null;
  created_at: string;
  applied_at: string | null;
}

export interface ImportDetail extends ImportReport {
  source_text: string;
}

export const REASON_LABEL: Record<LostReason, string> = {
  no_code_link: 'Нет связи с кодом (implements)',
  no_reflection: 'User story без ФТ или ADR',
};

export interface StatusSummary {
  artifacts: Record<string, number>;
  lost: number;
  excluded: number;
  draft_changesets: number;
  imports: number;
  relations: number;
}

export interface ReviewFinding {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  display_id: string;
  message: string;
  state: 'open' | 'resolved' | 'dismissed' | 'reopened';
  decision: { state: string; reason: string; actor: string; revision: number } | null;
}

export interface ImpactItem {
  display_id: string;
  type: ArtifactType;
  depth: number;
  path: string[];
  rule_id: string;
  certainty: 'explicit' | 'candidate';
  action: string;
}

export interface ComplianceItem {
  display_id: string;
  status: 'verified' | 'failed' | 'stale' | 'not_verified' | 'no_test' | 'excluded';
  tests: { display_id: string; status: string }[];
}

export interface Readiness {
  verdict: 'ready' | 'not_ready' | 'insufficient_data';
  total: number;
  blocking: { display_id: string; status: string }[];
  counts: Record<string, number>;
}

export interface EvidenceRow {
  uid: string;
  test: string | null;
  result: 'pass' | 'fail' | 'blocked' | 'inconclusive';
  commit_sha: string | null;
  environment: Record<string, unknown>;
  created_at: string;
}

export interface CommitRow {
  display_id: string;
  sha: string | null;
  title: string;
  implements: string[];
  created_at: string;
}

export interface BaselineRow {
  uid: string;
  name: string;
  created_at: string;
  artifacts: number;
}

export interface BaselineDetail {
  uid: string;
  name: string;
  created_at: string;
  artifacts: Record<string, number>;
  relations: [string, string, string][];
}

export interface KeyRow {
  uid: string;
  name: string;
  kind: string;
  project_key: string | null;
  role: string | null;
  revoked: boolean;
  created_at: string;
}

export interface Me {
  name: string;
  kind: string;
  project_key: string | null;
  role: string | null;
}

export interface ArtifactRow {
  display_id: string;
  type: ArtifactType;
  external_key: string | null;
  revision: number;
  title: string;
  text: string;
  attributes: Record<string, unknown>;
  exemption_reason: string | null;
  created_at: string;
}

export interface RelationRow {
  uid: string;
  type: RelationType;
  source: string;
  target: string;
  status: string;
}

export interface SourceLine {
  no: number;
  text: string;
  display_id: string | null;
}

export interface SourceView {
  source_name: string;
  source_sha256: string;
  lines: SourceLine[];
  fragments: number;
}

export interface AuditRow {
  actor: string;
  action: string;
  target: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface BaselineCompare {
  a: string;
  b: string;
  added: string[];
  removed: string[];
  changed: string[];
  relations_added: string[][];
  relations_removed: string[][];
}

export interface CommitDetail extends CommitRow {
  evidence: EvidenceRow[];
  reachability: string;
}
