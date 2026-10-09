// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import {
  type PermissionModuleRecord,
  type RoleRecord,
  RoleService,
} from '../../../core/role.service.ts';
import { PermissionModule } from '../types/permission.type.ts';
import { Role } from '../types/role.type.ts';

/** core's queries on Role and the permission catalog. Each needs core.role:read at the plant. */
@Resolver(() => Role)
export class RoleQueryResolver {
  constructor(@Inject(RoleService) private readonly roles: RoleService) {}

  /**
   * The roles of the company of the request's plant: its custom roles, then the default roles of
   * the modules, each by name.
   */
  @Query(() => [Role])
  coreRoles(): Promise<RoleRecord[]> {
    return this.roles.roles();
  }

  /** The role with this id of the company of the request's plant, or null. */
  @Query(() => Role, { nullable: true })
  coreRole(@Args('id', { type: () => ID }) id: string): Promise<RoleRecord | null> {
    return this.roles.byId(id);
  }

  /**
   * Every permission of the catalog, installed or not, grouped by module, core first, and by
   * resource.
   */
  @Query(() => [PermissionModule])
  corePermissionCatalog(): Promise<PermissionModuleRecord[]> {
    return this.roles.catalog();
  }
}
