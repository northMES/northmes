import { unitOf } from '@northmes/contracts';
import { coreLinks } from '@northmes/core-contracts';
import { expect, plant, test, uniqueCode } from './fixtures.ts';

// Core's articles pages in the browser, against the built server in role all with the stack's
// seed: the dev admin, the seed's Company admin, signs in and works at plant A (E06-S06). Each
// test makes its own records with codes no other test uses, since the tests of a worker share its
// database.

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
  }) => {
    const article = await newArticle();

    await page.getByRole('button', { name: 'Archive' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive article' }).click();
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
    await page.goto(coreLinks.articles({ plant }).href);
    await page.getByLabel('Search articles').fill(article.code);
    await expect(page.getByText('No articles match')).toBeVisible();

    await page.goto(article.href);
    await page.getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restore article' }).click();
    await page.goto(coreLinks.articles({ plant }).href);
    await page.getByLabel('Search articles').fill(article.code);
    await expect(page.getByRole('row', { name: new RegExp(article.code) })).toBeVisible();
  });

  test("E06-S06 an article group picked on the form names the article's group", async ({
    page,
    signIn,
  }) => {
    const groupCode = uniqueCode('AG');
    const code = uniqueCode('GA');
    await signIn(coreLinks.articleGroups.new({ plant }).href);
    await page.getByLabel('Code').fill(groupCode);
    await page.getByLabel('Name', { exact: true }).fill(`Brackets ${groupCode}`);
    await page.getByRole('button', { name: 'Save article group' }).click();
    await expect(
      page.getByRole('row', { name: new RegExp(`${groupCode}.*Brackets ${groupCode}`) }),
    ).toBeVisible();

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
