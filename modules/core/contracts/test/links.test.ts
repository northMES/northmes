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

  it("E04-S02 coreLinks' settings section builds the hrefs of a company's users, a user's access and Add role, and the roles and the role editor", () => {
    const companyId = '01920000-0000-7000-8000-0000000ac3e0';
    const userId = '01920000-0000-7000-8000-0000000b0001';
    const roleId = '01920000-0000-7000-8000-0000000c0001';
    const users = `/settings/${companyId}/core/users`;
    const roles = `/settings/${companyId}/core/roles`;

    expect(coreLinks.settings.users({ companyId }).href).toBe(users);
    expect(coreLinks.settings.users.new({ companyId }).href).toBe(`${users}/new`);
    expect(coreLinks.settings.users.user({ companyId, userId }, { tab: 'access' }).href).toBe(
      `${users}/${userId}?tab=access`,
    );
    expect(coreLinks.settings.users.user.addRole({ companyId, userId }).href).toBe(
      `${users}/${userId}/roles/new`,
    );
    expect(coreLinks.settings.roles({ companyId }).href).toBe(roles);
    expect(coreLinks.settings.roles.new({ companyId }, { from: roleId }).href).toBe(
      `${roles}/new?from=${roleId}`,
    );
    expect(coreLinks.settings.roles.role({ companyId, roleId }, { tab: 'holders' }).href).toBe(
      `${roles}/${roleId}?tab=holders`,
    );
    expect(coreLinks.settings.roles.role.edit({ companyId, roleId }).href).toBe(
      `${roles}/${roleId}/edit`,
    );
  });

  it('E04-S02 coreLinks builds the hrefs of the people of a plant and their Add role, and has no plant users or roles', () => {
    expect(coreLinks.people({ plant: 'plant-a' }).href).toBe('/plant-a/core/people');
    expect(coreLinks.people.addRole({ plant: 'plant-a' }).href).toBe(
      '/plant-a/core/people/roles/new',
    );
    expect(Object.keys(coreLinks)).toEqual(['articles', 'people', 'settings']);
  });
});
