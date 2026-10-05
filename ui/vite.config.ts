/// <reference types="vitest/config" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(dirname, 'src'),
    },
  },
  server: {
    // Локальный FastAPI из server/ (python -m pth).
    proxy: { '/v1': 'http://127.0.0.1:8000' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
