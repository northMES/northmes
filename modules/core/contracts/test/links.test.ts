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

  it("E05-S06 coreLinks builds the hrefs of a plant's users, a user's access and Add role, and the roles and the role editor", () => {
    const plant = 'plant-a';
    const userId = '01920000-0000-7000-8000-0000000b0001';
    const roleId = '01920000-0000-7000-8000-0000000c0001';

    expect(coreLinks.users({ plant }).href).toBe('/plant-a/core/users');
    expect(coreLinks.users.new({ plant }).href).toBe('/plant-a/core/users/new');
    expect(coreLinks.users.user({ plant, userId }, { tab: 'access' }).href).toBe(
      `/plant-a/core/users/${userId}?tab=access`,
    );
    expect(coreLinks.users.user.addRole({ plant, userId }).href).toBe(
      `/plant-a/core/users/${userId}/roles/new`,
    );
    expect(coreLinks.roles({ plant }).href).toBe('/plant-a/core/roles');
    expect(coreLinks.roles.new({ plant }, { from: roleId }).href).toBe(
      `/plant-a/core/roles/new?from=${roleId}`,
    );
    expect(coreLinks.roles.role({ plant, roleId }, { tab: 'holders' }).href).toBe(
      `/plant-a/core/roles/${roleId}?tab=holders`,
    );
    expect(coreLinks.roles.role.edit({ plant, roleId }).href).toBe(
      `/plant-a/core/roles/${roleId}/edit`,
    );
  });
});
