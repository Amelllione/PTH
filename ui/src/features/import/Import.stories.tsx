import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoImportReport, demoJournal } from '@/features/pth/fixtures';
import { ImportForm } from './ImportForm';
import { ImportJournal } from './ImportJournal';
import { ImportReportView } from './ImportReportView';

const formMeta = {
  title: 'PTH/Импорт/ImportForm',
  component: ImportForm,
  args: { onSubmit: () => {} },
} satisfies Meta<typeof ImportForm>;
export default formMeta;
type FormStory = StoryObj<typeof formMeta>;

export const Empty: FormStory = {};
export const Busy: FormStory = { args: { busy: true } };
export const Failed: FormStory = { args: { error: 'Сервер вернул 422: нет проекта' } };

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
