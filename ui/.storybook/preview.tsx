import type { Decorator, Preview } from '@storybook/react-vite';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import '../src/index.css';

/** Каждый компонент проверяется в обеих темах (переключатель в тулбаре). */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as 'light' | 'dark' | 'system';
  return (
    <ThemeProvider preference={theme}>
      <div className="min-h-full bg-canvas p-4 text-text">
        <Story />
      </div>
    </ThemeProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Тема интерфейса',
      defaultValue: 'light',
      toolbar: {
        title: 'Тема',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Светлая' },
          { value: 'dark', title: 'Тёмная' },
          { value: 'system', title: 'Как в системе' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'todo' },
  },
};

export default preview;
