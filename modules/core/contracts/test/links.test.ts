// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { describe, expect, it } from 'vitest';

const ARTICLE_ID = '01920000-0000-7000-8000-0000000a0001';

describe('coreLinks', () => {
  it("E06-S06 coreLinks builds the hrefs of a plant's articles list, new article, article and edit pages", () => {
    const plant = 'plant-a';

    expect(coreLinks.articles({ plant }).href).toBe('/plant-a/articles');
    expect(coreLinks.articles({ plant }, { q: 'hinge', sort: '-name' }).href).toBe(
      '/plant-a/articles?q=hinge&sort=-name',
    );
    expect(coreLinks.articles.new({ plant }).href).toBe('/plant-a/articles/new');
    expect(coreLinks.articles.article({ plant, articleId: ARTICLE_ID }).href).toBe(
      `/plant-a/articles/${ARTICLE_ID}`,
    );
    expect(coreLinks.articles.article.edit({ plant, articleId: ARTICLE_ID }).href).toBe(
      `/plant-a/articles/${ARTICLE_ID}/edit`,
    );
  });

  it("E04-S02 coreLinks' settings section builds the hrefs of a company's users, a user's access and Add role, and the roles and the role editor", () => {
    const companyId = '01920000-0000-7000-8000-0000000ac3e0';
    const userId = '01920000-0000-7000-8000-0000000b0001';
    const roleId = '01920000-0000-7000-8000-0000000c0001';
    const users = `/settings/${companyId}/users`;
    const roles = `/settings/${companyId}/roles`;

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

  it("ADR0078 coreLinks builds the href of a plant's dashboard at the plant root, with its open tab", () => {
    expect(coreLinks.dashboard({ plant: 'plant-a' }).href).toBe('/plant-a');
    expect(coreLinks.dashboard({ plant: 'plant-a' }, { tab: 't1' }).href).toBe('/plant-a?tab=t1');
  });

  it('E04-S02 coreLinks builds the hrefs of the people of a plant and their Add role, and has no plant users or roles', () => {
    expect(coreLinks.people({ plant: 'plant-a' }).href).toBe('/plant-a/people');
    expect(coreLinks.people.addRole({ plant: 'plant-a' }).href).toBe('/plant-a/people/roles/new');
    expect(coreLinks.people.person.addRole({ plant: 'plant-a', userId: 'u1' }).href).toBe(
      '/plant-a/people/u1/roles/new',
    );
    expect(Object.keys(coreLinks)).toEqual([
      'dashboard',
      'articles',
      'articleGroups',
      'plant',
      'people',
      'machines',
      'calendars',
      'customers',
      'settings',
    ]);
  });

  it('E06 coreLinks builds the hrefs of the machines and the calendars of a plant at the plant root', () => {
    expect(coreLinks.machines({ plant: 'plant-a' }, { group: 'MACH' }).href).toBe(
      '/plant-a/machines?group=MACH',
    );
    expect(coreLinks.machines.machine({ plant: 'plant-a', equipmentId: 'CNC1' }).href).toBe(
      '/plant-a/machines/CNC1',
    );
    expect(coreLinks.machines.machine.edit({ plant: 'plant-a', equipmentId: 'CNC1' }).href).toBe(
      '/plant-a/machines/CNC1/edit',
    );
    expect(coreLinks.calendars.calendar({ plant: 'plant-a', calendarId: 'A1' }).href).toBe(
      '/plant-a/calendars/A1',
    );
  });

  it('#767 coreLinks builds the href of the plant page in plant settings at the plant root', () => {
    expect(coreLinks.plant({ plant: 'plant-a' }).href).toBe('/plant-a/plant');
    expect(coreLinks.plant({ plant: 'plant-a' }, { preview: 'noCalendar' }).href).toBe(
      '/plant-a/plant?preview=noCalendar',
    );
  });

  it('#728 coreLinks builds the hrefs of the customers register and a customer at the plant root', () => {
    expect(coreLinks.customers({ plant: 'plant-a' }, { late: '1' }).href).toBe(
      '/plant-a/customers?late=1',
    );
    expect(coreLinks.customers.customer({ plant: 'plant-a', customerId: 'K-1042' }).href).toBe(
      '/plant-a/customers/K-1042',
    );
  });
});
