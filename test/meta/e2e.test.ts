import { afterEach, describe, expect, it, vi } from 'vitest';

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
  return argos?.[1] as { uploadToArgos?: boolean } | undefined;
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

    expect(local).toEqual({ uploadToArgos: false });
    expect(localWithToken).toEqual({ uploadToArgos: false });
    expect(forkPullRequest).toEqual({ uploadToArgos: false });
    expect(ci).toEqual({ uploadToArgos: true });
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
