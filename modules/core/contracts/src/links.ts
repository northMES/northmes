// SPDX-License-Identifier: MIT
import { defineCoreLinks } from '@northmes/contracts';

/**
 * The core module's link manifest (ADR 0062): at a plant, the articles list, its new article page,
 * and each article's page with its edit page, and in plant settings the people of the plant with
 * Add role. Its settings section holds core's company settings pages (ADR 0066): the users, the new
 * user page, each user's page (its tab in `tab`) with Add role; and the roles, the new role page
 * (Start from in `from`), and each role's page (its tab in `tab`) with its edit page (design
 * core-304). Core's pages sit at the plant root and at the company settings root, without the
 * module id, so the articles list is /plant-a/articles and the users /settings/<company id>/users
 * (ADR 0074). The web's routes take their paths from it, and other modules, server code and
 * end-to-end specs build core's URLs with it.
 */
export const coreLinks = defineCoreLinks(
  {
    articles: {
      path: 'articles',
      children: {
        new: { path: 'new' },
        article: { path: '$articleId', children: { edit: { path: 'edit' } } },
      },
    },
    people: { path: 'people', children: { addRole: { path: 'roles/new' } } },
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
