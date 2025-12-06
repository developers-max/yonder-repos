import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
  plugins: [tsconfigPaths()],
  // Prevent Vitest/Vite from loading the project's PostCSS config
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/auth.ts'],
    },
    env, // Make loaded env variables available to tests
  },
  };
});
