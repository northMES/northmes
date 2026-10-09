// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { RoleServiceModule } from '../../core/role-service.module.ts';
import { RoleFieldResolver } from './fields/role.field.resolver.ts';
import { CreateRole } from './mutations/create-role.mutation.ts';
import { DeleteRole } from './mutations/delete-role.mutation.ts';
import { UpdateRole } from './mutations/update-role.mutation.ts';
import { RoleQueryResolver } from './queries/role.query.resolver.ts';

/** core's GraphQL surface for Role and the permission catalog, and the mutations of its commands. */
@Module({
  imports: [RoleServiceModule],
  providers: [RoleQueryResolver, RoleFieldResolver, CreateRole, UpdateRole, DeleteRole],
})
export class RoleModule {}
