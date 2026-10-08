// SPDX-License-Identifier: MIT
import type { Type } from '@nestjs/common';

/**
 * The static part of a module or plugin. The host reads it without loading Nest code, so the
 * `server` entry is a lazy import. Core modules and plugins use the same shape (ADR 0003).
 */
export interface ModuleManifest {
  /** kebab-case, [a-z][a-z0-9]*(-[a-z0-9]+)*. Derived names: see moduleNames(). */
  readonly id: string;
  /** Imported from the module's own package.json. */
  readonly version: string;
  /** Semver range of NorthMES versions this module runs on. */
  readonly northmes: string;
  /** Ids of the modules this module depends on. */
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
  readonly personalData?: readonly {
    readonly table: string;
    readonly columns: readonly string[];
    readonly purpose: string;
  }[];
  /** A web remote exists. Static facts the server needs before any browser code runs. */
  readonly web?: {
    readonly label: string;
    readonly permission?: string;
    /** Sidebar position, kept when the remote fails to load. */
    readonly order: number;
  };
  /** Whether the module serves GraphQL subscriptions. */
  readonly subscriptions?: boolean;
  /** Lazy server entry: the default export is the module's Nest module. */
  readonly server?: () => Promise<{ default: Type }>;
}

/**
 * Declares a module manifest and keeps its literal type.
 *
 * @internal Release 1 ships defineModule as an internal contract (ADR 0003).
 */
export function defineModule<M extends ModuleManifest>(manifest: M): M {
  return manifest;
}
