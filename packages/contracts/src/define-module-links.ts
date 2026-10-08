// SPDX-License-Identifier: MIT

/** One entry of a module's link manifest: its path below the parent entry, and its child entries. */
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

type ChildEntries<Entry extends LinkEntryDefinition> = Entry extends {
  readonly children: infer Children extends LinkEntryDefinitions;
}
  ? Children
  : Record<never, never>;

/** The builders of the entries below the route pattern Parent, each with its children's builders. */
export type ModuleLinks<Parent extends string, Entries extends LinkEntryDefinitions> = {
  readonly [Name in keyof Entries & string]: LinkBuilder<`${Parent}/${Entries[Name]['path']}`> &
    ModuleLinks<`${Parent}/${Entries[Name]['path']}`, ChildEntries<Entries[Name]>>;
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
>(moduleId: ModuleId, entries: Entries): ModuleLinks<`/$plant/${ModuleId}`, Entries> {
  return builders(`/$plant/${moduleId}`, entries) as ModuleLinks<`/$plant/${ModuleId}`, Entries>;
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
      return [name, Object.assign(build, builders(pattern, entry.children ?? {}))];
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
