import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@dream-machine/compile': p('./packages/compile/src/index.ts'),
      '@dream-machine/ledger': p('./packages/ledger/src/index.ts'),
      '@dream-machine/witness': p('./packages/witness/src/index.ts'),
      '@dream-machine/schedule': p('./packages/schedule/src/index.ts'),
      '@dream-machine/memory': p('./packages/memory/src/index.ts'),
      '@dream-machine/edge-contracts': p('./packages/edge-contracts/src/index.ts'),
      '@dream-machine/edge-sim': p('./packages/edge-sim/src/index.ts'),
    },
  },
  test: {
    api: false,
    ui: false,
    include: ['packages/*/src/**/*.test.ts', 'packages/*/__tests__/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['packages/*/src/**/*.ts'], exclude: ['**/*.test.ts'] },
  },
});
