// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import type { Locator } from '@playwright/test';
import { allPagesHref } from '../apps/web/src/shell/shell-pages.ts';
import { expect, plant, test } from './fixtures.ts';

// The design rules that only a browser's layout shows, read from computed style and the boxes it
// lays out (docs/agents/testing.md, Assert what the user sees or does): the D1 two-tone focus
// ring, the D2 menu item focus, the 24 px targets of WCAG 2.5.8, the sidebar without rules, the
// D1 block text of the Gantt and the board, the block outlines and the sticky parts of the Gantt.
// The unit tests keep the roles, names and states of the same controls.

/** The least width and height of a target, the value of --nm-target-min (WCAG 2.5.8). */
const targetMinPx = 24;

/** A transparent background, as computed style reports it. */
const transparent = 'rgba(0, 0, 0, 0)';

/** Pure black, as computed style reports the token oklch(0 0 0) or its sRGB value. */
const black = /^(rgb\(0, 0, 0\)|oklch\(0 0 0\))$/;

/** The computed values of these style properties of an element, by property. */
function styleOf(locator: Locator, properties: readonly string[]): Promise<Record<string, string>> {
  return locator.evaluate((element, names) => {
    const style = getComputedStyle(element);
    return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
  }, properties);
}

/**
 * The D1 two-tone focus ring of app.css on a focused control: the 2 px outline 2 px out in
 * --focus-outline, and the 2 px band in --focus-ring that touches the control.
 */
async function expectTwoToneRing(locator: Locator) {
  await expect(locator).toBeFocused();
  const style = await styleOf(locator, [
    'outline-style',
    'outline-width',
    'outline-offset',
    'box-shadow',
  ]);
  expect(style['outline-style']).toBe('solid');
  expect(style['outline-width']).toBe('2px');
  expect(style['outline-offset']).toBe('2px');
  expect(style['box-shadow']).toMatch(/\) 0px 0px 0px 2px$/);
}

/**
 * The D2 focus of a menu item: a 2 px outline inset 2 px, no band outside the item, and the
 * --accent fill.
 */
async function expectInsetMenuFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  await expect(locator).toHaveAttribute('role', /^menuitem/);
  const style = await styleOf(locator, [
    'outline-style',
    'outline-width',
    'outline-offset',
    'box-shadow',
    'background-color',
  ]);
  expect(style['outline-style']).toBe('solid');
  expect(style['outline-width']).toBe('2px');
  expect(style['outline-offset']).toBe('-2px');
  // No band: shadow-none computes to none, or to Tailwind's chain of transparent shadows.
  expect(style['box-shadow']).toMatch(/^(none|(rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, )?)+)$/);
  expect(style['background-color']).not.toBe(transparent);
}

/** Every link among these is a target at least targetMinPx wide and high. */
async function expectTargets(links: Locator) {
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index);
    const box = await link.boundingBox();
    const name = (await link.textContent()) ?? '';
    expect(box?.width ?? 0, name).toBeGreaterThanOrEqual(targetMinPx);
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(targetMinPx);
  }
}

/**
 * The rules drawn inside a sidebar's nav, Main: the separators, and the border widths of its
 * header, footer and nested lists, which D1 draws without a rule.
 */
function rulesIn(nav: Locator) {
  return nav.evaluate((element) => {
    const separators = element.querySelectorAll(
      '[role="separator"], [data-sidebar="separator"]',
    ).length;
    const borders = ['header', 'footer', 'menu-sub'].flatMap((part) =>
      [...element.querySelectorAll(`[data-sidebar="${part}"]`)].map((each) => {
        const style = getComputedStyle(each);
        return `${part} ${style.borderTopWidth} ${style.borderBottomWidth} ${style.borderLeftWidth} ${style.borderRightWidth}`;
      }),
    );
    return { separators, borders };
  });
}

/** The nav draws no rule: no separator, and its header, footer and nested lists have no border. */
async function expectNoRules(nav: Locator) {
  const rules = await rulesIn(nav);
  expect(rules.separators).toBe(0);
  expect(rules.borders.length).toBeGreaterThanOrEqual(2);
  for (const border of rules.borders) expect(border).toMatch(/ 0px 0px 0px 0px$/);
}

/** A planning page of the seed plant with its search. */
function planningHref(page: 'gantt' | 'board', search: Record<string, string>): string {
  return `${planningLinks[page]({ plant }).href}?${new URLSearchParams(search).toString()}`;
}

/** Puts the page in the D1 dark theme, as the theme switch does, or back in the light one. */
function setTheme(locator: Locator, theme: 'light' | 'dark') {
  return locator.evaluate((_, value) => {
    if (value === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }, theme);
}

test.describe('the design rules from computed style', () => {
  test('WCAG 2.5.8 every link of the plant list and of All pages is a target at least 24 px wide and high', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Your plants' })).toBeVisible();
    await expectTargets(page.getByRole('main').getByRole('link'));

    await page.goto(allPagesHref(plant));
    await expect(page.getByRole('heading', { level: 1, name: 'All pages' })).toBeVisible();
    await expectTargets(page.getByRole('main').getByRole('link'));
    await checkA11y('All pages');
  });

  test('D1 the sidebar marks the current entry and a closed group that holds it, shows the two-tone ring on a nested entry, and draws no rule, labelled, as the rail or as the sheet', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(coreLinks.articles({ plant }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Articles' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main' });
    const masterData = nav.getByRole('button', { name: 'Master data' });
    const articles = nav.getByRole('link', { name: 'Articles' });
    const articleGroups = nav.getByRole('link', { name: 'Article groups' });

    // The current entry alone is filled, in --sidebar-primary.
    await expect(articles).toHaveAttribute('aria-current', 'page');
    const current = await styleOf(articles, ['background-color']);
    const other = await styleOf(articleGroups, ['background-color']);
    expect(other['background-color']).toBe(transparent);
    expect(current['background-color']).not.toBe(transparent);

    // Keyboard focus on a nested entry draws the ring of app.css.
    await masterData.focus();
    await page.keyboard.press('Tab');
    await expectTwoToneRing(articles);

    // No rule between the groups, under the plant switcher, above the user button or along the
    // nested entries.
    expect((await rulesIn(nav)).borders).toContain('menu-sub 0px 0px 0px 0px');
    await expectNoRules(nav);

    // A closed group that holds the current page keeps aria-current and takes the --sidebar-accent
    // mark it had not while open.
    expect((await styleOf(masterData, ['background-color']))['background-color']).toBe(transparent);
    await masterData.click();
    await expect(masterData).toHaveAttribute('aria-expanded', 'false');
    await expect(masterData).toHaveAttribute('aria-current', 'true');
    expect((await styleOf(masterData, ['background-color']))['background-color']).not.toBe(
      transparent,
    );

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await expectNoRules(nav);
    await checkA11y('the articles list with the sidebar as the rail');

    await page.setViewportSize({ width: 320, height: 640 });
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const sheet = page.getByRole('dialog', { name: 'Navigation' });
    await expect(sheet).toBeVisible();
    await expectNoRules(sheet.getByRole('navigation', { name: 'Main' }));
    await checkA11y('the navigation sheet at 320 px');
  });

  test('D1 a checkbox shows the two-tone ring on keyboard focus', async ({ page, signIn }) => {
    await signIn(coreLinks.articleGroups({ plant }).href);
    const checkbox = page.getByRole('checkbox', { name: 'Show archived' });
    await expect(checkbox).toBeVisible();

    // Focus arrives by keyboard: back one stop, then forward onto the checkbox.
    await checkbox.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');

    await expectTwoToneRing(checkbox);
  });

  test('D2 a checkbox, radio and plain menu item show the inset focus outline on --accent, and a numeric column aligns its header and cells to the end', async ({
    page,
    signIn,
  }) => {
    await signIn(planningLinks.orders({ plant }).href);
    const table = page.getByRole('table', { name: 'Production orders' });
    await expect(table.locator('[data-order="1001"]')).toHaveCount(1);

    const headers = table.getByRole('columnheader');
    const names = await headers.allTextContents();
    const quantity = names.findIndex((name) => name.startsWith('Quantity'));
    expect(quantity).toBeGreaterThan(0);
    const quantityHeader = headers.nth(quantity);
    const quantityCell = table
      .locator('tr', { has: table.locator('[data-order="1001"]') })
      .locator('th, td')
      .nth(quantity);
    expect((await styleOf(quantityHeader, ['text-align']))['text-align']).toBe('end');
    expect((await styleOf(quantityCell, ['text-align']))['text-align']).toBe('end');

    const focused = page.locator(':focus');
    // The Article filter's menu holds checkbox items; the filter button, apart from the sort header.
    await page.locator('button[aria-haspopup="menu"]', { hasText: /^Article$/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(focused).toHaveAttribute('role', 'menuitemcheckbox');
    await expectInsetMenuFocus(focused);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // Group by holds radio items.
    await page.getByRole('button', { name: 'Group by' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(focused).toHaveAttribute('role', 'menuitemradio');
    await expectInsetMenuFocus(focused);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    // The user menu opens on its theme radio items; End reaches Sign out, a plain item.
    await page.getByRole('button', { name: /, account$/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(focused).toHaveAttribute('role', 'menuitemradio');
    await page.keyboard.press('End');
    await expect(focused).toHaveText('Sign out');
    await expect(focused).toHaveAttribute('role', 'menuitem');
    await expectInsetMenuFocus(focused);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('plan 18 the Gantt draws block text in pure black in both themes, the 3 px selection bar, the chain outline dashed and further in than the locked one, and keeps its header, its Not placed row and the Name column sticky', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    await signIn(planningHref('gantt', { zoom: 'week', from: '2026-11-02', order: 'po-1001' }));
    const gantt = page.getByRole('treegrid', { name: /order Gantt/ });
    await expect(gantt).toBeVisible();
    const block = (id: string) => gantt.locator(`[data-block="${id}"]`);

    // GT1: every block of the selected order carries the 3 px bar; the others their 1 px border.
    expect((await styleOf(block('jo-1001-10'), ['border-top-width']))['border-top-width']).toBe(
      '3px',
    );
    expect((await styleOf(block('jo-1001-20'), ['border-top-width']))['border-top-width']).toBe(
      '3px',
    );
    expect((await styleOf(block('jo-1003-10'), ['border-top-width']))['border-top-width']).toBe(
      '1px',
    );

    // D1: block text in pure black on the order color, in the light and the dark theme.
    expect((await styleOf(block('jo-1001-10'), ['color'])).color).toMatch(black);
    await setTheme(gantt, 'dark');
    expect((await styleOf(block('jo-1001-10'), ['color'])).color).toMatch(black);
    await checkA11y('the Gantt in the dark theme');
    await setTheme(gantt, 'light');

    // The time header, the Not placed row and the Name column stay in view while the grid scrolls.
    const header = gantt.getByRole('row').first();
    expect((await styleOf(header, ['position'])).position).toBe('sticky');
    expect(
      (await styleOf(gantt.getByRole('row', { name: /Not placed/ }), ['position'])).position,
    ).toBe('sticky');
    expect((await styleOf(header.getByRole('columnheader').first(), ['position'])).position).toBe(
      'sticky',
    );

    // WCAG 1.4.1: the chain outline is dashed and sits further in than the locked outline, so the
    // two differ in shape. The chain of 1003 holds 1003.10; 1002.10 is locked.
    await page.goto(
      planningHref('gantt', { zoom: 'week', from: '2026-11-02', order: 'po-1003', chain: '1' }),
    );
    const drawer = page.locator('[role="dialog"][data-details-drawer]');
    await expect(drawer).toBeVisible();
    // The modal drawer keeps the grid behind it out of the role query; its styles are computed still.
    const grid = page.locator('[role="treegrid"]');
    const outlines = await grid.evaluate((element) => {
      const outlineOf = (blockId: string, kind: string) => {
        const block = element.querySelector(`[data-block="${blockId}"]`);
        const outline = block?.parentElement?.querySelector(`[data-${kind}-outline]`);
        if (block == null || outline == null) return undefined;
        return {
          style: getComputedStyle(outline).borderTopStyle,
          inset: outline.getBoundingClientRect().left - block.getBoundingClientRect().left,
        };
      };
      return { chain: outlineOf('jo-1003-10', 'chain'), locked: outlineOf('jo-1002-10', 'locked') };
    });
    expect(outlines.chain?.style).toBe('dashed');
    expect(outlines.locked?.style).toBe('solid');
    expect(outlines.chain?.inset ?? 0).toBeGreaterThan(outlines.locked?.inset ?? 0);
  });

  test('plan 07 the board draws block text in pure black in both themes, and a group button is at least 24 px high', async ({
    page,
    signIn,
  }) => {
    await signIn(planningHref('board', { zoom: 'week', from: '2026-11-02' }));
    const board = page.getByRole('grid', { name: /board/ });
    await expect(board).toBeVisible();
    await expect(board).not.toHaveAttribute('aria-busy', 'true');
    const cell = board.locator('[role="gridcell"][data-job-order="1001.10"]');
    await expect(cell).toBeVisible();

    expect((await styleOf(cell, ['color'])).color).toMatch(black);
    await setTheme(board, 'dark');
    expect((await styleOf(cell, ['color'])).color).toMatch(black);
    await setTheme(board, 'light');

    const group = page.getByRole('button', { name: 'Collapse Machining' });
    const box = await group.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(targetMinPx);
  });
});
