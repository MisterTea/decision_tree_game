import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    testTimeout: 20000,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      thresholds: { perFile: true, statements: 81, branches: 81, functions: 81, lines: 81 },
    },
  },
});
