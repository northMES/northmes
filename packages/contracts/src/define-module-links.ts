// SPDX-License-Identifier: MIT

/**
 * One entry of a module's link manifest: its path below the parent entry, in the router's syntax
 * (each segment a literal or exactly one $param), and its child entries.
 */
export interface LinkEntryDefinition {
  readonly path: string;
  readonly children?: LinkEntryDefinitions;
}

export type LinkEntryDefinitions = Readonly<Record<string, LinkEntryDefinition>>;

// The names of the $params in a route pattern: /$plant/planning/orders/$orderId has plant and
// orderId.
type ParamNames<Pattern extends string> = Pattern extends `${infer Head}/${infer Rest}`
  ? ParamNames<Head> | ParamNames<Rest>
  : Pattern extends `$${infer Name}`
    ? Name
    : never;

/** The params of a route pattern, one string value for each $param. */
export type LinkParams<Pattern extends string> = { readonly [Name in ParamNames<Pattern>]: string };

/** The search of a link, one string value per key. Typed search keys come with defineSearch. */
export type LinkSearch = Readonly<Record<string, string>>;

/**
 * What a link builder returns: the route pattern, params and search for the router, and the
 * finished href for code without one.
 */
export interface ModuleLink<Pattern extends string> {
  readonly to: Pattern;
  readonly params: LinkParams<Pattern>;
  readonly search: LinkSearch;
  readonly href: string;
}

export type LinkBuilder<Pattern extends string> = (
  params: LinkParams<Pattern>,
  search?: LinkSearch,
) => ModuleLink<Pattern>;

/** What linkEntry reads from a link manifest or one of its entries. */
export interface LinkEntry<Pattern extends string = string> {
  /**
   * The entry's path below its parent entry, as the manifest declares it. A manifest's path is its
   * module id, below /$plant.
   */
  readonly path: string;
  /** The entry's route pattern, which starts with /$plant/<moduleId>. */
  readonly pattern: Pattern;
}

// The key of the entry a manifest and each builder carry. A symbol key cannot collide with an entry
// name, and Object.keys skips it, so their string keys stay the names of their child entries. The
// key comes from the global symbol registry, because every remote bundles its own copy of this
// package (ADR 0062), and the shell's copy must read the entries a remote's copy built.
const entryKey: unique symbol = Symbol.for('@northmes/contracts/link-entry');

/** A link manifest or one of its builders, which carries the entry that linkEntry reads. */
export interface LinkNode<Pattern extends string> {
  readonly [entryKey]: LinkEntry<Pattern>;
}

/**
 * Reads the path and the route pattern of a link manifest or of one of its entries, without calling
 * the entry's builder. A route takes its path from here, so each path is written once (ADR 0062).
 */
export function linkEntry<Pattern extends string>(node: LinkNode<Pattern>): LinkEntry<Pattern> {
  return node[entryKey];
}

type ChildEntries<Entry extends LinkEntryDefinition> = Entry extends {
  readonly children: infer Children extends LinkEntryDefinitions;
}
  ? Children
  : Record<never, never>;

// The builder of the entry at the route pattern Pattern, carrying its children's builders.
type EntryLinks<Pattern extends string, Entry extends LinkEntryDefinition> = LinkBuilder<Pattern> &
  LinkNode<Pattern> &
  ModuleLinks<Pattern, ChildEntries<Entry>>;

/** The builders of the entries below the route pattern Parent. */
export type ModuleLinks<Parent extends string, Entries extends LinkEntryDefinitions> = {
  readonly [Name in keyof Entries & string]: EntryLinks<
    `${Parent}/${Entries[Name]['path']}`,
    Entries[Name]
  >;
};

/**
 * A module's link manifest (ADR 0062). Each entry becomes a builder that takes the params of its
 * route pattern, which starts with /$plant/<moduleId>, and returns the link. The param names come
 * from the patterns, so a missing or unknown param is a type error. The builders are plain
 * functions, so code without a router (server code, MCP tools, end-to-end specs) can call them.
 */
export function defineModuleLinks<
  const ModuleId extends string,
  const Entries extends LinkEntryDefinitions,
>(
  moduleId: ModuleId,
  entries: Entries,
): ModuleLinks<`/$plant/${ModuleId}`, Entries> & LinkNode<`/$plant/${ModuleId}`> {
  const pattern = `/$plant/${moduleId}` as const;
  const links = builders(pattern, entries) as ModuleLinks<typeof pattern, Entries>;
  return Object.assign(links, { [entryKey]: { path: moduleId, pattern } });
}

type Params = Readonly<Record<string, string>>;

// Each builder carries its children's builders as properties, so an entry may not take the name of
// a property every function has (name, length, call, apply, bind, toString and the like).
function builders(parent: string, entries: LinkEntryDefinitions): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entries).map(([name, entry]) => {
      if (name in Function.prototype) {
        throw new Error(`Link entry ${name} under ${parent} has the name of a function property`);
      }
      const pattern = `${parent}/${entry.path}`;
      const build = (params: Params, search: LinkSearch = {}) => ({
        to: pattern,
        params,
        search,
        href: href(pattern, params, search),
      });
      const node = { [entryKey]: { path: entry.path, pattern } };
      return [name, Object.assign(build, node, builders(pattern, entry.children ?? {}))];
    }),
  );
}

function href(pattern: string, params: Params, search: LinkSearch): string {
  const path = pattern
    .split('/')
    .map((segment) =>
      segment.startsWith('$') ? param(pattern, segment.slice(1), params) : segment,
    )
    .join('/');
  const query = Object.entries(search)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return query === '' ? path : `${path}?${query}`;
}

// The encoded value of one param. An empty value throws, because the href would lose the segment,
// and so do . and .., because URL parsing would drop the segment or climb out of the route.
function param(pattern: string, name: string, params: Params): string {
  const value = params[name];
  if (!value) {
    throw new Error(`Link ${pattern} has an empty value for ${name}`);
  }
  if (value === '.' || value === '..') {
    throw new Error(
      `Link ${pattern} has the value ${JSON.stringify(value)} for ${name}, which is not a path segment`,
    );
  }
  return encodeURIComponent(value);
}
