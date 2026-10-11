import { unitOf } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import type { Page, Request } from '@playwright/test';
import { expect, plant, test, uniqueCode } from './fixtures.ts';

/** The GraphQL operation a request runs, such as `CoreArticles`. */
function operationOf(request: Request): string | undefined {
  if (request.method() !== 'POST' || !new URL(request.url()).pathname.endsWith('/graphql')) {
    return undefined;
  }
  return (request.postDataJSON() as { operationName?: string } | null)?.operationName;
}

/**
 * Routes the answers to CoreArticles: `hold` keeps them back until release runs, so the list stays
 * in its loading state, `empty` gives the server's answer without its rows, as for a plant without
 * articles, and `pass` leaves them alone.
 */
async function routeArticles(page: Page) {
  let mode: 'hold' | 'empty' | 'pass' = 'pass';
  let release = () => {};
  await page.route('**/graphql', async (route) => {
    if (operationOf(route.request()) !== 'CoreArticles' || mode === 'pass') {
      return route.continue();
    }
    if (mode === 'hold') {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return route.continue();
    }
    const response = await route.fetch();
    const body = (await response.json()) as {
      data?: { coreArticles?: Record<string, unknown> };
    };
    if (body.data?.coreArticles) {
      body.data.coreArticles = { ...body.data.coreArticles, totalCount: 0, edges: [] };
    }
    await route.fulfill({ response, json: body });
  });
  return {
    hold: () => {
      mode = 'hold';
    },
    empty: () => {
      mode = 'empty';
    },
    pass: () => {
      mode = 'pass';
      release();
    },
  };
}

test.describe('articles', () => {
  test("E06-S06 the articles list shows the plant's seeded articles", async ({ page, signIn }) => {
    await signIn(coreLinks.articles({ plant }).href);

    await expect(page.getByRole('heading', { level: 1, name: 'Articles' })).toBeVisible();
    await page.getByLabel('Search articles').fill('BR-140');
    await expect(page.getByRole('row', { name: /BR-140.*Wall bracket/ })).toBeVisible();
  });

  test('E06-S06 a new article opens on its page and shows in the list', async ({
    page,
    signIn,
  }) => {
    const code = uniqueCode('NA');
    await signIn(coreLinks.articles({ plant }).href);

    await page.getByRole('link', { name: 'New article' }).click();
    await page.getByLabel('Article number').fill(code);
    await page.getByLabel('Name', { exact: true }).fill('Mounting plate');
    await page.getByLabel('Stock unit').selectOption({ label: unitOf('PIECE').label });
    await page.getByRole('button', { name: 'Save article' }).click();

    await expect(page.getByRole('heading', { level: 1, name: `Article ${code}` })).toBeVisible();
    await page.goto(coreLinks.articles({ plant }).href);
    await page.getByLabel('Search articles').fill(code);
    await expect(
      page.getByRole('row', { name: new RegExp(`${code}.*Mounting plate`) }),
    ).toBeVisible();
  });

  test("E06-S06 an edited name shows on the article's page", async ({ page, newArticle }) => {
    const article = await newArticle();

    await page.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Mounting plate, long');
    await page.getByRole('button', { name: 'Save article' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: `Article ${article.code}` }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Identity' })).toContainText(
      'Mounting plate, long',
    );
  });

  test('E06-S06 an archived article leaves the list and comes back after Restore', async ({
    page,
    newArticle,
    checkA11y,
  }) => {
    const article = await newArticle();

    await page.getByRole('button', { name: 'Archive' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive article' }).click();
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
    await page.goto(coreLinks.articles({ plant }).href);
    await page.getByLabel('Search articles').fill(article.code);
    await expect(page.getByText('No articles match')).toBeVisible();

    await page.goto(article.href);
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
    await checkA11y('an archived article');
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await checkA11y('the restore dialog');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restore article' }).click();
    await page.goto(coreLinks.articles({ plant }).href);
    await page.getByLabel('Search articles').fill(article.code);
    await expect(page.getByRole('row', { name: new RegExp(article.code) })).toBeVisible();
  });

  test('ADR0021 each state of the articles pages passes the WCAG 2.2 AA rules', async ({
    page,
    newArticle,
    checkA11y,
  }) => {
    const article = await newArticle();
    await checkA11y('the article page');

    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('button', { name: 'Save article' })).toBeVisible();
    await checkA11y('the edit form');

    await page.goto(coreLinks.articles.new({ plant }).href);
    await page.getByRole('button', { name: 'Save article' }).click();
    await expect(page.getByRole('group', { name: /to save the article/ })).toBeVisible();
    await checkA11y('the new article form with its error summary');

    await page.goto(coreLinks.articles({ plant }).href);
    await expect(page.getByRole('heading', { level: 1, name: 'Articles' })).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible();
    await checkA11y('the articles list');

    await page.getByLabel('Search articles').fill('NO-SUCH-ARTICLE');
    await expect(page.getByText('No articles match')).toBeVisible();
    await checkA11y('the articles list with no match');

    await page.goto(`${coreLinks.articles({ plant }).href}?group=stockUnit`);
    await expect(page.getByRole('button', { name: unitOf('PIECE').label })).toBeVisible();
    await checkA11y('the articles list grouped by stock unit');

    await page.goto(article.href);
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await checkA11y('the archive dialog');

    const articles = await routeArticles(page);
    articles.hold();
    await page.goto(coreLinks.articles({ plant }).href);
    await expect(page.locator('main [aria-busy="true"]').first()).toBeVisible();
    await checkA11y('the articles list while it loads');
    articles.pass();

    articles.empty();
    await page.goto(coreLinks.articles({ plant }).href);
    await expect(page.getByText('No articles yet')).toBeVisible();
    await checkA11y('the articles list of a plant without articles');
  });

  test("E06-S06 an article group picked on the form names the article's group", async ({
    page,
    signIn,
    checkA11y,
  }) => {
    const groupCode = uniqueCode('AG');
    const code = uniqueCode('GA');
    await signIn(coreLinks.articleGroups.new({ plant }).href);
    await expect(page.getByRole('button', { name: 'Save article group' })).toBeVisible();
    await checkA11y('the new article group form');
    await page.getByLabel('Code').fill(groupCode);
    await page.getByLabel('Name', { exact: true }).fill(`Brackets ${groupCode}`);
    await page.getByRole('button', { name: 'Save article group' }).click();
    await expect(
      page.getByRole('row', { name: new RegExp(`${groupCode}.*Brackets ${groupCode}`) }),
    ).toBeVisible();
    await checkA11y('the article groups list');

    await page.goto(coreLinks.articles.new({ plant }).href);
    await page.getByLabel('Article number').fill(code);
    await page.getByLabel('Name', { exact: true }).fill('Corner bracket');
    await page.getByLabel('Article group').selectOption({ label: `Brackets ${groupCode}` });
    await page.getByLabel('Stock unit').selectOption({ label: unitOf('PIECE').label });
    await page.getByRole('button', { name: 'Save article' }).click();

    await expect(page.getByRole('heading', { level: 1, name: `Article ${code}` })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Classification' })).toContainText(
      `Brackets ${groupCode}`,
    );
  });
});
