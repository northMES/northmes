import type { Type } from "@nestjs/common";

/**
 * The static part of a module or plugin. The host reads it without loading Nest code:
 * `server`, `mcp` are lazy. Core modules and plugins use the same shape.
 */
export interface ModuleManifest {
  /** kebab-case, [a-z][a-z0-9]*(-[a-z0-9]+)*. Derived names: see moduleNames(). */
  readonly id: string;
  readonly version: string;
  /** Semver range of NorthMES versions this module runs on. */
  readonly northmes: string;
  readonly dependsOn?: readonly string[];
  /** resource -> actions. Resource keys start with "<gqlName>.". */
  readonly permissions?: Readonly<Record<string, readonly string[]>>;
  /** Default role templates: role -> "resource:action" list. */
  readonly roles?: Readonly<Record<string, readonly string[]>>;
  /** Event types this module publishes, with payload schema version. */
  readonly events?: Readonly<Record<string, { readonly version: number }>>;
  /** Commands this module owns; validatable ones accept command validators from dependants. */
  readonly commands?: Readonly<Record<string, { readonly validatable?: boolean }>>;
  /** Personal-data declarations, used for the GDPR register. */
  readonly personalData?: readonly { readonly table: string; readonly columns: readonly string[]; readonly purpose: string }[];
  /** A web remote exists. Static facts the server needs before any browser code runs. */
  readonly web?: {
    readonly label: string;
    readonly permission?: string;
    /** Slot ids this module renders (owns). Others may contribute to them if they depend on it. */
    readonly slots?: readonly string[];
    /** Slot ids this module contributes to. */
    readonly contributes?: readonly string[];
  };
  readonly subscriptions?: boolean;
  /** Lazy server entry: default export is the Nest module. Absent for web-only plugins. */
  readonly server?: () => Promise<{ default: Type }>;
  /** Relative directory with *.sql files, default "migrations" when the folder exists. */
  readonly migrations?: string;
}

export function defineModule<M extends ModuleManifest>(manifest: M): M {
  return manifest;
}

export interface ModuleNames {
  readonly id: string;
  /** GraphQL subgraph name, root field prefix, permission and command prefix. */
  readonly gql: string;
  /** Postgres schema and role suffix. */
  readonly sql: string;
  /** Module Federation remote name (no hyphens allowed). */
  readonly remote: string;
}

export const MODULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function moduleNames(id: string): ModuleNames {
  if (!MODULE_ID.test(id)) throw new Error(`Invalid module id "${id}": use kebab-case [a-z][a-z0-9]*(-[a-z0-9]+)*`);
  const gql = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  return { id, gql, sql: id.replaceAll("-", "_"), remote: gql };
}
