// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { RoleServiceModule } from '../../core/role-service.module.ts';
import { RoleAssignmentFieldResolver } from './fields/role-assignment.field.resolver.ts';

/** core's GraphQL surface for RoleAssignment. */
@Module({ imports: [RoleServiceModule], providers: [RoleAssignmentFieldResolver] })
export class RoleAssignmentModule {}
