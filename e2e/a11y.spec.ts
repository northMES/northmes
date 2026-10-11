import { expect, test } from './fixtures.ts';

// The axe check of ADR 0021 that every spec runs on the page states it reaches (#506).

test.describe('the accessibility check', () => {
  test('ADR0021 a page with a WCAG 2.2 AA violation fails the check and names the rule', async ({
    page,
    checkA11y,
  }) => {
    await page.setContent('<main><h1>Probe</h1><button type="button"></button></main>');

    await expect(checkA11y('a button without a name')).rejects.toThrow(/button-name/);
  });

  test('ADR0021 a page without violations passes the check', async ({ page, checkA11y }) => {
    await page.setContent(
      '<html lang="en"><head><title>Probe</title></head><body><main><h1>Probe</h1><button type="button">Save</button></main></body></html>',
    );

    await checkA11y('a named button');
  });
});
