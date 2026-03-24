// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.js'],
    globals: true
  }
});
