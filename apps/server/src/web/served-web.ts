// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { moduleNames } from '@northmes/sdk';
import type { CatalogEntry } from '../catalog/check-catalog.ts';

/** What the server serves to browsers. */
export interface WebFiles {
  /** The NorthMES version of this build, which the module list reports. */
  readonly northmes: string;
  /** The folder of the built shell, which holds index.html. */
  readonly shellDir: string;
  /** The checked catalog in boot order. */
  readonly catalog: readonly CatalogEntry[];
}

/** One module in the web module list: what the shell needs to load its remote (ADR 0019). */
export interface WebModuleEntry {
  readonly id: string;
  readonly version: string;
  /** The Module Federation name of the remote. */
  readonly remoteName: string;
  readonly label: string;
  readonly order: number;
  readonly manifestUrl: string;
  /**
   * sha384- and the base64 SHA-384 of the remote's mf-manifest.json, or null when that file or a
   * file it lists is missing: the module is degraded.
   */
  readonly integrity: string | null;
}

/** The web files of the app, which serveWeb hands over before the app initialises. */
@Injectable()
export class ServedWeb {
  #served?: {
    readonly northmes: string;
    readonly shellDir: string;
    readonly modules: readonly WebModuleEntry[];
  };

  /**
   * Takes the web files over, checks the files that the remote manifest of each catalog module with
   * a web block lists and hashes the manifest, once: the files of a build do not change while the
   * server runs.
   */
  serve({ northmes, shellDir, catalog }: WebFiles): void {
    const modules = catalog.flatMap(({ manifest, webDir }) => {
      if (!manifest.web) return [];
      const { id, version } = manifest;
      return [
        {
          id,
          version,
          remoteName: moduleNames(id).remote,
          label: manifest.web.label,
          order: manifest.web.order,
          manifestUrl: `/modules/${id}/${version}/mf-manifest.json`,
          integrity: webDir === undefined ? null : integrityOf(webDir),
        },
      ];
    });
    this.#served = { northmes, shellDir, modules };
  }

  get northmes(): string {
    return this.#servedOrThrow().northmes;
  }

  get shellDir(): string {
    return this.#servedOrThrow().shellDir;
  }

  get modules(): readonly WebModuleEntry[] {
    return this.#servedOrThrow().modules;
  }

  #servedOrThrow() {
    if (!this.#served) throw new Error('serveWeb has not handed the web files to this app');
    return this.#served;
  }
}

/** The part of a Module Federation mf-manifest.json that names the files of the remote. */
interface RemoteManifest {
  readonly metaData: { readonly remoteEntry: { readonly name: string; readonly path: string } };
  readonly exposes: readonly {
    readonly assets: Readonly<
      Record<string, { readonly sync: readonly string[]; readonly async: readonly string[] }>
    >;
  }[];
}

/**
 * The integrity of the remote in webDir, or null when its manifest is missing or does not parse, or
 * a file it lists is missing or lies outside webDir, where the static mount never serves it.
 */
function integrityOf(webDir: string): string | null {
  const file = join(webDir, 'mf-manifest.json');
  if (!existsSync(file)) return null;
  const manifest = readFileSync(file);
  try {
    const listed = filesListedIn(JSON.parse(manifest.toString('utf8')));
    if (listed.some((path) => !servedFrom(webDir, path))) return null;
  } catch {
    // A manifest that is not JSON in the shape of RemoteManifest names no remote the shell can load.
    return null;
  }
  return `sha384-${createHash('sha384').update(manifest).digest('base64')}`;
}

/** Whether path, resolved against webDir, names a file inside webDir that exists. */
function servedFrom(webDir: string, path: string): boolean {
  const file = resolve(webDir, path);
  const inside = relative(webDir, file);
  const climbs = inside === '..' || inside.startsWith(`..${sep}`);
  return inside !== '' && !climbs && !isAbsolute(inside) && existsSync(file);
}

/** The remote entry and the JS and CSS of every exposed module, relative to the remote's folder. */
function filesListedIn({ metaData, exposes }: RemoteManifest): string[] {
  return [
    join(metaData.remoteEntry.path, metaData.remoteEntry.name),
    ...exposes.flatMap(({ assets }) =>
      Object.values(assets).flatMap(({ sync, async }) => [...sync, ...async]),
    ),
  ];
}
