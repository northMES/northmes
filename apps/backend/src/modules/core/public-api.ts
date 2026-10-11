// SPDX-License-Identifier: AGPL-3.0-or-later
// What other modules may import from core. The module boundary check refuses any other file.
export { Article } from './api/article/types/article.type.ts';
export {
  type ArticleRecord,
  ArticleService,
  requireArticleAssigned,
} from './core/article.service.ts';
export { ArticleServiceModule } from './core/article-service.module.ts';
