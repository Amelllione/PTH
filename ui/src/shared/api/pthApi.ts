import type {
  ArtifactDetail, ArtifactRow, BaselineDetail, BaselineRow, ChangeSet, CommitRow, ComplianceItem,
  EvidenceRow, GraphData, ImpactItem, ImportDetail, ImportMode, ImportReport, KeyRow, LostList,
  Me, Readiness, RelationRow, ReviewFinding, StatusSummary, ExtractResult, ExtractionJob,
  ProjectInfo, Proposal, RevisionItem, SourceView, AuditRow, BaselineCompare, CommitDetail,
} from '@/entities/pth/types';

/** Базовый адрес API. По умолчанию относительный: dev-сервер Vite проксирует /v1 на FastAPI. */
const BASE = import.meta.env.VITE_PTH_API_URL ?? '/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TOKEN_KEY = 'pth.token';

/** Токен живёт в sessionStorage вкладки: удобство одного пользователя, не данные системы. */
export function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // хранилище недоступно (приватный режим): токен действует до перезагрузки
  }
}

async function request<T>(path: string, init?: { method?: 'POST' | 'PUT' | 'PATCH'; body?: unknown }): Promise<T> {
  const token = readToken();
  const response = await fetch(`${BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? `HTTP_${response.status}`,
      body?.error?.message ?? response.statusText,
    );
  }
  return (await response.json()) as T;
}

const project = (key: string) => `/projects/${encodeURIComponent(key)}`;

/** Тонкий клиент: доменных правил здесь нет, они на сервере. */
const query = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]));
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

/** Текстовый ответ (ПСИ в markdown). */
async function requestText(path: string): Promise<string> {
  const token = readToken();
  const response = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError(response.status, `HTTP_${response.status}`, response.statusText);
  return response.text();
}

/** Страница списка: общее число берётся из заголовка X-Total-Count. */
async function requestPage<T>(path: string, params: Record<string, string | number | undefined>): Promise<{ items: T[]; total: number }> {
  const token = readToken();
  const response = await fetch(withQuery(`${BASE}${path}`, params), {
    headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(response.status, body?.error?.code ?? `HTTP_${response.status}`, body?.error?.message ?? response.statusText);
  }
  return { items: (await response.json()) as T[], total: Number(response.headers.get('X-Total-Count') ?? 0) };
}

const withQuery = (path: string, params: Record<string, string | number | boolean | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][];
  return entries.length ? `${path}?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : path;
};

export const pthApi = {
  me: () => request<Me>('/me'),
  testsStatus: (key: string) =>
    request<{
      head: string | null;
      counts: Record<string, number>;
      tests: { test: string; title: string; command: string | null; requirements: string[]; state: string; commit: string | null; result: string | null; ran_at: string | null }[];
      requirements_without_test: string[];
    }>(`${project(key)}/tests`),
  repo: (key: string) => request<{ connected: boolean; path?: string; head?: string | null; available?: boolean; note?: string }>(`${project(key)}/repo`),
  auditPage: (key: string, offset: number, limit: number) =>
    requestPage<AuditRow>(`${project(key)}/audit`, { offset, limit }),
  commitsPage: (key: string, offset: number, limit: number) =>
    requestPage<CommitRow>(`${project(key)}/commits`, { offset, limit }),
  evidencePage: (key: string, offset: number, limit: number) =>
    requestPage<EvidenceRow>(`${project(key)}/evidence`, { offset, limit }),
  changesetsPage: (key: string, offset: number, limit: number) =>
    requestPage<ChangeSet>(`${project(key)}/changesets`, { offset, limit }),
  importsPage: (key: string, offset: number, limit: number) =>
    requestPage<ImportReport>(`${project(key)}/imports`, { offset, limit }),
  lostPage: (key: string, offset: number, limit: number, type?: string, priority?: string, reason?: string) =>
    request<LostList>(withQuery(`${project(key)}/lost`, { offset, limit, type, priority, reason })),
  reviewPage: (key: string, offset: number, limit: number, severity?: string) =>
    request<{ counts: Record<string, number>; total: number; findings: ReviewFinding[] }>(
      withQuery(`${project(key)}/review`, { offset, limit, severity })),
  artifactsPage: async (key: string, offset: number, limit: number, type?: string) => {
    const token = readToken();
    const response = await fetch(withQuery(`${BASE}${project(key)}/artifacts`, { offset, limit, type }), {
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
    });
    if (!response.ok) throw new ApiError(response.status, `HTTP_${response.status}`, response.statusText);
    return { items: (await response.json()) as ArtifactRow[], total: Number(response.headers.get('X-Total-Count') ?? 0) };
  },
  decideReview: (key: string, body: { rule: string; display_id: string; state: 'resolved' | 'dismissed'; reason: string }) =>
    request<{ state: string }>(`${project(key)}/review/decisions`, { method: 'POST', body }),
  editChangeset: (key: string, uid: string, body: { title?: string; operations?: Record<string, unknown>[] }) =>
    request<ChangeSet>(`${project(key)}/changesets/${encodeURIComponent(uid)}`, { method: 'PUT', body }),
  source: (key: string, uid: string) => request<SourceView>(`${project(key)}/sources/${encodeURIComponent(uid)}`),
  audit: (key: string) => request<AuditRow[]>(`${project(key)}/audit`),
  renameProject: (key: string, name: string) =>
    request<ProjectInfo>(`${project(key)}`, { method: 'PATCH', body: { name } }),
  compareBaselines: (key: string, a: string, b: string) =>
    request<BaselineCompare>(withQuery(`${project(key)}/baselines/compare`, { a, b })),
  commit: (key: string, sha: string) => request<CommitDetail>(`${project(key)}/commits/${encodeURIComponent(sha)}`),
  status: (key: string) => request<StatusSummary>(`${project(key)}/status`),
  artifacts: (key: string, type?: string) => request<ArtifactRow[]>(withQuery(`${project(key)}/artifacts`, { type })),
  search: (key: string, q: string, type?: string) =>
    request<ArtifactRow[]>(withQuery(`${project(key)}/search`, { q, type })),
  relations: (key: string) => request<RelationRow[]>(`${project(key)}/relations`),
  review: (key: string) => request<{ counts: Record<string, number>; findings: ReviewFinding[] }>(`${project(key)}/review`),
  impact: (key: string, focus: string, depth: number) =>
    request<{ focus: string; items: ImpactItem[]; truncated: boolean; note: string }>(
      withQuery(`${project(key)}/impact`, { focus, depth }),
    ),
  compliance: (key: string) =>
    request<{ counts: Record<string, number>; items: ComplianceItem[] }>(`${project(key)}/compliance`),
  readiness: (key: string) => request<Readiness>(`${project(key)}/readiness`),
  psi: (key: string) => requestText(`${project(key)}/psi`),
  evidence: (key: string) => request<EvidenceRow[]>(`${project(key)}/evidence`),
  recordEvidence: (key: string, body: { test: string; result: string; commit_sha?: string }) =>
    request<EvidenceRow>(`${project(key)}/evidence`, { method: 'POST', body }),
  commits: (key: string) => request<CommitRow[]>(`${project(key)}/commits`),
  registerCommit: (key: string, body: { sha: string; title: string; implements: string[] }) =>
    request<CommitRow>(`${project(key)}/commits`, { method: 'POST', body }),
  baselines: (key: string) => request<BaselineRow[]>(`${project(key)}/baselines`),
  baselineDetail: (key: string, uid: string) => request<BaselineDetail>(`${project(key)}/baselines/${encodeURIComponent(uid)}`),
  createBaseline: (key: string, name: string) =>
    request<BaselineRow>(`${project(key)}/baselines`, { method: 'POST', body: { name } }),
  keys: () => request<KeyRow[]>('/keys'),
  createKey: (body: { name: string; kind: string; project_key?: string; role?: string }) =>
    request<{ token: string }>('/keys', { method: 'POST', body }),
  revokeKey: (uid: string) => request<{ uid: string; revoked: boolean }>(`/keys/${encodeURIComponent(uid)}/revoke`, { method: 'POST' }),

  projects: () => request<ProjectInfo[]>('/projects'),
  llmModels: () => request<string[]>('/llm/models'),
  extract: (key: string, model: string, text: string) =>
    request<ExtractResult>(`${project(key)}/extractions`, { method: 'POST', body: { model, text } }),
  startJob: (key: string, body: { model: string; source_name: string; text: string }) =>
    request<ExtractionJob>(`${project(key)}/extractions/jobs`, { method: 'POST', body }),
  job: (key: string, uid: string) =>
    request<ExtractionJob>(`${project(key)}/extractions/jobs/${encodeURIComponent(uid)}`),
  proposalsToChangeSet: (key: string, title: string, proposals: Proposal[]) =>
    request<ChangeSet>(`${project(key)}/extractions/changesets`, { method: 'POST', body: { title, proposals } }),
  createProject: (key: string, name: string) =>
    request<ProjectInfo>('/projects', { method: 'POST', body: { key, name } }),
  lost: (key: string, filters: { type?: string; priority?: string } = {}) =>
    request<LostList>(`${project(key)}/lost${query(filters)}`),
  revisions: (key: string, displayId: string) =>
    request<RevisionItem[]>(`${project(key)}/artifacts/${encodeURIComponent(displayId)}/revisions`),
  graph: (key: string, focus: string, depth = 2, relationTypes?: string[]) =>
    request<GraphData>(
      withQuery(`${project(key)}/graph`, {
        focus, depth, relation_types: relationTypes?.length ? relationTypes.join(',') : undefined,
      }),
    ),
  importSpec: (key: string, body: { source_name: string; text: string }, mode: ImportMode) =>
    request<ImportReport>(
      `${project(key)}/imports?dry_run=${mode === 'dry_run'}&as_changeset=${mode === 'changeset'}`,
      { method: 'POST', body },
    ),
  changesets: (key: string) => request<ChangeSet[]>(`${project(key)}/changesets`),
  applyChangeset: (key: string, uid: string) =>
    request<ChangeSet>(`${project(key)}/changesets/${encodeURIComponent(uid)}/apply`, { method: 'POST' }),
  imports: (key: string) => request<ImportReport[]>(`${project(key)}/imports`),
  importDetail: (key: string, uid: string) =>
    request<ImportDetail>(`${project(key)}/imports/${encodeURIComponent(uid)}`),
  artifact: (key: string, displayId: string) =>
    request<ArtifactDetail>(`${project(key)}/artifacts/${encodeURIComponent(displayId)}`),
};
