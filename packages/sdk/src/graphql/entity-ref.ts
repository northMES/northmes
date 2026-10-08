// SPDX-License-Identifier: MIT
import type { Type } from '@nestjs/common';
import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

/** The fields a module may read on another module's entity: its key. */
export interface EntityReference {
  readonly id: string;
}

/** The GraphQL helpers of one module, each bound to the module's subgraph. */
export interface GraphqlKit {
  /**
   * A key-only stub of an entity another module owns, registered in this module's subgraph. The
   * module names the type and never imports the owner's class; a field that returns the stub
   * resolves to { __typename, id }.
   */
  entityRef(typeName: string): Type<EntityReference>;
}

/**
 * Every stub entityRef created, with the module it belongs to. Nest leaves a type out of the
 * schema when no field returns it, so a stub that is only the parent of a contributed field needs
 * to reach the schema as an orphaned type.
 */
const stubs: { readonly type: Type<EntityReference>; readonly module: () => Type }[] = [];

/** The entityRef stubs that belong to `module`'s subgraph. */
export function entityStubsOf(module: Type): Type<EntityReference>[] {
  return stubs.filter((stub) => stub.module() === module).map((stub) => stub.type);
}

/** Binds the GraphQL helpers to the module whose subgraph they declare types in. */
export function graphqlKit(module: () => Type): GraphqlKit {
  return {
    entityRef(typeName) {
      // A class named after the type, so Nest's messages name the GraphQL type.
      const Stub = { [typeName]: class {} }[typeName] as Type<EntityReference>;
      Field(() => ID)(Stub.prototype, 'id');
      Directive('@key(fields: "id")')(Stub);
      ObjectType(typeName, { registerIn: module })(Stub);
      stubs.push({ type: Stub, module });
      return Stub;
    },
  };
}
