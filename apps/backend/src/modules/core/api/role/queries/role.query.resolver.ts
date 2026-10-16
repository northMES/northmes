// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
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

  @Query(() => [Role], {
    description:
      'The roles of the company: its custom roles, then the default roles of the modules, each by name. Needs core.role:read.',
  })
  @PlantFree()
  coreRoles(@Args('companyId', companyIdArg) companyId?: string | null): Promise<RoleRecord[]> {
    return this.roles.roles(companyId ?? undefined);
  }

  @Query(() => Role, {
    nullable: true,
    description: 'The role with this id of the company, or null. Needs core.role:read.',
  })
  @PlantFree()
  coreRole(
    @Args('id', { type: () => ID, description: "The role's id." }) id: string,
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<RoleRecord | null> {
    return this.roles.byId(id, companyId ?? undefined);
  }

  @Query(() => [PermissionModule], {
    description:
      'Every permission of the catalog, installed or not, grouped by module, core first, and by resource. Needs core.role:read.',
  })
  @PlantFree()
  corePermissionCatalog(
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<PermissionModuleRecord[]> {
    return this.roles.catalog(companyId ?? undefined);
  }
}
