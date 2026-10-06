import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoImportReport, demoJournal } from '@/features/pth/fixtures';
import { ImportJournal } from './ImportJournal';
import { ImportReportView } from './ImportReportView';

const meta = {
  title: 'PTH/Импорт/Отчёт и журнал',
  component: ImportReportView,
  args: { report: demoImportReport },
} satisfies Meta<typeof ImportReportView>;
export default meta;

export const ReportPreview: StoryObj<typeof ImportReportView> = {
  render: () => <ImportReportView report={demoImportReport} />,
};
export const ReportApplied: StoryObj<typeof ImportReportView> = {
  render: () => <ImportReportView report={{ ...demoImportReport, dry_run: false, uid: '6b1f0c2e-1111-4a3b-9c8d-000000000001', unparsed: [] }} />,
};

export const JournalList: StoryObj<typeof ImportJournal> = {
  render: () => <ImportJournal items={demoJournal} onOpen={() => {}} />,
};
export const JournalEmpty: StoryObj<typeof ImportJournal> = {
  render: () => <ImportJournal items={[]} onOpen={() => {}} />,
};
