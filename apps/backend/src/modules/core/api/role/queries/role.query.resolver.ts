// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { PlantFree } from '@northmes/sdk/graphql';
import {
  type PermissionModuleRecord,
  type RoleRecord,
  RoleService,
} from '../../../core/role.service.ts';
import { companyIdArg } from '../../company/inputs/company-id.arg.ts';
import { PermissionModule } from '../types/permission.type.ts';
import { Role } from '../types/role.type.ts';

/**
 * core's queries on Role and the permission catalog. Each needs core.role:read at the request's
 * plant, or in company settings at the company the request names (ADR 0066).
 */
@Resolver(() => Role)
export class RoleQueryResolver {
  constructor(@Inject(RoleService) private readonly roles: RoleService) {}

  /**
   * The roles of the company: its custom roles, then the default roles of the modules, each by
   * name.
   */
  @Query(() => [Role])
  @PlantFree()
  coreRoles(@Args('companyId', companyIdArg) companyId?: string | null): Promise<RoleRecord[]> {
    return this.roles.roles(companyId ?? undefined);
  }

  /** The role with this id of the company, or null. */
  @Query(() => Role, { nullable: true })
  @PlantFree()
  coreRole(
    @Args('id', { type: () => ID }) id: string,
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<RoleRecord | null> {
    return this.roles.byId(id, companyId ?? undefined);
  }

  /**
   * Every permission of the catalog, installed or not, grouped by module, core first, and by
   * resource.
   */
  @Query(() => [PermissionModule])
  @PlantFree()
  corePermissionCatalog(
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<PermissionModuleRecord[]> {
    return this.roles.catalog(companyId ?? undefined);
  }
}
