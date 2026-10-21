import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  ...base,
  testDir: './e2e-deployment',
  use: { ...base.use, baseURL },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
