// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineCoreLinks } from '@northmes/contracts';

/**
 * The core module's link manifest (ADR 0062): at a plant, the dashboard at the plant root, the
 * plant's landing page with its open tab in `tab` (ADR 0078); the articles list, its new article
 * page, and each article's page with its edit page; the article groups, the new group page and each
 * group's page, which is its form; the customers and each customer's page; and in plant settings
 * the plant's own page, the people of the plant with Add role and each person's page with Add role for that person. Its settings section holds core's company
 * settings pages (ADR 0066): the users, the new user page, each user's page (its tab in `tab`) with
 * Add role; and the roles, the new role page (Start from in `from`), and each role's page (its tab
 * in `tab`) with its edit page (design core-304). Core's pages sit at the plant root and at the
 * company settings root, without the module id, so the articles list is /plant-a/articles and the
 * users /settings/<company id>/users (ADR 0074). The web's routes take their paths from it, and
 * other modules, server code and end-to-end specs build core's URLs with it.
 */
export const coreLinks = defineCoreLinks(
  {
    dashboard: { path: '' },
    articles: {
      path: 'articles',
      children: {
        new: { path: 'new' },
        article: { path: '$articleId', children: { edit: { path: 'edit' } } },
      },
    },
    articleGroups: {
      path: 'article-groups',
      children: {
        new: { path: 'new' },
        articleGroup: { path: '$articleGroupId' },
      },
    },
    /** The plant's own page in plant settings (design #767): name, slug, zone and production day start. */
    plant: { path: 'plant' },
    people: {
      path: 'people',
      children: {
        addRole: { path: 'roles/new' },
        person: { path: '$userId', children: { addRole: { path: 'roles/new' } } },
      },
    },
    /** The machines of the plant in plant settings (design #688): the list, each machine's page and its edit page. */
    machines: {
      path: 'machines',
      children: { machine: { path: '$equipmentId', children: { edit: { path: 'edit' } } } },
    },
    /** The plant's working-time calendars in plant settings (ADR 0025; design #688): the list and each calendar's page. */
    calendars: {
      path: 'calendars',
      children: { calendar: { path: '$calendarId' } },
    },
    /** The customers register under Master data (design #728): the list and each customer's page, by customer number. */
    customers: {
      path: 'customers',
      children: { customer: { path: '$customerId' } },
    },
  },
  {
    settings: {
      users: {
        path: 'users',
        children: {
          new: { path: 'new' },
          user: { path: '$userId', children: { addRole: { path: 'roles/new' } } },
        },
      },
      roles: {
        path: 'roles',
        children: {
          new: { path: 'new' },
          role: { path: '$roleId', children: { edit: { path: 'edit' } } },
        },
      },
    },
  },
);
