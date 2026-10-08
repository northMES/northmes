// SPDX-License-Identifier: MIT

/** One entry of a module's link manifest: its path below the parent entry, and its child entries. */
export interface LinkEntryDefinition {
  readonly path: string;
  readonly children?: LinkEntryDefinitions;
}

export type LinkEntryDefinitions = Readonly<Record<string, LinkEntryDefinition>>;

/** What a link builder returns: the route pattern and params for the router, and the finished href. */
export interface ModuleLink {
  readonly to: string;
  readonly params: Readonly<Record<string, string>>;
  readonly href: string;
}

export type LinkBuilder = (params: Readonly<Record<string, string>>) => ModuleLink;

export type ModuleLinks = { readonly [name: string]: LinkBuilder & ModuleLinks };

/**
 * A module's link manifest (ADR 0062). Each entry becomes a builder that takes the params of its
 * route pattern, which starts with /$plant/<moduleId>, and returns the link. The builders are plain
 * functions, so code without a router (server code, MCP tools, end-to-end specs) can call them.
 */
export function defineModuleLinks(moduleId: string, entries: LinkEntryDefinitions): ModuleLinks {
  return builders(`/$plant/${moduleId}`, entries);
}

function builders(parent: string, entries: LinkEntryDefinitions): ModuleLinks {
  return Object.fromEntries(
    Object.entries(entries).map(([name, entry]) => {
      const pattern = `${parent}/${entry.path}`;
      const build: LinkBuilder = (params) => ({
        to: pattern,
        params,
        href: href(pattern, params),
      });
      return [name, Object.assign(build, builders(pattern, entry.children ?? {}))];
    }),
  );
}

function href(pattern: string, params: Readonly<Record<string, string>>): string {
  return pattern
    .split('/')
    .map((segment) =>
      segment.startsWith('$') ? param(pattern, segment.slice(1), params) : segment,
    )
    .join('/');
}

// The encoded value of one param. An empty value throws, because the href would lose the segment.
function param(pattern: string, name: string, params: Readonly<Record<string, string>>): string {
  const value = params[name];
  if (!value) {
    throw new Error(`Link ${pattern} has an empty value for ${name}`);
  }
  return encodeURIComponent(value);
}
