// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { moduleNames } from '@northmes/sdk';
import type { CatalogEntry } from '../catalog/check-catalog.ts';

/** What the server serves to browsers. */
export interface WebFiles {
  /** The NorthMES version of this build, which the module list reports. */
  readonly northmes: string;
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
  /** sha384- and the base64 SHA-384 of the remote's mf-manifest.json, or null without the file. */
  readonly integrity: string | null;
}

/** The web files of the app, which serveWeb hands over before the app initialises. */
@Injectable()
export class ServedWeb {
  #served?: { readonly northmes: string; readonly modules: readonly WebModuleEntry[] };

  /** Reads the remote manifest of each catalog module with a web block and hashes it. */
  serve({ northmes, catalog }: WebFiles): void {
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
          integrity: webDir === undefined ? null : integrityOf(join(webDir, 'mf-manifest.json')),
        },
      ];
    });
    this.#served = { northmes, modules };
  }

  get northmes(): string {
    return this.#servedOrThrow().northmes;
  }

  get modules(): readonly WebModuleEntry[] {
    return this.#servedOrThrow().modules;
  }

  #servedOrThrow() {
    if (!this.#served) throw new Error('serveWeb has not handed the web files to this app');
    return this.#served;
  }
}

function integrityOf(file: string): string | null {
  if (!existsSync(file)) return null;
  return `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;
}
