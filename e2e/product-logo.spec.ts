// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Page } from '@playwright/test';
import { signInPath } from '../apps/web/src/auth/sign-in-link.ts';
import { expect, test } from './fixtures.ts';

/** The two themes the logo draws in, each with the colour of the name in the file it shows. */
const themes = [
  { colorScheme: 'light', nameFill: '#1f2022' },
  { colorScheme: 'dark', nameFill: '#ececec' },
] as const;

/**
 * Expects the banner's NorthMES logo, 32 px tall, with one of its two files drawn on screen, and
 * returns that file's SVG text: decoded when the build inlined it as a data URL, else fetched from
 * the server.
 */
async function shownLogoSvg(page: Page): Promise<string> {
  const logo = page.getByRole('banner').getByRole('img', { name: 'NorthMES' });
  await expect(logo).toBeVisible();
  const shown = logo.locator('img:visible');
  await expect(shown).toHaveCount(1);
  expect(await shown.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  expect((await shown.boundingBox())?.height).toBe(32);
  const src = (await shown.getAttribute('src')) ?? '';
  const inline = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(src);
  if (inline === null) {
    const response = await page.request.get(src);
    expect(response.status()).toBe(200);
    return response.text();
  }
  const [, base64, data = ''] = inline;
  return base64 === undefined ? decodeURIComponent(data) : Buffer.from(data, 'base64').toString();
}

test.describe('the NorthMES logo', () => {
  for (const { colorScheme, nameFill } of themes) {
    test(`E04-S02 the sign-in page and Your plants show the logo in the banner in the ${colorScheme} theme`, async ({
      page,
      signIn,
      checkA11y,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(signInPath);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Sign in to NorthMES' }),
      ).toBeVisible();
      expect(await shownLogoSvg(page)).toMatch(new RegExp(`fill=["']${nameFill}["']`));
      await checkA11y(`the sign-in page in the ${colorScheme} theme`);

      await signIn('/');
      await expect(page.getByRole('heading', { level: 1, name: 'Your plants' })).toBeVisible();
      expect(await shownLogoSvg(page)).toMatch(new RegExp(`fill=["']${nameFill}["']`));
      await checkA11y(`Your plants in the ${colorScheme} theme`);
    });
  }

  test('E04-S02 the page names the dark NorthMES icon as its favicon, and the server serves it from /assets/ as an SVG', async ({
    page,
  }) => {
    await page.goto(signInPath);
    const href = (await page.locator('link[rel="icon"]').getAttribute('href')) ?? '';
    expect(href).toMatch(/^\/assets\/favicon-[\w-]+\.svg$/);
    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\/svg\+xml/);
    expect(await response.text()).toContain('fill="#1f2022"');
  });
});
