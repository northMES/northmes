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
import type { MasterDataDefinition, MasterDataScope, Translation } from '@northmes/contracts';
import { GraphQLError } from 'graphql';
import { type Selectable, type SelectQueryBuilder, sql, type Transaction } from 'kysely';
import type { z } from 'zod';
import { COMMAND_BUS, type CommandBus, type HandlerContext } from '../commands/command-bus.ts';
import { registerCommand } from '../commands/define-command.ts';
import { parseCommandInput } from '../commands/parse-input.ts';
import { DATABASE, type ScopedDatabase } from '../data/database.ts';
import { DomainError, type FieldError } from '../errors/domain-error.ts';
import type { Connection, ListArgs, ListKit, ListPage } from '../lists/define-list.ts';
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

/** A query of a register's rows, which a filter hook narrows. */
export type MasterDataQuery = SelectQueryBuilder<
  RegisterDb,
  string,
  Record<string, unknown> & { readonly id: string }
>;

/** The filter fields a register's list declares. */
type FiltersOf<Definition extends MasterDataDefinition> = NonNullable<
  Definition['list']['filters']
>;

/** The filter values a list call set, by field: only those it set, never null. */
export type MasterDataFilterValues<Definition extends MasterDataDefinition> = {
  readonly [Field in keyof FiltersOf<Definition>]?: z.output<FiltersOf<Definition>[Field]>;
};

/** The locked row a command on an existing register row acts on. */
export type MasterDataRow = Selectable<MasterDataColumns> & Record<string, unknown>;

/** What a register's create hook gets besides the parsed input. */
export interface MasterDataCreateContext {
  readonly tx: Transaction<unknown>;
  readonly companyId: string;
  /** The scope node the row is written at: the company's or the request's plant's. */
  readonly scopeId: string;
}

/** What a register's update hook gets besides the parsed input. */
export interface MasterDataUpdateContext {
  readonly tx: Transaction<unknown>;
  /** The row as the command locked it, before the change. */
  readonly target: MasterDataRow;
}

/** The values of a register's own columns, which a write hook returns. */
type OwnColumns = Readonly<Record<string, unknown>>;

export interface MasterDataServiceOptions<
  Definition extends MasterDataDefinition,
  Scope extends MasterDataRequestScope,
> {
  /** The register's table, schema-qualified, such as core.equipment_group. */
  readonly table: string;
  /** The register's list, defineList of the definition's list with the GraphQL type, in api/. */
  readonly list: ListKit<string>;
  readonly access: MasterDataAccess<Scope>;
  /** The column behind each own output field, such as colorFrom: color_from. */
  readonly columns: { readonly [Field in OwnOutput<Definition>]: string };
  /**
   * The values of the register's own columns that a create and an update write. A key of the
   * kit's own columns, such as scope_id, is refused, so a hook cannot move a row the bus checked.
   */
  readonly write: {
    create(
      input: z.output<Definition['create']['input']>,
      context: MasterDataCreateContext,
    ): Promise<OwnColumns> | OwnColumns;
    update(
      input: z.output<Definition['update']['input']>,
      context: MasterDataUpdateContext,
    ): Promise<OwnColumns> | OwnColumns;
  };
  /**
   * Narrows a list's rows by the filter values a call set, for a register whose list declares
   * filter fields, which it then needs. A call that sets none skips it.
   */
  readonly filter?: (
    query: MasterDataQuery,
    filters: MasterDataFilterValues<Definition>,
  ) => MasterDataQuery;
}

/** A register's service, which every surface calls (ADR 0073). */
export interface MasterDataService<Row> {
  /** The row with this id among those the request reads, or null. */
  byId(id: string, companyId?: string): Promise<Row | null>;
  /**
   * The rows with these ids in one query, one entry per id in their order, or null where the
   * request reads none. It checks no permission, because a field of another entity reads its
   * reference through it, after that entity's own check.
   */
  byIds(ids: readonly string[]): Promise<(Row | null)[]>;
  /** The row with this id, as byId reads it, or core.not_found. */
  byIdOrThrow(id: string): Promise<Row>;
  /** One page of the rows the request reads, as the list field's arguments ask. */
  list(args: ListArgs<string>, companyId?: string): Promise<Connection<Row>>;
  /** One page of the rows the request reads, as the find operation asks. */
  find(input: unknown): Promise<ListPage<Row>>;
  create(input: unknown): Promise<Row>;
  update(input: unknown): Promise<Row>;
  archive(input: unknown): Promise<Row>;
  restore(input: unknown): Promise<Row>;
}

/** The kit's columns, which a register's write hook may not set. */
const kitColumns = new Set<string>([
  'id',
  'company_id',
  'scope_id',
  'scope_span',
  'version',
  'code',
  'code_key',
  'name',
  'translations',
  'archived_at',
  'created_at',
  'updated_at',
]);

/** The own columns a write hook returned, which may name none of the kit's. */
function ownOnly(register: string, values: OwnColumns): OwnColumns {
  const taken = Object.keys(values).filter((column) => kitColumns.has(column));
  if (taken.length > 0) {
    throw new Error(`Register ${register}: a write hook may not set ${taken.join(', ')}`);
  }
  return values;
}

/** The label with a capital first letter, for the start of a message. */
function capitalized(label: string): string {
  return `${label[0]?.toUpperCase()}${label.slice(1)}`;
}

/** Names a class for Nest's messages. */
export function named<Class extends Type>(Class: Class, name: string): Class {
  Object.defineProperty(Class, 'name', { value: name });
  return Class;
}

/**
 * The domain side of a register (ADR 0022), for the module's core/: its four commands with their
 * target, and a service whose reads go through the ScopedDatabase and whose writes go through the
 * command bus (ADR 0012). A row sits at the company's node or at the request's plant; a read at a
 * plant sees the plant's rows and the company's, and one in company settings every row of the
 * company; a list call's filter values go through the register's filter hook. The table is one
 * that pnpm gen:migration --register wrote. masterDataApi builds the
 * GraphQL and operation surfaces on what it returns.
 *
 * @internal Until ADR 0022 settles whether plugins define registers: the kit trusts its access
 * port for every read permission.
 */
export function masterDataService<
  const Definition extends MasterDataDefinition,
  Scope extends MasterDataRequestScope,
>(definition: Definition, options: MasterDataServiceOptions<Definition, Scope>) {
  type Row = MasterDataRecord<Definition>;
  const { module, entity, label, permission } = definition;
  const { table, access, list } = options;
  const register = `${module}.${entity}`;
  const atCompany = definition.scopes.includes('company' as never);
  const Label = capitalized(label);
  const filterFields = Object.keys(definition.list.filters ?? {});
  if (filterFields.length > 0 && !options.filter) {
    throw new Error(`Register ${register}: its list declares filter fields, so it needs a filter`);
  }

  /** The rows of the table as the service hands them out, which row-level security limits. */
  function select(tx: Transaction<RegisterDb>) {
    return tx.selectFrom(table).select([
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
      // The columns of the register's own definition, never input.
      ...Object.entries<string>(options.columns).map(([field, column]) =>
        sql.ref(column).as(field),
      ),
    ]) as unknown as SelectQueryBuilder<RegisterDb, string, Row & { readonly id: string }>;
  }

  /** The rows that `scope` reads: the plant's and the company's, or in settings the company's. */
  function ofRequest(scope: MasterDataRequestScope) {
    return (tx: Transaction<RegisterDb>) =>
      scope.plantId
        ? select(tx).where('scope_id', 'in', [scope.plantId, scope.companyId])
        : select(tx).where('company_id', '=', scope.companyId);
  }

  /**
   * The filter values a list call set, each parsed with its contract, since a GraphQL ID or
   * String holds any text. A value outside it is BAD_USER_INPUT on the filter field.
   */
  function filtersOf(call: unknown): MasterDataFilterValues<Definition> {
    const values = call as Readonly<Record<string, unknown>>;
    const schemas = (definition.list.filters ?? {}) as Readonly<Record<string, z.ZodType>>;
    const parsed: Record<string, unknown> = {};
    const fieldErrors: FieldError[] = [];
    for (const field of filterFields) {
      if (values[field] == null) continue;
      const result = schemas[field]?.safeParse(values[field]);
      if (result?.success) parsed[field] = result.data;
      else
        fieldErrors.push(
          ...(result?.error.issues ?? []).map(({ message, code }) => ({
            path: [field],
            message,
            code,
          })),
        );
    }
    if (fieldErrors.length > 0) {
      const problems = fieldErrors.map(({ path, message }) => `${path.join('.')}: ${message}`);
      throw new GraphQLError(`Invalid filter for ${definition.find.name}: ${problems.join('; ')}`, {
        extensions: { code: 'BAD_USER_INPUT', fieldErrors },
      });
    }
    return parsed as MasterDataFilterValues<Definition>;
  }

  /** The rows that `scope` reads, narrowed by the filter values of a list call. */
  function listed(scope: MasterDataRequestScope, call: unknown) {
    const filters = filtersOf(call);
    return (tx: Transaction<RegisterDb>) => {
      const rows = ofRequest(scope)(tx) as unknown as MasterDataQuery;
      return options.filter && Object.keys(filters).length > 0
        ? options.filter(rows, filters)
        : rows;
    };
  }

  /** The one row with this id, after a command changed it. */
  function selectOne(tx: Transaction<unknown>, id: string): Promise<Row> {
    return select(tx as Transaction<RegisterDb>)
      .where('id', '=', id)
      .executeTakeFirstOrThrow() as Promise<Row>;
  }

  /** The company a create writes in and the node it writes at (ADR 0007), or undefined. */
  async function placeOfCreate(
    input: unknown,
    context: Pick<HandlerContext, 'tx' | 'plantId'>,
  ): Promise<{ readonly companyId: string; readonly scopeId: string } | undefined> {
    const companyId = await access.requestCompany(input, context);
    if (!companyId) return undefined;
    const level = (input as { readonly scope?: MasterDataScope }).scope ?? 'plant';
    if (level === 'company') return { companyId, scopeId: companyId };
    if (!context.plantId) {
      // Company settings name no plant, so a plant row has nowhere to sit.
      const message = 'Choose company: a row at a plant is made at that plant.';
      throw new DomainError({
        code: 'core.plant_scope_needs_plant',
        status: HttpStatus.BAD_REQUEST,
        message,
        fieldErrors: [{ path: ['scope'], message, code: 'core.plant_scope_needs_plant' }],
      });
    }
    return { companyId, scopeId: context.plantId };
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
    scope: async (input, context) => (await placeOfCreate(input, context))?.scopeId,
    async handle(input: CreateInput, context: HandlerContext): Promise<Row> {
      const tx = context.tx as Transaction<RegisterDb>;
      const place = await placeOfCreate(input, context);
      // The scope hook found no scope, so the bus refused the command before the handler runs.
      if (!place) throw new NotFoundException(`${Label} ${input.id} was not found`);
      const own = ownOnly(
        register,
        await options.write.create(input, { tx: context.tx, ...place }),
      );
      const created = await tx
        .insertInto(table)
        .values({
          ...own,
          id: input.id,
          company_id: place.companyId,
          scope_id: place.scopeId,
          scope_span: sql<string>`(select span from core.scope where id = ${place.scopeId})`,
          code: input.code,
          name: input.name,
          translations: JSON.stringify(input.translations ?? []),
        })
        .onConflict((conflict) => conflict.column('id').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (created) noteCreated();
      const row = await select(tx).where('id', '=', input.id).executeTakeFirst();
      // The id is taken where the principal cannot read.
      if (!row) throw new NotFoundException(`${Label} ${input.id} was not found`);
      return row as Row;
    },
  });

  const UpdateCommand = registerCommand(definition.update, {
    target,
    async handle(input: UpdateInput, context: HandlerContext<MasterDataRow>): Promise<Row> {
      refuseArchived(context.target);
      const { translations } = input;
      const own = ownOnly(
        register,
        await options.write.update(input, { tx: context.tx, target: context.target }),
      );
      await (context.tx as Transaction<RegisterDb>)
        .updateTable(table)
        .set({
          ...own,
          code: input.code,
          name: input.name,
          ...(translations === undefined ? {} : { translations: JSON.stringify(translations) }),
        })
        .where('id', '=', input.id)
        .execute();
      return selectOne(context.tx, input.id);
    },
  });

  const ArchiveCommand = registerCommand(definition.archive, {
    target,
    async handle({ id }: ExistingInput, context: HandlerContext<MasterDataRow>): Promise<Row> {
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
    async handle({ id }: ExistingInput, context: HandlerContext<MasterDataRow>): Promise<Row> {
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

  const read = `${permission}:read`;

  @Injectable()
  class Service implements MasterDataService<Row> {
    constructor(
      @Inject(DATABASE) private readonly db: ScopedDatabase<RegisterDb>,
      @Inject(COMMAND_BUS) private readonly bus: CommandBus,
    ) {}

    async byId(id: string, companyId?: string): Promise<Row | null> {
      const scope = access.requestScope(read, companyId);
      const row = await access.readIn(scope, () =>
        this.db.transaction((tx) => ofRequest(scope)(tx).where('id', '=', id).executeTakeFirst()),
      );
      return (row as Row | undefined) ?? null;
    }

    async byIds(ids: readonly string[]): Promise<(Row | null)[]> {
      if (ids.length === 0) return [];
      const rows = await access.readAsRequest(() =>
        this.db.transaction((tx) => select(tx).where('id', 'in', ids).execute()),
      );
      const byId = new Map(rows.map((row) => [row.id, row as Row]));
      return ids.map((id) => byId.get(id) ?? null);
    }

    async byIdOrThrow(id: string): Promise<Row> {
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

    async list(args: ListArgs<string>, companyId?: string): Promise<Connection<Row>> {
      const scope = access.requestScope(read, companyId);
      const page = await access.readIn(scope, () => list.page(this.db, listed(scope, args), args));
      return {
        ...page,
        count: () => access.readIn(scope, () => page.count()),
      } as Connection<Row>;
    }

    async find(input: unknown): Promise<ListPage<Row>> {
      const scope = access.requestScope(read);
      return access.readIn(scope, () =>
        list.find(this.db, listed(scope, input), input as Parameters<typeof list.find>[2]),
      ) as Promise<ListPage<Row>>;
    }

    create(input: unknown): Promise<Row> {
      return this.bus.run(CreateCommand.command, parseCommandInput(definition.create, input));
    }

    update(input: unknown): Promise<Row> {
      return this.bus.run(UpdateCommand.command, parseCommandInput(definition.update, input));
    }

    archive(input: unknown): Promise<Row> {
      return this.bus.run(ArchiveCommand.command, parseCommandInput(definition.archive, input));
    }

    restore(input: unknown): Promise<Row> {
      return this.bus.run(RestoreCommand.command, parseCommandInput(definition.restore, input));
    }
  }
  named(Service, `${entity}Service`);

  const commands = [CreateCommand, UpdateCommand, ArchiveCommand, RestoreCommand];

  @Module({ providers: [Service, ...commands], exports: [Service] })
  class ServiceModule {}
  named(ServiceModule, `${entity}ServiceModule`);

  return {
    definition,
    /** The register's service, the Nest provider every surface calls. */
    Service: Service as Type<MasterDataService<Row>>,
    /** Provides the service and registers the four commands, so boot checks their permissions. */
    ServiceModule,
  };
}

/** What masterDataService returns, which masterDataApi builds the surfaces on. */
export type MasterDataServiceKit<Definition extends MasterDataDefinition = MasterDataDefinition> = {
  readonly definition: Definition;
  readonly Service: Type<MasterDataService<MasterDataRecord<Definition>>>;
  readonly ServiceModule: Type;
};
