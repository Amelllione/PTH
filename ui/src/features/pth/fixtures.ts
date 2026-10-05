/** Демо-данные для Storybook и локальной разработки без сервера. Идентификаторы — как у сервера. */
import type { ArtifactDetail, GraphData, ImportReport, LostItem } from '@/entities/pth/types';

export const lostItems: LostItem[] = [
  {
    display_id: 'PTH-US-002',
    type: 'US',
    title: 'Импорт принятой спецификации',
    priority: 'P0',
    reasons: ['no_reflection'],
    last_commit: null,
    recommended_action: 'добавить ФТ с refines к этой US или ADR с motivates',
  },
  {
    display_id: 'PTH-FR-002',
    type: 'FR',
    title: 'Граф связей с фильтрами',
    priority: 'P1',
    reasons: ['no_code_link'],
    last_commit: null,
    recommended_action: 'связать с коммитом (implements) или указать обоснованное исключение',
  },
  {
    display_id: 'PTH-NFR-003',
    type: 'NFR',
    title: 'Поиск по сущностям p95 ≤ 500 мс',
    priority: 'P0',
    reasons: ['no_code_link'],
    last_commit: 'PTH-COMMIT-004',
    recommended_action: 'связать с коммитом (implements) или указать обоснованное исключение',
  },
];

export const demoGraph: GraphData = {
  focus: 'PTH-US-001',
  nodes: [
    { display_id: 'PTH-US-001', type: 'US', title: 'Трассировка требований', lost: false, reasons: [] },
    { display_id: 'PTH-FR-001', type: 'FR', title: 'Реестр сущностей с ID', lost: false, reasons: [] },
    { display_id: 'PTH-FR-002', type: 'FR', title: 'Граф связей с фильтрами', lost: true, reasons: ['no_code_link'] },
    { display_id: 'PTH-ADR-001', type: 'ADR', title: 'Сервис как источник истины', lost: false, reasons: [] },
    { display_id: 'PTH-COMMIT-001', type: 'COMMIT', title: 'feat: реестр сущностей', lost: false, reasons: [] },
    { display_id: 'PTH-US-002', type: 'US', title: 'Импорт принятой спецификации', lost: true, reasons: ['no_reflection'] },
  ],
  edges: [
    { type: 'refines', source: 'PTH-FR-001', target: 'PTH-US-001' },
    { type: 'refines', source: 'PTH-FR-002', target: 'PTH-US-001' },
    { type: 'motivates', source: 'PTH-US-001', target: 'PTH-ADR-001' },
    { type: 'implements', source: 'PTH-COMMIT-001', target: 'PTH-FR-001' },
    { type: 'refines', source: 'PTH-US-002', target: 'PTH-US-001' },
  ],
  truncated: false,
};

export const demoArtifact: ArtifactDetail = {
  display_id: 'PTH-FR-002',
  type: 'FR',
  external_key: null,
  revision: 3,
  title: 'Граф связей с фильтрами',
  text: 'Граф показывает локальное окружение выбранного артефакта. Фильтры: тип связи, направление, глубина.',
  attributes: { priority: 'P1', area: 'graph' },
  exemption_reason: null,
  created_at: '2026-10-04T10:00:00Z',
};

export const demoImportReport: ImportReport = {
  uid: null,
  changeset_uid: null,
  source_name: 'Project_Traceability_System_Spec_v0.1.md',
  source_sha256: '3f1a9c0b7e2d4a6f8b1c5d9e0a2f4b6c8d1e3f5a7b9c0d2e4f6a8b0c1d3e5f7a',
  dry_run: true,
  created: 2,
  revised: 1,
  unchanged: 196,
  relations_created: 3,
  unparsed: ['| PTH-FR-099 | битая строка без основания'],
  changes: [
    { display_id: 'PTH-US-057', action: 'created' },
    { display_id: 'PTH-FR-085', action: 'created' },
    { display_id: 'PTH-FR-010', action: 'revised' },
  ],
  created_at: '2026-10-05T09:00:00Z',
};

export const demoJournal: ImportReport[] = [
  { ...demoImportReport, changeset_uid: null, uid: '6b1f0c2e-1111-4a3b-9c8d-000000000001', dry_run: false, created: 196, revised: 0, unchanged: 0, changes: [] },
  { ...demoImportReport, uid: '6b1f0c2e-2222-4a3b-9c8d-000000000002', dry_run: false, created: 0, revised: 0, unchanged: 196, changes: [], unparsed: [] },
];
