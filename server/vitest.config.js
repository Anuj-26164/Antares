import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Include all test files across controllers, routes, middleware, sockets, utils, and new tests/
    include: [
      'controllers/**/*.test.js',
      'routes/**/*.test.js',
      'middleware/**/*.test.js',
      'sockets/**/*.test.js',
      'utils/**/*.test.js',
      'tests/**/*.test.js',
    ],
    environment: 'node',
    globals: false,
    // Run tests sequentially to avoid mock conflicts between integration tests
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['controllers/**', 'routes/**', 'middleware/**', 'sockets/**', 'utils/**'],
      exclude: ['**/*.test.js', 'node_modules/**'],
    },
    reporters: ['verbose'],
  },
  // Prevent Vite's define plugin from statically replacing process.env.NODE_ENV
  // in test files, which causes oxc transform errors when the value is referenced
  // in imported modules (e.g., errorHandler.js).
  define: {
    'process.env.NODE_ENV': 'process.env.NODE_ENV',
  },
});
