import { coreLinks } from '@northmes/core-contracts';
import { expect, plant, test } from './fixtures.ts';

// The server of this spec's worker loads the example plugin, which contributes a widget to the
// dashboard's catalog and adds no page (ADR 0068, ADR 0075).
test.use({ plugins: ['example-article-count'] });

test("ADR 0068 a plugin's widget joins the dashboard's catalog, and a placed one counts the plant's articles", async ({
  page,
  signIn,
  checkA11y,
}) => {
  await signIn(coreLinks.dashboard({ plant }).href);
  await page.getByRole('tab', { name: 'My shift' }).click();
  await page.getByRole('button', { name: 'Edit layout' }).click();
  await page.getByRole('button', { name: 'Add widget' }).click();

  const catalog = page.getByRole('dialog', { name: 'Add widget' });
  await expect(catalog.getByRole('heading', { name: 'Article count' })).toBeVisible();
  await catalog.getByRole('button', { name: 'Add Article count' }).click();
  const widget = page.getByRole('region', { name: 'Article count' });
  await expect(widget).toContainText(new RegExp(`\\d+\\s*articles? at ${plant}`));
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Edit layout' })).toBeFocused();

  await page.reload();
  await expect(widget).toContainText(new RegExp(`\\d+\\s*articles? at ${plant}`));
  // The plugin has no page, so its sidebar has no entry for it.
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Article count' }),
  ).toHaveCount(0);
  await checkA11y('a plugin widget on the dashboard');
});
