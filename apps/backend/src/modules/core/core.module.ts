// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { AccessApiModule } from './api/access/access-api.module.ts';
import { ArticleModule } from './api/article/article.module.ts';
import { ArticleGroupModule } from './api/article-group/article-group.module.ts';
import { CompanyModule } from './api/company/company.module.ts';
import { DashboardModule } from './api/dashboard/dashboard.module.ts';
import { IntegrationTokenModule } from './api/integration-token/integration-token.module.ts';
import { RoleModule } from './api/role/role.module.ts';
import { RoleAssignmentModule } from './api/role-assignment/role-assignment.module.ts';
import { UserModule } from './api/user/user.module.ts';
import { ViewerModule } from './api/viewer/viewer.module.ts';
import { AdministrationServiceModule } from './core/administration-service.module.ts';

/**
 * The core module's Nest module, which AppModule imports: sign-in and the principal guard, one
 * module per entity of its GraphQL surface (ADR 0070), and the service of the CLI's company and
 * admin commands.
 */
@Module({
  imports: [
    AccessApiModule,
    AdministrationServiceModule,
    ArticleModule,
    ArticleGroupModule,
    CompanyModule,
    DashboardModule,
    IntegrationTokenModule,
    RoleModule,
    RoleAssignmentModule,
    UserModule,
    ViewerModule,
  ],
})
export class CoreModule {}
