// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ObjectType } from '@nestjs/graphql';

/** A permission of the catalog, which the installed modules declare (ADR 0010). */
@ObjectType('Permission')
export class Permission {
  /** `<module>.<entity>:<action>`, such as planning.productionOrder:release. */
  @Field(() => String) key!: string;
  @Field(() => String) moduleId!: string;
  /** `<module>.<entity>`, the key before the colon. */
  @Field(() => String) resource!: string;
  /** The key after the colon. */
  @Field(() => String) action!: string;
  /** False for a permission no installed module declares any more; it grants nothing. */
  @Field(() => Boolean) installed!: boolean;
}

/** The permissions of one resource. */
@ObjectType('PermissionResource')
export class PermissionResource {
  @Field(() => String) resource!: string;
  @Field(() => [Permission]) permissions!: Permission[];
}

/** The permissions of one module, by resource. */
@ObjectType('PermissionModule')
export class PermissionModule {
  @Field(() => String) moduleId!: string;
  @Field(() => [PermissionResource]) resources!: PermissionResource[];
}
