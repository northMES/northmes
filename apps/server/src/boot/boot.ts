// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { ModuleManifest } from '@northmes/sdk';
import { AppModule } from '../app.module.ts';
import { type CatalogEntry, checkCatalog } from '../catalog/check-catalog.ts';
import { inRepoManifests } from '../modules.ts';

export interface BootOptions {
  /** The environment the server runs with. main.ts passes process.env. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Imports the manifest module that a specifier names. main.ts passes a dynamic import. */
  readonly importManifest: (specifier: string) => Promise<{ default: ModuleManifest }>;
  /** Ends the process with an exit code. main.ts passes process.exit. */
  readonly exit: (code: number) => void;
  /** Where boot writes its lines: progress to info, problems to error. main.ts passes console. */
  readonly log: { info(line: string): void; error(line: string): void };
}

/** The NorthMES version of this build, from the server's package.json. */
function imageVersion(): string {
  const packageJson = new URL('../../package.json', import.meta.url);
  return (JSON.parse(readFileSync(packageJson, 'utf8')) as { version: string }).version;
}

/** Boots the server in the order of ADR 0002 and returns the listening app. */
export async function boot({ env, importManifest, log }: BootOptions): Promise<INestApplication> {
  const entries: CatalogEntry[] = [];
  for (const specifier of inRepoManifests) {
    const { default: manifest } = await importManifest(specifier);
    entries.push({ manifest, kind: 'module' });
  }
  const catalog = checkCatalog(entries, { imageVersion: imageVersion() });
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  await app.listen(Number(env.PORT), '127.0.0.1');
  log.info(`Modules in boot order: ${catalog.map((entry) => entry.manifest.id).join(', ')}`);
  log.info(`Listening on ${await app.getUrl()}`);
  return app;
}
