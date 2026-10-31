// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The contracts of the core module (ADR 0012, ADR 0017, ADR 0062): plain data that the server, web
// forms, validators and plugins read without Nest or React.
export {
  archiveArticle,
  articleClassification,
  articleFields,
  articleGroupId,
  articleNote,
  articleSource,
  articleTranslations,
  createArticle,
  restoreArticle,
  setArticlePlants,
  updateArticle,
  upsertArticle,
} from './article.ts';
export {
  articleArchived,
  articleCreated,
  articleRestored,
  articleUpdated,
} from './article-events.ts';
export {
  archiveArticleGroup,
  articleGroupFields,
  createArticleGroup,
  restoreArticleGroup,
  updateArticleGroup,
} from './article-group.ts';
export {
  articleGroup,
  articleGroupList,
  findArticleGroups,
  getArticleGroup,
} from './article-group-queries.ts';
export { article, articleList, findArticles, getArticle } from './article-queries.ts';
export {
  type DashboardWidget,
  type DashboardWidgetSize,
  type DashboardWidgetType,
  dashboardColumns,
  dashboardLayout,
  dashboardMaxWidgets,
  dashboardSizesOf,
  dashboardSizeUnits,
  dashboardWidget,
  dashboardWidgetSizes,
  dashboardWidgetSlot,
  dashboardWidgetsOverlap,
  dashboardWidgetTypes,
  saveDashboardTab,
} from './dashboard.ts';
export { colorFrom, equipmentGroups } from './equipment-group.ts';
export {
  createIntegrationToken,
  integrationTokenDefaultDays,
  integrationTokenMaxDays,
  revokeIntegrationToken,
} from './integration-token.ts';
export { coreLinks } from './links.ts';
export { articleOperations } from './operations/article.ts';
export { articleGroupOperations } from './operations/article-group.ts';
export { plantSlug, reservedPlantSlugs } from './plant.ts';
export {
  accessReason,
  assignRole,
  createRole,
  deleteRole,
  permissionKey,
  removeRoleAssignment,
  settingsCompanyId,
  updateRole,
} from './role.ts';
export { blockUser, createUser, resetPassword, unblockUser, username } from './user.ts';
