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

  it("#876 coreLinks' settings section builds the hrefs of the company's users, a user's access and Add role, and the roles and the role editor under the plant's settings", () => {
    const plant = 'plant-a';
    const userId = '01920000-0000-7000-8000-0000000b0001';
    const roleId = '01920000-0000-7000-8000-0000000c0001';
    const users = '/plant-a/settings/users';
    const roles = '/plant-a/settings/roles';

    expect(coreLinks.settings.users({ plant }).href).toBe(users);
    expect(coreLinks.settings.users.new({ plant }).href).toBe(`${users}/new`);
    expect(coreLinks.settings.users.user({ plant, userId }, { tab: 'access' }).href).toBe(
      `${users}/${userId}?tab=access`,
    );
    expect(coreLinks.settings.users.user.addRole({ plant, userId }).href).toBe(
      `${users}/${userId}/roles/new`,
    );
    expect(coreLinks.settings.roles({ plant }).href).toBe(roles);
    expect(coreLinks.settings.roles.new({ plant }, { from: roleId }).href).toBe(
      `${roles}/new?from=${roleId}`,
    );
    expect(coreLinks.settings.roles.role({ plant, roleId }, { tab: 'holders' }).href).toBe(
      `${roles}/${roleId}?tab=holders`,
    );
    expect(coreLinks.settings.roles.role.edit({ plant, roleId }).href).toBe(
      `${roles}/${roleId}/edit`,
    );
  });

  it("ADR0078 coreLinks builds the href of a plant's dashboard at the plant root, with its open tab", () => {
    expect(coreLinks.dashboard({ plant: 'plant-a' }).href).toBe('/plant-a');
    expect(coreLinks.dashboard({ plant: 'plant-a' }, { tab: 't1' }).href).toBe('/plant-a?tab=t1');
  });

  it("ADR0091 coreLinks has no People: a person's page is the user's page, and no plant pages for people, users or roles", () => {
    expect(coreLinks.settings).not.toHaveProperty('people');
    expect(coreLinks.settings.users.user.addRole({ plant: 'plant-a', userId: 'u1' }).href).toBe(
      '/plant-a/settings/users/u1/roles/new',
    );
    expect(coreLinks).not.toHaveProperty('people');
    expect(coreLinks).not.toHaveProperty('users');
    expect(coreLinks).not.toHaveProperty('roles');
  });

  it("#876 coreLinks builds the hrefs of the machines and the calendars of a plant under the plant's settings", () => {
    expect(coreLinks.settings.machines({ plant: 'plant-a' }, { group: 'MACH' }).href).toBe(
      '/plant-a/settings/machines?group=MACH',
    );
    expect(
      coreLinks.settings.machines.machine({ plant: 'plant-a', equipmentId: 'CNC1' }).href,
    ).toBe('/plant-a/settings/machines/CNC1');
    expect(
      coreLinks.settings.machines.machine.edit({ plant: 'plant-a', equipmentId: 'CNC1' }).href,
    ).toBe('/plant-a/settings/machines/CNC1/edit');
    expect(coreLinks.settings.calendars.calendar({ plant: 'plant-a', calendarId: 'A1' }).href).toBe(
      '/plant-a/settings/calendars/A1',
    );
  });

  it("#876 coreLinks builds the href of the plant page under the plant's settings", () => {
    expect(coreLinks.settings.plant({ plant: 'plant-a' }).href).toBe('/plant-a/settings/plant');
    expect(coreLinks.settings.plant({ plant: 'plant-a' }, { preview: 'noCalendar' }).href).toBe(
      '/plant-a/settings/plant?preview=noCalendar',
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

  it("#876 coreLinks builds the href of the company's warehouses under the plant's settings", () => {
    expect(coreLinks.settings.warehouses({ plant: 'plant-a' }).href).toBe(
      '/plant-a/settings/warehouses',
    );
  });

  it('#729 coreLinks builds the hrefs of the routings, a routing and the edit form of an operation', () => {
    expect(coreLinks.routings({ plant: 'plant-a' }).href).toBe('/plant-a/routings');
    expect(coreLinks.routings.routing({ plant: 'plant-a', articleNumber: '20-1001' }).href).toBe(
      '/plant-a/routings/20-1001',
    );
    expect(
      coreLinks.routings.routing.editOperation({
        plant: 'plant-a',
        articleNumber: '20-1001',
        sequence: '20',
      }).href,
    ).toBe('/plant-a/routings/20-1001/operations/20/edit');
  });

  it("#729 coreLinks builds the hrefs of the tools and a tool's page", () => {
    expect(coreLinks.tools({ plant: 'plant-a' }, { scope: 'plant' }).href).toBe(
      '/plant-a/tools?scope=plant',
    );
    expect(coreLinks.tools.tool({ plant: 'plant-a', toolCode: 'T-311' }).href).toBe(
      '/plant-a/tools/T-311',
    );
  });

  it("#876 coreLinks builds the hrefs of the equipment groups, a group's page and its edit form under the plant's settings", () => {
    expect(
      coreLinks.settings.equipmentGroups({ plant: 'plant-a' }, { scope: 'company' }).href,
    ).toBe('/plant-a/settings/equipment-groups?scope=company');
    expect(
      coreLinks.settings.equipmentGroups.group({ plant: 'plant-a', groupCode: 'MACH' }).href,
    ).toBe('/plant-a/settings/equipment-groups/MACH');
    expect(
      coreLinks.settings.equipmentGroups.group.edit({ plant: 'plant-a', groupCode: 'MACH' }).href,
    ).toBe('/plant-a/settings/equipment-groups/MACH/edit');
  });
});
