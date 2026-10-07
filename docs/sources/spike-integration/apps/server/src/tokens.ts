import type { Type } from "@nestjs/common";
import type { InstalledModule } from "./catalog.js";

export const CATALOG = "northmes:catalog";

export interface LoadedCatalog {
  readonly ordered: readonly InstalledModule[];
  /** Nest module class of each module with a server part, by module id. */
  readonly serverModules: ReadonlyMap<string, Type>;
  readonly dependencyClosure: (id: string) => Set<string>;
  readonly northmesVersion: string;
}
