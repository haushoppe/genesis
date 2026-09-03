import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.vitest.ts'],
    setupFiles: ['./src/vitest-setup.ts'],
    // ordpool-sdk ships per-file ESM with bundler-style (extensionless /
    // directory) imports. Vitest externalizes node_modules by default, which
    // would load it through Node's native ESM resolver — that rejects the
    // directory imports. Inline it so Vite bundles it, the same resolution the
    // Angular builder uses.
    server: {
      deps: {
        inline: [/ordpool-sdk/],
      },
    },
  },
});
