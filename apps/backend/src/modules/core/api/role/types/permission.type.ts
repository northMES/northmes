// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ObjectType } from '@nestjs/graphql';

/** A permission of the catalog, which the installed modules declare (ADR 0010). */
@ObjectType('Permission', {
  description: 'A permission of the catalog, which the installed modules declare.',
})
export class Permission {
  @Field(() => String, {
    description: 'The key, <module>.<entity>:<action>, such as planning.productionOrder:release.',
  })
  key!: string;
  @Field(() => String, { description: 'The id of the module that declares the permission.' })
  moduleId!: string;
  @Field(() => String, { description: 'The key before the colon, <module>.<entity>.' })
  resource!: string;
  @Field(() => String, { description: 'The key after the colon.' }) action!: string;
  @Field(() => Boolean, {
    description: 'False for a permission no installed module declares any more; it grants nothing.',
  })
  installed!: boolean;
}

@ObjectType('PermissionResource', { description: 'The permissions of one resource.' })
export class PermissionResource {
  @Field(() => String, { description: 'The resource, <module>.<entity>.' }) resource!: string;
  @Field(() => [Permission], { description: 'The permissions of the resource.' })
  permissions!: Permission[];
}

@ObjectType('PermissionModule', { description: 'The permissions of one module, by resource.' })
export class PermissionModule {
  @Field(() => String, { description: "The module's id." }) moduleId!: string;
  @Field(() => [PermissionResource], { description: "The module's resources." })
  resources!: PermissionResource[];
}
