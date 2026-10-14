import { coreLinks } from '@northmes/core-contracts';
import type { Page, Request } from '@playwright/test';
import { expect, plant, test } from './fixtures.ts';

/** The GraphQL operation a request runs, such as `CoreDashboardTabs`. */
function operationOf(request: Request): string | undefined {
  if (request.method() !== 'POST' || !new URL(request.url()).pathname.endsWith('/graphql')) {
    return undefined;
  }
  return (request.postDataJSON() as { operationName?: string } | null)?.operationName;
}

type Tab = { name: string; widgets: unknown[] };

/**
 * Routes the answers to CoreDashboardTabs: `hold` keeps them back until release runs, so the page
 * stays in its loading state, `fail` answers with a server error, `change` passes the server's tabs
 * through a function, and `pass` leaves them alone.
 */
async function routeTabs(page: Page) {
  let mode: 'hold' | 'fail' | 'change' | 'pass' = 'pass';
  let change = (tabs: Tab[]) => tabs;
  let release = () => {};
  await page.route('**/graphql', async (route) => {
    if (operationOf(route.request()) !== 'CoreDashboardTabs' || mode === 'pass') {
      return route.continue();
    }
    if (mode === 'hold') {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return route.continue();
    }
    if (mode === 'fail') return route.fulfill({ status: 500, body: 'unavailable' });
    const response = await route.fetch();
    const body = (await response.json()) as { data?: { coreDashboardTabs?: Tab[] } };
    if (body.data?.coreDashboardTabs) {
      body.data.coreDashboardTabs = change(body.data.coreDashboardTabs);
    }
    await route.fulfill({ response, json: body });
  });
  return {
    hold: () => {
      mode = 'hold';
    },
    fail: () => {
      mode = 'fail';
    },
    change: (next: (tabs: Tab[]) => Tab[]) => {
      mode = 'change';
      change = next;
    },
    pass: () => {
      mode = 'pass';
      release();
    },
  };
}

test.describe('the dashboard', () => {
  test("ADR0078 the plant's landing page is the dashboard with the seeded tabs", async ({
    page,
    signIn,
  }) => {
    await signIn(coreLinks.dashboard({ plant }).href);

    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveText([
      'Company overview',
      'Shift overview',
      'My shift',
    ]);
    await page.getByRole('tab', { name: 'Shift overview' }).click();
    await expect(page).toHaveURL(/\?tab=/);
    await expect(page.getByRole('region', { name: 'Late orders' })).toBeVisible();
  });

  test('ADR0021 each state of the dashboard passes the WCAG 2.2 AA rules', async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const tabs = await routeTabs(page);
    tabs.hold();
    await signIn(coreLinks.dashboard({ plant }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await checkA11y('the dashboard while it loads', { busy: true });
    tabs.pass();

    await expect(page.getByRole('tab', { name: 'Company overview' })).toBeVisible();
    await checkA11y('the dashboard, Company overview');
    await page.getByRole('tab', { name: 'Shift overview' }).click();
    await expect(page.getByRole('region', { name: 'Stops this shift' })).toBeVisible();
    await checkA11y('the dashboard, Shift overview');

    tabs.change((all) => all.map((tab) => ({ ...tab, widgets: [] })));
    await page.reload();
    await expect(page.getByText('Shift overview has no widgets yet.')).toBeVisible();
    await checkA11y('a dashboard tab without widgets');

    tabs.change(() => []);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'No dashboard tabs yet' })).toBeVisible();
    await checkA11y('the dashboard of a plant without tabs');

    tabs.fail();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await checkA11y('the dashboard that could not be loaded');
    tabs.pass();

    await page.setViewportSize({ width: 320, height: 640 });
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Dashboard tab' })).toBeVisible();
    await checkA11y('the dashboard at 320 px');
  });
});
