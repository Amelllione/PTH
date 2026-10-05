import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Proposal } from '@/entities/pth/types';
import { ExtractPanel } from './ExtractPanel';

const proposals: Proposal[] = [
  { type: 'FR', title: 'Выбор товаров', text: 'Пользователь выбирает товары', quote: 'Пользователь выбирает товары.', quote_verified: true, model: 'qwen-local' },
  { type: 'NFR', title: 'Скидка', text: 'Итог с учётом скидки', quote: 'придуманная фраза', quote_verified: false, model: 'qwen-local' },
];

const base = {
  models: ['qwen-local', 'llama-3-8b'],
  modelsLoading: false,
  modelsError: null,
  onRetryModels: () => {},
  onExtract: () => {},
  extracting: false,
  extractError: null,
  result: null,
  onCreateDraft: () => {},
  creating: false,
  onStartJob: () => {},
  job: null,
};

const meta = {
  title: 'PTH/Выделение/ExtractPanel',
  component: ExtractPanel,
  args: base,
} satisfies Meta<typeof ExtractPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const WithProposals: Story = { args: { result: { proposals, skipped: 1, model: 'qwen-local' } } };
export const LmStudioDown: Story = { args: { models: null, modelsError: 'LM Studio недоступен: ConnectError' } };
export const NoModels: Story = { args: { models: [] } };
