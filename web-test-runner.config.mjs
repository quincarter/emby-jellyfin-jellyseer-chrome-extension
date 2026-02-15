import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';

/** @type {import('@web/test-runner').TestRunnerConfig} */
export default {
  files: 'src/**/*.test.ts',
  nodeResolve: true,
  browsers: [playwrightLauncher({ product: 'chromium' })],
  plugins: [
    esbuildPlugin({
      ts: true,
      tsconfig: './tsconfig.json',
    }),
  ],
  testFramework: {
    config: {
      timeout: 5000,
    },
  },
};
