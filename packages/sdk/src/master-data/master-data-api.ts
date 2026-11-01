// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject, type Type } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { MasterDataDefinition } from '@northmes/contracts';
import { commandInputArg } from '../commands/mutation-field.ts';
import { PlantFree } from '../graphql/plant-free.ts';
import type { Connection, ListArgs, ListKit } from '../lists/define-list.ts';
import { bindOperations, type OperationHandlers } from '../operations/bind-operations.ts';
import {
  type MasterDataRecord,
  type MasterDataService,
  type MasterDataServiceKit,
  named,
} from './master-data-service.ts';

/** The companyId argument of a plant-free field (ADR 0066). */
const companyIdArg = {
  type: () => ID,
  nullable: true,
  description:
    "The company of a request from company settings, which names no plant. At a plant it may be left out, or must be the plant's company.",
} as const;

export interface MasterDataApiOptions {
  /** The register's GraphQL object type, written by hand (ADR 0022). */
  readonly type: () => Type;
  /** The register's list, defineList of the definition's list with the type. */
  readonly list: ListKit<string>;
}

/**
 * The surfaces of a register (ADR 0022), for the module's api/: the GraphQL queries `<module><Entity>`
 * and `<module><Plural>` and the four mutations on the hand-written type, plant-free with companyId
 * (ADR 0066), and the binding of its operations (ADR 0073). Each calls one method of the service
 * that masterDataService built, and holds no logic of its own.
 *
 * @internal Until ADR 0022 settles whether plugins define registers.
 */
export function masterDataApi<const Definition extends MasterDataDefinition>(
  kit: MasterDataServiceKit<Definition>,
  { type, list }: MasterDataApiOptions,
): { readonly providers: Type[] } {
  type Row = MasterDataRecord<Definition>;
  const { definition, Service } = kit;
  const { module, entity, plural, label, pluralLabel, permission } = definition;
  const read = `${permission}:read`;
  const field = `${module}${entity}`;

  @Resolver(type)
  class QueryResolver {
    constructor(@Inject(Service) private readonly service: MasterDataService<Row>) {}

    @Query(type, {
      name: field,
      nullable: true,
      description: `The ${label} with this id among those the request reads, or null. Needs ${read}.`,
    })
    @PlantFree()
    one(
      @Args('id', { type: () => ID, description: `The ${label}'s id.` }) id: string,
      @Args('companyId', companyIdArg) companyId?: string | null,
    ): Promise<Row | null> {
      return this.service.byId(id, companyId ?? undefined);
    }

    @Query(() => list.Connection, {
      name: `${module}${plural}`,
      description: `One page of the ${pluralLabel} the request reads: at a plant the plant's and the company's, in company settings every one of the company. Needs ${read}.`,
    })
    @PlantFree()
    many(
      @Args({ type: () => list.Args }) args: ListArgs<string>,
      @Args('companyId', companyIdArg) companyId?: string | null,
    ): Promise<Connection<Row>> {
      return this.service.list(args, companyId ?? undefined);
    }
  }
  named(QueryResolver, `${entity}QueryResolver`);

  @Resolver(type)
  class MutationResolver {
    constructor(@Inject(Service) private readonly service: MasterDataService<Row>) {}

    @Mutation(type, {
      name: `${module}Create${entity}`,
      description: definition.create.description,
    })
    @PlantFree()
    create(@Args('input', commandInputArg(definition.create)) input: unknown): Promise<Row> {
      return this.service.create(input);
    }

    @Mutation(type, {
      name: `${module}Update${entity}`,
      description: definition.update.description,
    })
    @PlantFree()
    update(@Args('input', commandInputArg(definition.update)) input: unknown): Promise<Row> {
      return this.service.update(input);
    }

    @Mutation(type, {
      name: `${module}Archive${entity}`,
      description: definition.archive.description,
    })
    @PlantFree()
    archive(@Args('input', commandInputArg(definition.archive)) input: unknown): Promise<Row> {
      return this.service.archive(input);
    }

    @Mutation(type, {
      name: `${module}Restore${entity}`,
      description: definition.restore.description,
    })
    @PlantFree()
    restore(@Args('input', commandInputArg(definition.restore)) input: unknown): Promise<Row> {
      return this.service.restore(input);
    }
  }
  named(MutationResolver, `${entity}MutationResolver`);

  const handlers = {
    find: (input, context) => context.get(Service).find(input),
    get: (input, context) => context.get(Service).byIdOrThrow((input as { id: string }).id),
    create: (input, context) => context.get(Service).create(input),
    update: (input, context) => context.get(Service).update(input),
    archive: (input, context) => context.get(Service).archive(input),
    restore: (input, context) => context.get(Service).restore(input),
  } as OperationHandlers<Definition['operations']>;
  const Operations = bindOperations(definition.operations, handlers);

  return {
    providers: [QueryResolver, list.ConnectionResolver, MutationResolver, Operations] as Type[],
  };
}
