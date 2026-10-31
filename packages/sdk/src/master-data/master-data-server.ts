// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import {
  HttpStatus,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  type Type,
} from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { MasterDataDefinition, MasterDataScope, Translation } from '@northmes/contracts';
import { type Selectable, type SelectQueryBuilder, sql, type Transaction } from 'kysely';
import type { z } from 'zod';
import { COMMAND_BUS, type CommandBus, type HandlerContext } from '../commands/command-bus.ts';
import { registerCommand } from '../commands/define-command.ts';
import { commandInputArg } from '../commands/mutation-field.ts';
import { parseCommandInput } from '../commands/parse-input.ts';
import { DATABASE, type ScopedDatabase } from '../data/database.ts';
import { DomainError } from '../errors/domain-error.ts';
import { PlantFree } from '../graphql/plant-free.ts';
import { type Connection, defineList, type ListArgs, type ListPage } from '../lists/define-list.ts';
import { bindOperations, type OperationHandlers } from '../operations/bind-operations.ts';
import { noteCreated } from '../operations/outcome.ts';
import type { MasterDataAccess, MasterDataRequestScope } from './access.ts';
import type { MasterDataColumns } from './table.ts';

/** The register tables as the kit queries them, by name: the kit's columns and any own column. */
type RegisterDb = Record<string, MasterDataColumns & Record<string, unknown>>;

/** A register's row as its service hands it out, the decoded side of its output schema. */
export type MasterDataRecord<Definition extends MasterDataDefinition> = z.output<
  Definition['node']
>;

/** The names of a register's own output fields: those its definition adds to the kit's. */
type OwnOutput<Definition extends MasterDataDefinition> = Exclude<
  keyof MasterDataRecord<Definition>,
  'id' | 'code' | 'name' | 'translations' | 'version' | 'archivedAt' | 'updatedAt' | 'scope'
> &
  string;

/** The locked row a command on an existing register row acts on. */
export type MasterDataRow = Selectable<MasterDataColumns> & Record<string, unknown>;

/** What a register's own write hooks get besides the parsed input. */
export interface MasterDataCreateContext {
  readonly tx: Transaction<unknown>;
  readonly companyId: string;
  /** The scope node the row is written at: the company's or the request's plant's. */
  readonly scopeId: string;
}

export interface MasterDataServerOptions<
  Definition extends MasterDataDefinition,
  Scope extends MasterDataRequestScope,
> {
  /** The register's table, schema-qualified, such as core.equipment_group. */
  readonly table: string;
  /** The register's GraphQL object type, written by hand (ADR 0022). */
  readonly type: () => Type;
  readonly access: MasterDataAccess<Scope>;
  /** The column behind each own output field, such as colorFrom: color_from. */
  readonly columns: { readonly [Field in OwnOutput<Definition>]: string };
  /** The values of the register's own columns that a create and an update write. */
  readonly write: {
    create(
      input: z.output<Definition['create']['input']>,
      context: MasterDataCreateContext,
    ): Promise<Record<string, unknown>> | Record<string, unknown>;
    update(
      input: z.output<Definition['update']['input']>,
      target: MasterDataRow,
    ): Record<string, unknown>;
  };
}

/** A register's service, which every surface calls (ADR 0073). */
export interface MasterDataService<Record> {
  /** The row with this id among those the request reads, or null. */
  byId(id: string, companyId?: string): Promise<Record | null>;
  /**
   * The rows with these ids in one query, one entry per id in their order, or null where the
   * request reads none. It checks no permission, because a field of another entity reads through it.
   */
  byIds(ids: readonly string[]): Promise<(Record | null)[]>;
  /** The row with this id, as byId reads it, or core.not_found. */
  byIdOrThrow(id: string): Promise<Record>;
  /** One page of the rows the request reads, as the list field's arguments ask. */
  list(args: ListArgs<string>, companyId?: string): Promise<Connection<Record>>;
  /** One page of the rows the request reads, as the find operation asks. */
  find(input: unknown): Promise<ListPage<Record>>;
  create(input: unknown): Promise<Record>;
  update(input: unknown): Promise<Record>;
  archive(input: unknown): Promise<Record>;
  restore(input: unknown): Promise<Record>;
}

/** The companyId argument of a plant-free field (ADR 0066). */
const companyIdArg = {
  type: () => ID,
  nullable: true,
  description:
    "The company of a request from company settings, which names no plant. At a plant it may be left out, or must be the plant's company.",
} as const;

/** The label with a capital first letter, for the start of a message. */
function capitalized(label: string): string {
  return `${label[0]?.toUpperCase()}${label.slice(1)}`;
}

/** Names a class for Nest's messages. */
function named<Class extends Type>(Class: Class, name: string): Class {
  Object.defineProperty(Class, 'name', { value: name });
  return Class;
}

/**
 * The server side of a register (ADR 0022): its four commands with their target, a service whose
 * reads go through the ScopedDatabase and whose writes go through the command bus (ADR 0012), its
 * list, the GraphQL queries and mutations on the hand-written type, and the binding of its
 * operations (ADR 0073). A row sits at the company's node or at the request's plant; a read at a
 * plant sees the plant's rows and the company's, and one in company settings every row of the
 * company. The table is one that pnpm gen:migration --register wrote.
 */
export function masterDataServer<
  const Definition extends MasterDataDefinition,
  Scope extends MasterDataRequestScope,
>(definition: Definition, options: MasterDataServerOptions<Definition, Scope>) {
  type Record = MasterDataRecord<Definition>;
  const { module, entity, label, permission } = definition;
  const { table, access } = options;
  const atCompany = definition.scopes.includes('company' as never);
  const Label = capitalized(label);

  /** The rows of the table as the service hands them out, which row-level security limits. */
  function select(tx: Transaction<RegisterDb>) {
    return tx
      .selectFrom(table)
      .select([
        'id',
        'code',
        'name',
        'translations',
        'version',
        'archived_at as archivedAt',
        'updated_at as updatedAt',
        ...(atCompany
          ? [
              sql<MasterDataScope>`case when scope_id = company_id then 'company' else 'plant' end`.as(
                'scope',
              ),
            ]
          : []),
        ...Object.entries<string>(options.columns).map(([field, column]) =>
          sql.ref(column).as(field),
        ),
      ]) as unknown as SelectQueryBuilder<RegisterDb, string, Record & { readonly id: string }>;
  }

  /** The rows that `scope` reads: the plant's and the company's, or in settings the company's. */
  function ofRequest(scope: MasterDataRequestScope) {
    return (tx: Transaction<RegisterDb>) =>
      scope.plantId
        ? select(tx).where('scope_id', 'in', [scope.plantId, scope.companyId])
        : select(tx).where('company_id', '=', scope.companyId);
  }

  /** The one row with this id, after a command changed it. */
  function selectOne(tx: Transaction<unknown>, id: string): Promise<Record> {
    return select(tx as Transaction<RegisterDb>)
      .where('id', '=', id)
      .executeTakeFirstOrThrow() as Promise<Record>;
  }

  /** The node a create writes at: the company's, or the request's plant's (ADR 0007). */
  async function scopeOfCreate(
    input: unknown,
    context: Pick<HandlerContext, 'tx' | 'plantId'>,
  ): Promise<string | undefined> {
    const companyId = await access.requestCompany(input, context);
    if (!companyId) return undefined;
    const level = (input as { readonly scope?: MasterDataScope }).scope ?? 'plant';
    return level === 'company' ? companyId : context.plantId;
  }

  const target = {
    entity,
    scopeOf: async (id: string, { tx }: Pick<HandlerContext, 'tx'>) =>
      (
        await (tx as Transaction<RegisterDb>)
          .selectFrom(table)
          .select('scope_id')
          .where('id', '=', id)
          .executeTakeFirst()
      )?.scope_id,
    load: (id: string, { tx }: Pick<HandlerContext, 'tx'>): Promise<MasterDataRow | undefined> =>
      (tx as Transaction<RegisterDb>)
        .selectFrom(table)
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst() as Promise<MasterDataRow | undefined>,
  };

  /** Refuses a change to an archived row with core.archived. */
  function refuseArchived(row: MasterDataRow): void {
    if (row.archived_at === null) return;
    throw new DomainError({
      code: 'core.archived',
      status: HttpStatus.PRECONDITION_FAILED,
      message: `${Label} ${row.code} is archived, and an archived ${label} cannot be changed until it is restored`,
    });
  }

  // The kit's fields of a parsed input, which every register's contracts carry.
  type KitInput = {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly translations?: readonly Translation[];
  };
  type CreateInput = z.output<Definition['create']['input']> & KitInput;
  type UpdateInput = z.output<Definition['update']['input']> & KitInput;
  type ExistingInput = { readonly id: string };

  const CreateCommand = registerCommand(definition.create, {
    scope: scopeOfCreate,
    async handle(input: CreateInput, context: HandlerContext): Promise<Record> {
      const tx = context.tx as Transaction<RegisterDb>;
      const scopeId = await scopeOfCreate(input, context);
      const companyId = await access.requestCompany(input, context);
      // The scope hook found no scope, so the bus refused the command before the handler runs.
      if (!scopeId || !companyId) throw new NotFoundException(`${Label} ${input.id} was not found`);
      const own = await options.write.create(input, { tx: context.tx, companyId, scopeId });
      const created = await tx
        .insertInto(table)
        .values({
          id: input.id,
          company_id: companyId,
          scope_id: scopeId,
          scope_span: sql<string>`(select span from core.scope where id = ${scopeId})`,
          code: input.code,
          name: input.name,
          translations: JSON.stringify(input.translations ?? []),
          ...own,
        })
        .onConflict((conflict) => conflict.column('id').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (created) noteCreated();
      const row = await select(tx).where('id', '=', input.id).executeTakeFirst();
      // The id is taken where the principal cannot read.
      if (!row) throw new NotFoundException(`${Label} ${input.id} was not found`);
      return row as Record;
    },
  });

  const UpdateCommand = registerCommand(definition.update, {
    target,
    async handle(input: UpdateInput, context: HandlerContext<MasterDataRow>): Promise<Record> {
      refuseArchived(context.target);
      const { translations } = input;
      await (context.tx as Transaction<RegisterDb>)
        .updateTable(table)
        .set({
          code: input.code,
          name: input.name,
          ...(translations === undefined ? {} : { translations: JSON.stringify(translations) }),
          ...options.write.update(input, context.target),
        })
        .where('id', '=', input.id)
        .execute();
      return selectOne(context.tx, input.id);
    },
  });

  const ArchiveCommand = registerCommand(definition.archive, {
    target,
    async handle({ id }: ExistingInput, context: HandlerContext<MasterDataRow>): Promise<Record> {
      refuseArchived(context.target);
      await (context.tx as Transaction<RegisterDb>)
        .updateTable(table)
        .set({ archived_at: sql<Date>`now()` })
        .where('id', '=', id)
        .execute();
      return selectOne(context.tx, id);
    },
  });

  const RestoreCommand = registerCommand(definition.restore, {
    target,
    async handle({ id }: ExistingInput, context: HandlerContext<MasterDataRow>): Promise<Record> {
      if (context.target.archived_at === null) {
        throw new DomainError({
          code: 'core.not_archived',
          status: HttpStatus.PRECONDITION_FAILED,
          message: `${Label} ${context.target.code} is not archived, so there is nothing to restore`,
        });
      }
      await (context.tx as Transaction<RegisterDb>)
        .updateTable(table)
        .set({ archived_at: null })
        .where('id', '=', id)
        .execute();
      return selectOne(context.tx, id);
    },
  });

  const list = defineList(definition.list, { node: options.type });
  const read = `${permission}:read`;

  @Injectable()
  class Service implements MasterDataService<Record> {
    constructor(
      @Inject(DATABASE) private readonly db: ScopedDatabase<RegisterDb>,
      @Inject(COMMAND_BUS) private readonly bus: CommandBus,
    ) {}

    async byId(id: string, companyId?: string): Promise<Record | null> {
      const scope = access.requestScope(read, companyId);
      const row = await access.readIn(scope, () =>
        this.db.transaction((tx) => ofRequest(scope)(tx).where('id', '=', id).executeTakeFirst()),
      );
      return (row as Record | undefined) ?? null;
    }

    async byIds(ids: readonly string[]): Promise<(Record | null)[]> {
      if (ids.length === 0) return [];
      const rows = await access.readAsRequest(() =>
        this.db.transaction((tx) => select(tx).where('id', 'in', ids).execute()),
      );
      const byId = new Map(rows.map((row) => [row.id, row as Record]));
      return ids.map((id) => byId.get(id) ?? null);
    }

    async byIdOrThrow(id: string): Promise<Record> {
      const row = await this.byId(id);
      if (!row) {
        throw new DomainError({
          code: 'core.not_found',
          status: HttpStatus.NOT_FOUND,
          message: `${Label} ${id} was not found`,
        });
      }
      return row;
    }

    async list(args: ListArgs<string>, companyId?: string): Promise<Connection<Record>> {
      const scope = access.requestScope(read, companyId);
      const page = await access.readIn(scope, () => list.page(this.db, ofRequest(scope), args));
      return {
        ...page,
        count: () => access.readIn(scope, () => page.count()),
      } as Connection<Record>;
    }

    async find(input: unknown): Promise<ListPage<Record>> {
      const scope = access.requestScope(read);
      return access.readIn(scope, () =>
        list.find(this.db, ofRequest(scope), input as Parameters<typeof list.find>[2]),
      ) as Promise<ListPage<Record>>;
    }

    create(input: unknown): Promise<Record> {
      return this.bus.run(CreateCommand.command, parseCommandInput(definition.create, input));
    }

    update(input: unknown): Promise<Record> {
      return this.bus.run(UpdateCommand.command, parseCommandInput(definition.update, input));
    }

    archive(input: unknown): Promise<Record> {
      return this.bus.run(ArchiveCommand.command, parseCommandInput(definition.archive, input));
    }

    restore(input: unknown): Promise<Record> {
      return this.bus.run(RestoreCommand.command, parseCommandInput(definition.restore, input));
    }
  }
  named(Service, `${entity}Service`);

  const field = `${module}${entity}`;

  @Resolver(options.type)
  class QueryResolver {
    constructor(@Inject(Service) private readonly service: Service) {}

    @Query(options.type, {
      name: field,
      nullable: true,
      description: `The ${label} with this id among those the request reads, or null. Needs ${read}.`,
    })
    @PlantFree()
    one(
      @Args('id', { type: () => ID, description: `The ${label}'s id.` }) id: string,
      @Args('companyId', companyIdArg) companyId?: string | null,
    ): Promise<Record | null> {
      return this.service.byId(id, companyId ?? undefined);
    }

    @Query(() => list.Connection, {
      name: `${field}s`,
      description: `One page of the ${label}s the request reads: at a plant the plant's and the company's, in company settings the company's. Needs ${read}.`,
    })
    @PlantFree()
    many(
      @Args({ type: () => list.Args }) args: ListArgs<string>,
      @Args('companyId', companyIdArg) companyId?: string | null,
    ): Promise<Connection<Record>> {
      return this.service.list(args, companyId ?? undefined);
    }
  }
  named(QueryResolver, `${entity}QueryResolver`);

  @Resolver(options.type)
  class MutationResolver {
    constructor(@Inject(Service) private readonly service: Service) {}

    @Mutation(options.type, {
      name: `${module}Create${entity}`,
      description: definition.create.description,
    })
    @PlantFree()
    create(@Args('input', commandInputArg(definition.create)) input: unknown): Promise<Record> {
      return this.service.create(input);
    }

    @Mutation(options.type, {
      name: `${module}Update${entity}`,
      description: definition.update.description,
    })
    @PlantFree()
    update(@Args('input', commandInputArg(definition.update)) input: unknown): Promise<Record> {
      return this.service.update(input);
    }

    @Mutation(options.type, {
      name: `${module}Archive${entity}`,
      description: definition.archive.description,
    })
    @PlantFree()
    archive(@Args('input', commandInputArg(definition.archive)) input: unknown): Promise<Record> {
      return this.service.archive(input);
    }

    @Mutation(options.type, {
      name: `${module}Restore${entity}`,
      description: definition.restore.description,
    })
    @PlantFree()
    restore(@Args('input', commandInputArg(definition.restore)) input: unknown): Promise<Record> {
      return this.service.restore(input);
    }
  }
  named(MutationResolver, `${entity}MutationResolver`);

  const handlers = {
    find: (input, context) => context.get(Service).find(input),
    get: (input, context) => context.get(Service).byIdOrThrow((input as ExistingInput).id),
    create: (input, context) => context.get(Service).create(input),
    update: (input, context) => context.get(Service).update(input),
    archive: (input, context) => context.get(Service).archive(input),
    restore: (input, context) => context.get(Service).restore(input),
  } as OperationHandlers<Definition['operations']>;
  const Operations = bindOperations(definition.operations, handlers);

  const commands = [CreateCommand, UpdateCommand, ArchiveCommand, RestoreCommand];

  @Module({ providers: [Service, ...commands], exports: [Service] })
  class ServiceModule {}
  named(ServiceModule, `${entity}ServiceModule`);

  return {
    /** The register's service, the Nest provider every surface calls. */
    Service: Service as Type<MasterDataService<Record>>,
    /** Provides the service and registers the four commands, so boot checks their permissions. */
    ServiceModule,
    /** The register's list, which the GraphQL list field and the find operation read. */
    list,
    /** The providers of the register's API module: its resolvers and its operations. */
    providers: [QueryResolver, list.ConnectionResolver, MutationResolver, Operations] as Type[],
  };
}
