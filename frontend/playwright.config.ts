import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/corridors',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:4173', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
