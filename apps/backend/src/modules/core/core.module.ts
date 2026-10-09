// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { AccessApiModule } from './api/access/access-api.module.ts';
import { ArticleModule } from './api/article/article.module.ts';
import { CompanyModule } from './api/company/company.module.ts';
import { RoleModule } from './api/role/role.module.ts';
import { RoleAssignmentModule } from './api/role-assignment/role-assignment.module.ts';

/**
 * The core module's Nest module, which AppModule imports: sign-in and the principal guard, and one
 * module per entity of its GraphQL surface (ADR 0070).
 */
@Module({
  imports: [AccessApiModule, ArticleModule, CompanyModule, RoleModule, RoleAssignmentModule],
})
export class CoreModule {}
