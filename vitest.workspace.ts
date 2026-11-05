import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: { name: 'unit', include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'], environment: 'jsdom' },
  },
  {
    extends: './vitest.config.ts',
    test: { name: 'r-integration', include: ['tests/integration/**/*.test.ts'], environment: 'node', fileParallelism: false },
  },
]);
