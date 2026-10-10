// SPDX-License-Identifier: AGPL-3.0-or-later

// The core module's screens. The routes import this file lazily, so the build puts the screens in
// one chunk of their own, which the browser loads when it first opens a core route.
export { AddRoleScreen } from './screens/add-role/index.ts';
export { ArticleScreen } from './screens/article/index.ts';
export { ArticlesScreen } from './screens/articles/index.ts';
export { EditArticleScreen } from './screens/edit-article/index.ts';
export { EditRoleScreen } from './screens/edit-role/index.ts';
export { NewArticleScreen } from './screens/new-article/index.ts';
export { NewRoleScreen } from './screens/new-role/index.ts';
export { NewUserScreen } from './screens/new-user/index.ts';
export { PeopleScreen } from './screens/people/index.ts';
export { PeopleAddRoleScreen } from './screens/people-add-role/index.ts';
export { PersonScreen } from './screens/person/index.ts';
export { PersonAddRoleScreen } from './screens/person-add-role/index.ts';
export { RoleScreen } from './screens/role/index.ts';
export { RolesScreen } from './screens/roles/index.ts';
export { UserScreen } from './screens/user/index.ts';
export { UsersScreen } from './screens/users/index.ts';
