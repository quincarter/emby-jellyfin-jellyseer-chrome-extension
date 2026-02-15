/**
 * Vite config to produce a self-contained ES module build of the content script
 * for E2E testing. The output is a single file with all dependencies inlined.
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist-e2e',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'content-script': resolve(__dirname, 'src/content-scripts/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
        inlineDynamicImports: true,
      },
    },
  },
});
