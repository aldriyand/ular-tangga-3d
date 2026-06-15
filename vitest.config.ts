import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest config: defaults are fine. We use the default environment
    // (node) for the pure-logic tests in /src. Anything that needs DOM
    // (like the UI module) is tested indirectly via the Game class.
    include: ['src/**/*.test.ts'],
    globals: false
  }
});
