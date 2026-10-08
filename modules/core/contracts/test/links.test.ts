// SPDX-License-Identifier: MIT
import { coreLinks } from '@northmes/core-contracts';
import { describe, expect, it } from 'vitest';

const ARTICLE_ID = '01920000-0000-7000-8000-0000000a0001';

describe('coreLinks', () => {
  it("E06-S06 coreLinks builds the hrefs of a plant's articles list, new article, article and edit pages", () => {
    const plant = 'plant-a';

    expect(coreLinks.articles({ plant }).href).toBe('/plant-a/core/articles');
    expect(coreLinks.articles({ plant }, { q: 'hinge', sort: '-name' }).href).toBe(
      '/plant-a/core/articles?q=hinge&sort=-name',
    );
    expect(coreLinks.articles.new({ plant }).href).toBe('/plant-a/core/articles/new');
    expect(coreLinks.articles.article({ plant, articleId: ARTICLE_ID }).href).toBe(
      `/plant-a/core/articles/${ARTICLE_ID}`,
    );
    expect(coreLinks.articles.article.edit({ plant, articleId: ARTICLE_ID }).href).toBe(
      `/plant-a/core/articles/${ARTICLE_ID}/edit`,
    );
  });
});
