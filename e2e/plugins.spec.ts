import { coreLinks } from '@northmes/core-contracts';
import { expect, plant, test } from './fixtures.ts';

// The server of this spec's worker loads the example plugin, which adds a sidebar group and a page
// that the shell loads at run time (ADR 0075).
test.use({ plugins: ['example-sidebar-page'] });

test("ADR 0075 a plugin adds its sidebar group, and its page runs on the shell's own React and router", async ({
  page,
  signIn,
  checkA11y,
}) => {
  await signIn(coreLinks.dashboard({ plant }).href);

  await page.getByRole('navigation').getByRole('link', { name: 'Hello' }).click();

  await expect(page).toHaveURL(`/${plant}/example-sidebar-page`);
  await expect(page.getByRole('heading', { level: 1, name: 'Hello from a plugin' })).toBeVisible();
  await expect(page.getByText(`loaded at run time for plant ${plant}`)).toBeVisible();
  await page.getByRole('button', { name: 'Say hello' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Hello' })).toHaveText('Hello once.');
  await checkA11y('plugin page');
});
