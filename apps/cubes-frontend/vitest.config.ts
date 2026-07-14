import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.vitest.ts'],
    setupFiles: ['./src/vitest-setup.ts'],
  },
});
