import type { Meta, StoryObj } from '@storybook/react-vite';
import { CreateProjectForm } from './CreateProjectForm';
import { ProjectSwitcher } from './ProjectSwitcher';

const projects = [
  { key: 'PTH', name: 'Project Traceability Hub', created_at: '2026-10-04T10:00:00Z' },
  { key: 'SHOP', name: 'Интернет-магазин', created_at: '2026-10-05T08:00:00Z' },
];

const switcherMeta = {
  title: 'PTH/Проекты/ProjectSwitcher',
  component: ProjectSwitcher,
  args: { projects, value: 'PTH', onChange: () => {}, onCreate: () => {} },
} satisfies Meta<typeof ProjectSwitcher>;
export default switcherMeta;
type SwitcherStory = StoryObj<typeof switcherMeta>;
export const Default: SwitcherStory = {};
export const NoProjectsYet: SwitcherStory = { args: { projects: [] } };

export const CreateForm: StoryObj<typeof CreateProjectForm> = {
  render: () => <CreateProjectForm onSubmit={() => {}} onCancel={() => {}} />,
};
export const CreateFailed: StoryObj<typeof CreateProjectForm> = {
  render: () => <CreateProjectForm error="Проект SHOP уже существует" onSubmit={() => {}} onCancel={() => {}} />,
};
