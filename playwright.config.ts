// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineConfig, devices } from '@playwright/test';

// The end-to-end specs under e2e/ (ADR 0041). There is no webServer: Playwright starts it before
// globalSetup, so it could not reach the database that globalSetup starts. globalSetup runs the
// stack script into a seeded database, and each worker clones it and spawns the built server in
// role all (e2e/fixtures.ts). pnpm e2e builds first.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  forbidOnly: true,
  // One retry in CI, so a spec that fails on timing does not stop a session; the list reporter marks
  // a spec that passed on its retry as flaky, and the job keeps the report with the first attempt's
  // trace. Locally the first failure is the one to read (#974).
  retries: process.env.CI === 'true' ? 1 : 0,
  // Each worker runs its own server, so CI keeps to two of them.
  workers: process.env.CI === 'true' ? 2 : undefined,
  timeout: 60_000,
  // Argos takes the screenshots in every run and uploads them only from CI with ARGOS_TOKEN, which a
  // fork's pull request does not get (ADR 0077).
  reporter: [
    ['list'],
    ...(process.env.CI === 'true' ? [['html', { open: 'never' }] as const] : []),
    [
      '@argos-ci/playwright/reporter',
      {
        uploadToArgos: process.env.CI === 'true' && Boolean(process.env.ARGOS_TOKEN),
        // Argos is not a required check yet (ADR 0077), so a refused upload, for example over the
        // plan's screenshot quota, leaves the e2e result to the specs.
        ignoreUploadFailures: true,
      },
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
