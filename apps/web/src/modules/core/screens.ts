// SPDX-License-Identifier: AGPL-3.0-or-later

// The core module's screens. The routes import this file lazily, so the build puts the screens in
// one chunk of their own, which the browser loads when it first opens a core route.
export { ArticleScreen } from './screens/article/index.ts';
export { ArticlesScreen } from './screens/articles/index.ts';
export { EditArticleScreen } from './screens/edit-article/index.ts';
export { NewArticleScreen } from './screens/new-article/index.ts';
