// SPDX-License-Identifier: AGPL-3.0-or-later

export { ArticleScreen } from './article-screen.tsx';
// The core module's screens. The routes import this file lazily, so the build puts the screens in
// one chunk of their own, which the browser loads when it first opens a core route.
export { ArticlesScreen } from './articles-screen.tsx';
export { EditArticleScreen } from './edit-article-screen.tsx';
export { NewArticleScreen } from './new-article-screen.tsx';
