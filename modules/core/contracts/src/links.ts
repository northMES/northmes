// SPDX-License-Identifier: MIT
import { defineModuleLinks } from '@northmes/contracts';

/**
 * The core module's link manifest (ADR 0062): the articles list, its new article page, and each
 * article's page with its edit page. The web's routes take their paths from it, and other modules,
 * server code and end-to-end specs build core's URLs with it.
 */
export const coreLinks = defineModuleLinks('core', {
  articles: {
    path: 'articles',
    children: {
      new: { path: 'new' },
      article: { path: '$articleId', children: { edit: { path: 'edit' } } },
    },
  },
});
