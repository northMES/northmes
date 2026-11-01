// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { getCSPScriptHash } from '@argos-ci/playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allowArgos } from '../../e2e/snapshot.ts';

// The Playwright config of the e2e specs (docs/adr/0077-visual-regression-snapshots-with-argos-from-the-playwright-specs.md):
// the Argos reporter runs in every run, and uploads only in CI with ARGOS_TOKEN set, so a local run
// and a fork's pull request take the screenshots and upload nothing. The specs run in one browser
// setup, so the same commit gives the same pixels.

const argosReporter = '@argos-ci/playwright/reporter';

/** playwright.config.ts, read with the given environment. */
async function playwrightConfig(env: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  const { default: config } = await import('../../playwright.config.ts');
  return config;
}

/** The Argos reporter's options in playwright.config.ts, read with the given environment. */
async function argosOptions(env: Record<string, string | undefined>) {
  const config = await playwrightConfig(env);
  const reporters = Array.isArray(config.reporter) ? config.reporter : [];
  const argos = reporters.find(([name]) => name === argosReporter);
  return argos?.[1] as { uploadToArgos?: boolean; ignoreUploadFailures?: boolean } | undefined;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('playwright.config.ts', () => {
  it('ADR0077 playwright.config.ts uploads to Argos only in CI', async () => {
    const local = await argosOptions({ CI: undefined, ARGOS_TOKEN: undefined });
    const localWithToken = await argosOptions({ CI: 'false', ARGOS_TOKEN: 'argos-test-token' });
    const forkPullRequest = await argosOptions({ CI: 'true', ARGOS_TOKEN: undefined });
    const ci = await argosOptions({ CI: 'true', ARGOS_TOKEN: 'argos-test-token' });

    expect(local).toMatchObject({ uploadToArgos: false });
    expect(localWithToken).toMatchObject({ uploadToArgos: false });
    expect(forkPullRequest).toMatchObject({ uploadToArgos: false });
    expect(ci).toMatchObject({ uploadToArgos: true });
  });

  // Argos is not a required check yet (ADR 0077 makes it one after two stable weeks), so a refused
  // upload, such as a plan's screenshot quota, must not fail the e2e job once the specs pass.
  it('ADR0077 a failed Argos upload does not fail the e2e run', async () => {
    const ci = await argosOptions({ CI: 'true', ARGOS_TOKEN: 'argos-test-token' });

    expect(ci?.ignoreUploadFailures).toBe(true);
  });

  // A spec that fails on timing (axe reading colors mid-transition, a locator that settles late)
  // costs a re-run and a person without a retry (#974). Locally the first failure is the one to
  // read, so the retry is for CI only, read as the Argos upload reads it: CI set to true, not to
  // any value.
  it('ADR0041 the specs retry once in CI and not locally', async () => {
    const ci = await playwrightConfig({ CI: 'true' });
    const local = await playwrightConfig({ CI: undefined });
    const localWithCiFalse = await playwrightConfig({ CI: 'false' });

    expect(ci.retries).toBe(1);
    expect(local.retries).toBe(0);
    expect(localWithCiFalse.retries).toBe(0);
  });

  // One reading of CI for the retry, the worker count and the html report, so a runner that sets
  // CI to another value gets all three or none.
  it('ADR0041 the retry, the worker count and the html report read CI the same way', async () => {
    const ci = await playwrightConfig({ CI: 'true' });
    const other = await playwrightConfig({ CI: '1' });
    const reporters = (config: Awaited<ReturnType<typeof playwrightConfig>>) =>
      (Array.isArray(config.reporter) ? config.reporter : []).map(([name]) => name);

    expect([ci.retries, ci.workers, reporters(ci).includes('html')]).toEqual([1, 2, true]);
    expect([other.retries, other.workers, reporters(other).includes('html')]).toEqual([
      0,
      undefined,
      false,
    ]);
  });

  it('ADR0077 the e2e project pins the viewport, locale, time zone, color scheme and font rendering', async () => {
    const config = await playwrightConfig();

    expect(config.projects?.map((project) => project.use)).toEqual([
      expect.objectContaining({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
        launchOptions: { args: ['--disable-lcd-text', '--font-render-hinting=none'] },
      }),
    ]);
  });
});

describe('e2e/snapshot.ts', () => {
  it("ADR0077 the specs' pages allow Argos's script by its hash and inline styles, and block any other inline script", () => {
    const shell = "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'";

    expect(allowArgos(shell)).toBe(
      `default-src 'self'; script-src 'self' ${getCSPScriptHash()}; style-src 'self' 'unsafe-inline'; object-src 'none'`,
    );
  });
});
