// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { RoleServiceModule } from '../../core/role-service.module.ts';
import { RoleFieldResolver } from './fields/role.field.resolver.ts';
import { RoleQueryResolver } from './queries/role.query.resolver.ts';

/** core's GraphQL surface for Role and the permission catalog. */
@Module({
  imports: [RoleServiceModule],
  providers: [RoleQueryResolver, RoleFieldResolver],
})
export class RoleModule {}
