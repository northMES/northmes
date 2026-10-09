// SPDX-License-Identifier: MIT
import { HttpStatus, type Type } from '@nestjs/common';
import {
  ArgsType,
  Field,
  InputType,
  Int,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
  registerEnumType,
} from '@nestjs/graphql';
import type { ListDeclaration as ListContract } from '@northmes/contracts';
import { type SelectQueryBuilder, type SqlBool, sql, type Transaction } from 'kysely';
import type { ScopedDatabase } from '../data/database.ts';
import { DomainError } from '../errors/domain-error.ts';
import { decodeCursor, encodeCursor } from './cursor.ts';
import { PageInfo, SortDirection } from './page-info.ts';

/** A column a list sorts by: its name in the list's query and its Postgres type. */
export interface SortColumn {
  readonly column: string;
  /** The type a cursor's text value is cast back to, such as text. */
  readonly type: string;
}

/** One entry of a list's orderBy argument. */
export interface OrderBy<SortField extends string> {
  readonly field: SortField;
  readonly direction?: SortDirection | null;
}

/** What a list declares once, and the kit builds its GraphQL types and its SQL from. */
export interface ListDeclaration<SortField extends string> {
  /**
   * The GraphQL name of the node type, such as Article. The kit names the list's types after it:
   * ArticleConnection, ArticleEdge, ArticleSortField and ArticleOrderBy.
   */
  readonly name: string;
  /** The node's GraphQL type. */
  readonly node: () => Type;
  /**
   * The columns behind each value of the SortField enum. Each is NOT NULL, because the kit does
   * not split a nullable key into its null and non-null rows yet (ADR 0016).
   */
  readonly sortFields: Readonly<Record<SortField, SortColumn>>;
  /** The order of a call without orderBy. */
  readonly defaultOrderBy: readonly OrderBy<NoInfer<SortField>>[];
  /** The text columns that search matches a part of, ignoring case (ADR 0016). */
  readonly search: readonly string[];
  /**
   * The list's rows are archived through archived_at, never deleted (ADR 0006). The root field
   * then takes includeArchived, false by default, and hides archived rows unless it is true.
   */
  readonly archivable?: boolean;
}

/** The arguments of a list's root field (ADR 0016). */
export interface ListArgs<SortField extends string> {
  readonly first?: number | null;
  readonly after?: string | null;
  readonly last?: number | null;
  readonly before?: string | null;
  readonly orderBy?: readonly OrderBy<SortField>[] | null;
  readonly search?: string | null;
  /** Lists archived rows too; only an archivable list takes it (ADR 0016). */
  readonly includeArchived?: boolean | null;
}

export interface Edge<Node> {
  readonly cursor: string;
  readonly node: Node;
}

/** What a list's root field resolves to. */
export interface Connection<Node> {
  readonly edges: readonly Edge<Node>[];
  readonly pageInfo: PageInfo;
  /**
   * Counts the rows of the list without paging. The list's ConnectionResolver calls it for
   * totalCount, so the count runs only when a query selects that field (ADR 0016).
   */
  count(): Promise<number>;
}

/**
 * What a list's operation input asks of a page (ADR 0073): the fields that defineListQueryContract
 * derives, with orderBy as camelCase sort fields, each optionally prefixed with - for descending.
 */
export interface ListInput {
  readonly first?: number | undefined;
  readonly after?: string | undefined;
  readonly orderBy?: readonly string[] | undefined;
  readonly search?: string | undefined;
  readonly includeArchived?: boolean | undefined;
}

/** What a list's operation answers: the connection without edges (ADR 0073). */
export interface ListPage<Node> {
  readonly nodes: Node[];
  readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
}

/** The GraphQL name of a camelCase sort field: updatedAt is UPDATED_AT. */
function graphqlName(field: string): string {
  return field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

/** The orderBy entry of a sort field as an operation names it, such as -updatedAt. */
function orderOf(entry: string): OrderBy<string> {
  const descending = entry.startsWith('-');
  return {
    field: graphqlName(descending ? entry.slice(1) : entry),
    direction: descending ? SortDirection.DESC : SortDirection.ASC,
  };
}

/** The kit's declaration of a list that a contracts package declares, with its GraphQL node. */
function fromContract(list: ListContract, node: () => Type): ListDeclaration<string> {
  return {
    name: list.name,
    node,
    sortFields: Object.fromEntries(
      Object.entries(list.sortFields).map(([field, column]) => [graphqlName(field), column]),
    ),
    defaultOrderBy: list.defaultOrderBy.map(orderOf),
    search: list.search,
    ...(list.archivable === undefined ? {} : { archivable: list.archivable }),
  };
}

/** The page size of a call without first or last. */
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_ORDER_BY_ENTRIES = 3;
const MAX_SEARCH_LENGTH = 100;

/** A sort key of a page's order: a column with its type and direction. */
interface Key extends SortColumn {
  readonly direction: SortDirection;
}

/** A class with this name, so Nest's messages and the schema name it. */
function namedClass(name: string): Type {
  return { [name]: class {} }[name] as Type;
}

function badArgument(message: string): DomainError {
  return new DomainError({
    code: 'core.list.bad_argument',
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}

/** The page size that the argument `name` asks for. */
function pageSize(name: 'first' | 'last', value: number | null | undefined): number {
  const size = value ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw badArgument(`${name} must be between 1 and ${MAX_PAGE_SIZE}`);
  }
  return size;
}

/**
 * The keys of the order the arguments ask for, with id last as the tie-breaker in the direction of
 * the last entry (ADR 0016).
 */
function keysOf<SortField extends string>(
  declaration: ListDeclaration<SortField>,
  args: ListArgs<SortField>,
): Key[] {
  const orderBy = args.orderBy?.length ? args.orderBy : declaration.defaultOrderBy;
  if (orderBy.length > MAX_ORDER_BY_ENTRIES) {
    throw badArgument(`orderBy takes at most ${MAX_ORDER_BY_ENTRIES} entries`);
  }
  const fields = orderBy.map(({ field }) => field);
  const repeated = fields.find((field, index) => fields.indexOf(field) !== index);
  if (repeated) throw badArgument(`orderBy names ${repeated} more than once`);
  const keys = orderBy.map(({ field, direction }) => ({
    ...declaration.sortFields[field],
    direction: direction ?? SortDirection.ASC,
  }));
  const last = keys.at(-1)?.direction ?? SortDirection.ASC;
  return [...keys, { column: 'id', type: 'uuid', direction: last }];
}

/** The order signature a cursor carries, such as code.AL,id.AL: column, direction, nulls last. */
function signatureOf(keys: readonly Key[]): string {
  return keys.map(({ column, direction }) => `${column}.${direction.charAt(0)}L`).join(',');
}

/** The keys of the opposite order, which a backward page reads its rows in. */
function reversed(keys: readonly Key[]): Key[] {
  return keys.map((key) => ({
    ...key,
    direction: key.direction === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC,
  }));
}

/**
 * The rows whose search columns hold `search`, ignoring case. A backslash escapes % and _ in the
 * pattern, so they match themselves.
 */
function matching(columns: readonly string[], search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const matches = columns.map((column) => sql`${sql.ref(column)} ilike ${pattern}`);
  return sql<SqlBool>`(${sql.join(matches, sql` or `)})`;
}

/** How one call reads its page. */
interface PagePlan {
  /** True when last or before asks for the page before a cursor, or for the last page. */
  readonly backward: boolean;
  readonly size: number;
  /** The keys of the order the arguments ask for. */
  readonly keys: readonly Key[];
  readonly signature: string;
  /** The sort values of the after or before cursor. */
  readonly from: readonly string[] | undefined;
  /** The trimmed search, or undefined when the call searches for nothing. */
  readonly search: string | undefined;
}

/**
 * The plan of a call: last or before selects backward paging, and first is then ignored, because
 * the schema gives every call first = 25 (ADR 0016). after with before is refused.
 */
function planOf<SortField extends string>(
  declaration: ListDeclaration<SortField>,
  args: ListArgs<SortField>,
): PagePlan {
  if (args.after != null && args.before != null) {
    throw badArgument('after and before cannot be used together');
  }
  const backward = args.last != null || args.before != null;
  const size = backward ? pageSize('last', args.last) : pageSize('first', args.first);
  const keys = keysOf(declaration, args);
  const signature = signatureOf(keys);
  const cursor = backward ? args.before : args.after;
  const from = cursor != null ? decodeCursor(cursor, signature, keys.length) : undefined;
  const search = args.search?.trim() || undefined;
  if (search && search.length > MAX_SEARCH_LENGTH) {
    throw badArgument(`search takes at most ${MAX_SEARCH_LENGTH} characters`);
  }
  return { backward, size, keys, signature, from, search };
}

/**
 * The rows after the cursor's values in the order of `keys`: those beyond it on the first key, or
 * equal on the first key and beyond it on the second, and so on.
 */
function afterValues(keys: readonly Key[], values: readonly string[]) {
  const value = (index: number) => {
    const key = keys[index] as Key;
    return sql`cast(${values[index]} as ${sql.raw(key.type)})`;
  };
  const branches = keys.map((key, index) => {
    const equal = keys
      .slice(0, index)
      .map(({ column }, before) => sql`${sql.ref(column)} = ${value(before)}`);
    const beyond = sql`${sql.ref(key.column)} ${sql.raw(key.direction === 'ASC' ? '>' : '<')} ${value(index)}`;
    return sql`(${sql.join([...equal, beyond], sql` and `)})`;
  });
  return sql<SqlBool>`(${sql.join(branches, sql` or `)})`;
}

/**
 * Declares a list: its GraphQL types and the SQL of its pages, with keyset paging over opaque
 * cursors (ADR 0016). This is the smallest kit the first list needs: orderBy over declared sort
 * fields, paging forward and backward, search and a totalCount that runs only when selected. Filter,
 * group by and aggregates come with the full kit.
 */
export function defineList<const SortField extends string>(
  declaration: ListDeclaration<SortField>,
): ListKit<SortField>;
/**
 * Declares the list that a contracts package declares (ADR 0073), with the GraphQL type of its
 * node. Its sort fields are camelCase there and upper snake case in GraphQL: updatedAt is
 * UPDATED_AT.
 */
export function defineList(
  list: ListContract,
  options: { readonly node: () => Type },
): ListKit<string>;
export function defineList(
  declaration: ListDeclaration<string> | ListContract,
  options?: { readonly node: () => Type },
): ListKit<string> {
  return listKit(
    options
      ? fromContract(declaration as ListContract, options.node)
      : (declaration as ListDeclaration<string>),
  );
}

/** What defineList returns. */
export type ListKit<SortField extends string> = ReturnType<typeof listKit<SortField>>;

function listKit<const SortField extends string>(declaration: ListDeclaration<SortField>) {
  const { name, node, sortFields } = declaration;

  const SortFieldEnum = Object.fromEntries(Object.keys(sortFields).map((field) => [field, field]));
  registerEnumType(SortFieldEnum, { name: `${name}SortField` });

  const OrderByInput = namedClass(`${name}OrderBy`);
  Field(() => SortFieldEnum)(OrderByInput.prototype, 'field');
  Field(() => SortDirection, { nullable: true, defaultValue: SortDirection.ASC })(
    OrderByInput.prototype,
    'direction',
  );
  InputType(`${name}OrderBy`)(OrderByInput);

  const EdgeType = namedClass(`${name}Edge`);
  Field(() => String)(EdgeType.prototype, 'cursor');
  Field(node)(EdgeType.prototype, 'node');
  ObjectType(`${name}Edge`)(EdgeType);

  const ConnectionType = namedClass(`${name}Connection`);
  Field(() => [EdgeType])(ConnectionType.prototype, 'edges');
  Field(() => PageInfo)(ConnectionType.prototype, 'pageInfo');
  Field(() => Int)(ConnectionType.prototype, 'totalCount');
  ObjectType(`${name}Connection`)(ConnectionType);

  const ArgsClass = namedClass(`${name}ListArgs`);
  const optional = { nullable: true } as const;
  Field(() => Int, { nullable: true, defaultValue: DEFAULT_PAGE_SIZE })(
    ArgsClass.prototype,
    'first',
  );
  Field(() => String, optional)(ArgsClass.prototype, 'after');
  Field(() => Int, optional)(ArgsClass.prototype, 'last');
  Field(() => String, optional)(ArgsClass.prototype, 'before');
  Field(() => [OrderByInput], optional)(ArgsClass.prototype, 'orderBy');
  Field(() => String, optional)(ArgsClass.prototype, 'search');
  if (declaration.archivable) {
    Field(() => Boolean, { nullable: true, defaultValue: false })(
      ArgsClass.prototype,
      'includeArchived',
    );
  }
  ArgsType()(ArgsClass);

  @Resolver(() => ConnectionType)
  class ConnectionResolver {
    /** The rows of the list without paging, counted only when a query selects this field. */
    @ResolveField(() => Int)
    totalCount(@Parent() connection: Connection<unknown>): Promise<number> {
      return connection.count();
    }
  }
  // Nest's messages name the class, so it carries the connection's name.
  Object.defineProperty(ConnectionResolver, 'name', { value: `${name}ConnectionResolver` });

  return {
    /** The <Name>Connection object type, which the list's root field returns. */
    Connection: ConnectionType,
    /** The arguments of the root field, for @Args({ type: () => list.Args }). */
    Args: ArgsClass,
    /**
     * The resolver of the connection's totalCount field, which the module lists among the
     * providers of its Nest module next to the resolver of the list's root field.
     */
    ConnectionResolver: ConnectionResolver as Type,
    /**
     * Reads one page of the rows that `query` selects, in one ScopedDatabase transaction, as the
     * root field's arguments ask. `query` selects the node's columns, id among them, from the
     * list's table. A refused argument is BAD_USER_INPUT with core.list.bad_argument, and a cursor
     * of another order is core.list.invalid_cursor (ADR 0016).
     */
    async page<DB, TB extends keyof DB, Row extends { readonly id: string }>(
      db: ScopedDatabase<DB>,
      query: (tx: Transaction<DB>) => SelectQueryBuilder<DB, TB, Row>,
      args: ListArgs<SortField>,
    ): Promise<Connection<Row>> {
      const { backward, size, keys, signature, from, search } = planOf(declaration, args);
      // The rows of the list without paging: the active ones unless the call includes archived
      // rows, and those that search matches.
      const hideArchived = declaration.archivable === true && args.includeArchived !== true;
      const listed = (tx: Transaction<DB>) => {
        let rows = query(tx);
        if (hideArchived) rows = rows.where(sql<SqlBool>`${sql.ref('archived_at')} is null`);
        return search ? rows.where(matching(declaration.search, search)) : rows;
      };
      // A backward page reads the rows before the cursor in the opposite order, and reverses them.
      const readKeys = backward ? reversed(keys) : keys;
      const aliases = keys.map((_key, index) => `_nm_key_${index}`);

      const rows = await db.transaction((tx) => {
        let rowsQuery = listed(tx);
        if (from) rowsQuery = rowsQuery.where(afterValues(readKeys, from));
        let ordered = rowsQuery.select(
          keys.map(({ column }, index) =>
            sql<string>`${sql.ref(column)}::text`.as(aliases[index] as string),
          ),
        );
        for (const { column, direction } of readKeys) {
          ordered = ordered.orderBy(sql.ref(column), direction === 'ASC' ? 'asc' : 'desc');
        }
        return ordered.limit(size + 1).execute();
      });

      const pageRows = rows.slice(0, size);
      if (backward) pageRows.reverse();
      const edges = pageRows.map((row) => {
        const record = row as Record<string, unknown>;
        const values = aliases.map((alias) => String(record[alias]));
        const nodeValue = Object.fromEntries(
          Object.entries(record).filter(([column]) => !aliases.includes(column)),
        ) as Row;
        return { cursor: encodeCursor(signature, values), node: nodeValue };
      });
      return {
        edges,
        pageInfo: {
          // Exact in the direction of paging; in the other, whether the page started at a cursor.
          hasNextPage: backward ? from !== undefined : rows.length > size,
          hasPreviousPage: backward ? rows.length > size : from !== undefined,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges.at(-1)?.cursor ?? null,
        },
        count: () =>
          db.transaction(async (tx) => {
            const { rows } = await sql<{ count: string }>`select count(*) as count from (${listed(
              tx,
            )}) as list`.execute(tx);
            return Number(rows[0]?.count);
          }),
      };
    },
    /**
     * Reads one page as a list's operation input asks (ADR 0073): page with first, after, orderBy
     * of camelCase sort fields, search and includeArchived, answered as nodes and pageInfo. The
     * module's service applies the list's filter fields in `query`.
     */
    async find<DB, TB extends keyof DB, Row extends { readonly id: string }>(
      db: ScopedDatabase<DB>,
      query: (tx: Transaction<DB>) => SelectQueryBuilder<DB, TB, Row>,
      input: ListInput,
    ): Promise<ListPage<Row>> {
      const { edges, pageInfo } = await this.page(db, query, {
        first: input.first ?? null,
        after: input.after ?? null,
        orderBy: (input.orderBy?.map(orderOf) as OrderBy<SortField>[] | undefined) ?? null,
        search: input.search ?? null,
        includeArchived: input.includeArchived ?? null,
      });
      return {
        nodes: edges.map(({ node }) => node),
        pageInfo: { hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor },
      };
    },
  };
}
