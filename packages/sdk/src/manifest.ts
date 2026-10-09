// SPDX-License-Identifier: MIT
import type { Type } from '@nestjs/common';

/**
 * The static part of a drop-in plugin. The host reads it without loading Nest code, so the
 * `server` entry is a lazy import (ADR 0003, ADR 0037). The modules that ship in the backend are
 * plain Nest modules and have no manifest (ADR 0070). The commands a plugin may validate are those
 * whose contract says validatable (ADR 0017), so a manifest lists no commands.
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
  /** Personal-data declarations, used for the GDPR register. */
  readonly personalData?: readonly {
    readonly table: string;
    readonly columns: readonly string[];
    readonly purpose: string;
  }[];
  /** The module has screens in the web app. Static facts the server reads without web code. */
  readonly web?: {
    readonly label: string;
    readonly permission?: string;
    /** Sidebar position. */
    readonly order: number;
    /** Slots this module owns, by slot id `<owner>/<area>/<name>/v<N>` (ADR 0068). */
    readonly slots?: Readonly<
      Record<string, { readonly kind: 'region' | 'tab' | 'field' | 'item' | 'banner' | 'action' }>
    >;
    /**
     * Contributions to slots this module owns or slots of modules in its dependsOn closure. The
     * module's web code supplies each implementation under the same id (ADR 0068).
     */
    readonly contributes?: readonly {
      /** Starts with the module id. */
      readonly id: string;
      readonly slot: string;
      readonly label: string;
      readonly order: number;
      readonly permission: string;
    }[];
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
