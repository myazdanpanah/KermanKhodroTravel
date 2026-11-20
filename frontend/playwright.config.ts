import { defineConfig } from '@playwright/test';
import path from 'path';

const FRONTEND_PORT = 3100;
const BACKEND_PORT = 8010;
const REPO_ROOT = path.resolve(process.cwd(), '..');
const PYTHON = path.join(
  REPO_ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);

/**
 * Browser E2E configuration for the Office module.
 *
 * The backend fixture command is idempotent and limited to its own company,
 * so the run starts from a clean letter sequence without touching other data.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    // Windows runners use the installed Edge; elsewhere use Playwright Chromium
    // (override with PW_BROWSER_CHANNEL when needed).
    channel: process.env.PW_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `"${PYTHON}" manage.py seed_office_e2e && "${PYTHON}" manage.py runserver 127.0.0.1:${BACKEND_PORT} --noreload`,
      cwd: path.join(REPO_ROOT, 'backend'),
      url: `http://127.0.0.1:${BACKEND_PORT}/api/v1/office/meta/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT} --strictPort`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      env: { VITE_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
