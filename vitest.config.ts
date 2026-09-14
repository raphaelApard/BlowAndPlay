import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
