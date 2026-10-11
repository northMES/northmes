import { defineConfig, devices } from '@playwright/test';

// The end-to-end specs under e2e/ (ADR 0041). There is no webServer: Playwright starts it before
// globalSetup, so it could not reach the database that globalSetup starts. globalSetup runs the
// stack script into a seeded database, and each worker clones it and spawns the built server in
// role all (e2e/fixtures.ts). pnpm e2e builds first.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: true,
  retries: 0,
  // Each worker runs its own server, so CI keeps to two of them.
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  // Argos takes the screenshots in every run and uploads them only from CI with ARGOS_TOKEN, which a
  // fork's pull request does not get (ADR 0077).
  reporter: [
    ['list'],
    ...(process.env.CI ? [['html', { open: 'never' }] as const] : []),
    [
      '@argos-ci/playwright/reporter',
      { uploadToArgos: process.env.CI === 'true' && Boolean(process.env.ARGOS_TOKEN) },
    ],
  ],
  use: { trace: 'retain-on-failure' },
  // One browser setup, so the same commit gives the same screenshots (ADR 0077). Argos asks for the
  // two launch args to keep font rendering stable.
  projects: [
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        launchOptions: { args: ['--disable-lcd-text', '--font-render-hinting=none'] },
      },
    },
  ],
});
