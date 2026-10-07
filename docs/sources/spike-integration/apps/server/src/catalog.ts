import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import semver from "semver";
import { type ModuleManifest, type ModuleNames, moduleNames } from "@northmes/sdk";

export interface NorthmesConfig {
  readonly northmes: string;
  /** In-repo modules, resolved as packages from the host. */
  readonly modules: readonly string[];
  /** Plugin package directories (built output), relative to the config file. */
  readonly plugins: readonly string[];
}

export interface InstalledModule {
  readonly manifest: ModuleManifest;
  readonly names: ModuleNames;
  readonly dir: string;
  readonly kind: "module" | "plugin";
  readonly migrationFiles: readonly string[];
}

export function readConfig(file: string): NorthmesConfig & { baseDir: string } {
  return { ...JSON.parse(readFileSync(file, "utf8")), baseDir: dirname(file) };
}

const require = createRequire(import.meta.url);

function packageDirOf(spec: string, baseDir: string): string {
  if (spec.startsWith(".") || isAbsolute(spec)) return resolve(baseDir, spec);
  return dirname(require.resolve(`${spec}/package.json`));
}

/** Imports every manifest. Manifests are small: they import only defineModule from the SDK. */
export async function loadCatalog(config: NorthmesConfig & { baseDir: string }): Promise<InstalledModule[]> {
  const entries = [
    ...config.modules.map((spec) => ({ spec, kind: "module" as const })),
    ...config.plugins.map((spec) => ({ spec, kind: "plugin" as const })),
  ];
  const out: InstalledModule[] = [];
  for (const { spec, kind } of entries) {
    const dir = packageDirOf(spec, config.baseDir);
    const pkgFile = join(dir, "package.json");
    if (!existsSync(pkgFile)) throw new Error(`${kind} "${spec}": no package.json in ${dir}`);
    const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
    const manifestPath = pkg.exports?.["./manifest"];
    if (typeof manifestPath !== "string") throw new Error(`${kind} "${spec}": package.json has no exports["./manifest"]`);
    const mod = await import(pathToFileURL(join(dir, manifestPath)).href);
    const manifest = mod.default as ModuleManifest;
    const migrationsDir = join(dir, manifest.migrations ?? "migrations");
    const migrationFiles = existsSync(migrationsDir)
      ? readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort().map((f) => join(migrationsDir, f))
      : [];
    out.push({ manifest, names: moduleNames(manifest.id), dir, kind, migrationFiles });
  }
  return out;
}

/**
 * Hard checks before any Nest code runs. Returns modules in dependency order (core first)
 * and every error found, so one boot shows all problems at once.
 */
export function checkCatalog(mods: readonly InstalledModule[], northmesVersion: string) {
  const errors: string[] = [];
  const byId = new Map<string, InstalledModule>();
  const seenNames = new Map<string, string>();
  for (const m of mods) {
    if (byId.has(m.manifest.id)) errors.push(`${m.manifest.id}: installed twice`);
    byId.set(m.manifest.id, m);
    for (const derived of [m.names.gql, m.names.sql]) {
      const prev = seenNames.get(derived);
      if (prev && prev !== m.manifest.id) errors.push(`${m.manifest.id}: derived name "${derived}" collides with ${prev}`);
      seenNames.set(derived, m.manifest.id);
    }
    if (!semver.satisfies(northmesVersion, m.manifest.northmes)) {
      errors.push(`${m.manifest.id} ${m.manifest.version} supports NorthMES ${m.manifest.northmes}; this installation runs ${northmesVersion}`);
    }
    for (const key of [...Object.keys(m.manifest.permissions ?? {}), ...Object.keys(m.manifest.commands ?? {}), ...Object.keys(m.manifest.events ?? {})]) {
      const prefix = key.startsWith(`${m.names.gql}.`) || key.startsWith(`${m.names.sql}.`);
      if (!prefix) errors.push(`${m.manifest.id}: "${key}" must start with "${m.names.gql}."`);
    }
  }
  for (const m of mods) {
    for (const dep of m.manifest.dependsOn ?? []) {
      const target = byId.get(dep);
      if (!target) errors.push(`${m.manifest.id} depends on "${dep}", which is not installed`);
      else if (m.kind === "module" && target.kind === "plugin") errors.push(`core module ${m.manifest.id} must not depend on plugin ${dep}`);
    }
  }
  // Topological order; ties broken by kind (modules first) then id, so the order is stable.
  const ordered: InstalledModule[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (m: InstalledModule, path: string[]) => {
    const s = state.get(m.manifest.id);
    if (s === "done") return;
    if (s === "visiting") {
      errors.push(`dependency cycle: ${[...path, m.manifest.id].join(" -> ")}`);
      return;
    }
    state.set(m.manifest.id, "visiting");
    for (const dep of [...(m.manifest.dependsOn ?? [])].sort()) {
      const target = byId.get(dep);
      if (target) visit(target, [...path, m.manifest.id]);
    }
    state.set(m.manifest.id, "done");
    ordered.push(m);
  };
  const sorted = [...mods].sort((a, b) => (a.kind === b.kind ? a.manifest.id.localeCompare(b.manifest.id) : a.kind === "module" ? -1 : 1));
  const core = sorted.find((m) => m.manifest.id === "core");
  if (core) visit(core, []);
  else errors.push(`module "core" is not installed`);
  for (const m of sorted) visit(m, []);
  // Slots: a module may contribute only to slots owned by a module it depends on (transitively).
  const closure = (id: string, acc = new Set<string>()): Set<string> => {
    for (const d of byId.get(id)?.manifest.dependsOn ?? []) if (!acc.has(d)) { acc.add(d); closure(d, acc); }
    return acc;
  };
  const slotOwner = new Map<string, string>();
  for (const m of mods) for (const s of m.manifest.web?.slots ?? []) slotOwner.set(s, m.manifest.id);
  for (const m of mods) {
    for (const s of m.manifest.web?.contributes ?? []) {
      const owner = slotOwner.get(s);
      if (!owner) errors.push(`${m.manifest.id} contributes to unknown slot "${s}"`);
      else if (owner !== m.manifest.id && !closure(m.manifest.id).has(owner)) {
        errors.push(`${m.manifest.id} contributes to slot "${s}" of ${owner} but does not depend on it`);
      }
    }
  }
  return { ordered, errors, dependencyClosure: (id: string) => closure(id) };
}
