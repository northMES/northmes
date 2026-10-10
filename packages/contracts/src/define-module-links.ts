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
   * module id, below /$plant, and so is its settings section's, below /settings/$companyId. Core's
   * manifest and its settings section have an empty path (ADR 0074).
   */
  readonly path: string;
  /**
   * The entry's route pattern, which starts with /$plant/<moduleId>, or with
   * /settings/$companyId/<moduleId> in the settings section. Core's start with /$plant and
   * /settings/$companyId.
   */
  readonly pattern: Pattern;
}

// The key of the entry a manifest and each builder carry. A symbol key cannot collide with an entry
// name, and Object.keys skips it, so their string keys stay the names of their child entries. The
// key comes from the global symbol registry, because a plugin bundle carries its own copy of this
// package (packages/sdk does not list it as host-provided), and the web app's copy must read the
// entries that copy built.
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

/** The sections of a link manifest beside its plant pages. */
export interface ModuleLinkSections<Settings extends LinkEntryDefinitions | undefined> {
  /**
   * The module's company settings pages, below /settings/$companyId/<moduleId>, whose builders take
   * a company id and no plant (ADR 0066).
   */
  readonly settings: Settings;
}

/**
 * The settings section of a manifest that declares one: a manifest of its own whose pages sit below
 * the route pattern Root.
 */
type SettingsLinks<
  Root extends string,
  Settings extends LinkEntryDefinitions | undefined,
> = Settings extends LinkEntryDefinitions
  ? { readonly settings: ModuleLinks<Root, Settings> & LinkNode<Root> }
  : unknown;

/** The builders of the entries of a manifest below `pattern`, with its entry. */
function manifest(path: string, pattern: string, entries: LinkEntryDefinitions) {
  return Object.assign(builders(pattern, entries), { [entryKey]: { path, pattern } });
}

/** Where a manifest's pages sit: its plant pages and its settings section. */
interface ManifestRoots {
  /** The manifest's path below /$plant, and below /settings/$companyId for its settings. */
  readonly path: string;
  readonly plant: string;
  readonly settings: string;
}

/** The manifest of a module's entries and settings section, with its pages at roots. */
function linksAt(
  name: string,
  roots: ManifestRoots,
  entries: LinkEntryDefinitions,
  sections: ModuleLinkSections<LinkEntryDefinitions | undefined> | undefined,
) {
  const links = manifest(roots.path, roots.plant, entries);
  if (sections?.settings === undefined) return links;
  if ('settings' in entries) {
    throw new Error(`Module ${name} has an entry named settings and a settings section`);
  }
  const settings = manifest(roots.path, roots.settings, sections.settings);
  return Object.assign(links, { settings });
}

/**
 * A module's link manifest (ADR 0062). Each entry becomes a builder that takes the params of its
 * route pattern, which starts with /$plant/<moduleId>, and returns the link. The param names come
 * from the patterns, so a missing or unknown param is a type error. The builders are plain
 * functions, so code without a router (server code, MCP tools, end-to-end specs) can call them.
 * A settings section becomes the manifest's `settings`, whose builders start with
 * /settings/$companyId/<moduleId> and take a company id instead of a plant (ADR 0066). An entry
 * named settings beside a settings section throws. Core's manifest comes from defineCoreLinks.
 */
export function defineModuleLinks<
  const ModuleId extends string,
  const Entries extends LinkEntryDefinitions,
  const Settings extends LinkEntryDefinitions | undefined = undefined,
>(
  moduleId: ModuleId,
  entries: Entries,
  sections?: ModuleLinkSections<Settings>,
): ModuleLinks<`/$plant/${ModuleId}`, Entries> &
  LinkNode<`/$plant/${ModuleId}`> &
  SettingsLinks<`/settings/$companyId/${ModuleId}`, Settings> {
  const roots = {
    path: moduleId,
    plant: `/$plant/${moduleId}`,
    settings: `/settings/$companyId/${moduleId}`,
  };
  return linksAt(moduleId, roots, entries, sections) as never;
}

/**
 * Core's link manifest (ADR 0074). Core is the platform's own module, so its pages sit at the plant
 * root, /$plant/<entry>, and its settings section at the company settings root,
 * /settings/$companyId/<entry>, without the module id. linkEntry reads an empty path for the
 * manifest and for its settings section. Otherwise it builds as defineModuleLinks does.
 */
export function defineCoreLinks<
  const Entries extends LinkEntryDefinitions,
  const Settings extends LinkEntryDefinitions | undefined = undefined,
>(
  entries: Entries,
  sections?: ModuleLinkSections<Settings>,
): ModuleLinks<'/$plant', Entries> &
  LinkNode<'/$plant'> &
  SettingsLinks<'/settings/$companyId', Settings> {
  const roots = { path: '', plant: '/$plant', settings: '/settings/$companyId' };
  return linksAt('core', roots, entries, sections) as never;
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
