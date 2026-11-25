import { defineConfig } from '@playwright/test';
/** Requires an already running disposable Compose stack. No API response mocking. */
export default defineConfig({
  testDir: './e2e-live',
  timeout: 90000,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results-live',
  use: { baseURL: process.env.STUDYBLOOM_URL || 'http://localhost:5173', viewport: { width: 1440, height: 1100 } },
});
