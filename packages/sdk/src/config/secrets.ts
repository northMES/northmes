// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { registerAs } from '@nestjs/config';
import type { z } from 'zod';
import type { nodeEnv } from './keys.ts';

/** A secret is named by its _FILE key without the suffix. */
type SecretName<Key extends string> = Key extends `${infer Name}_FILE` ? Name : never;

/** The values of an entry point's secret files, by secret name. */
export type Secrets<Key extends `${string}_FILE` = `${string}_FILE`> = {
  readonly [K in Key as SecretName<K>]: string;
};

let secretsRead: Secrets | undefined;

/**
 * Reads the file each _FILE key points at and keeps the values for secretsConfig. The values stay
 * out of process.env (ADR 0060).
 */
export function readSecrets<Key extends `${string}_FILE`>(
  files: Readonly<Record<Key, string>>,
  _options: { nodeEnv: z.output<typeof nodeEnv> },
): Secrets<Key> {
  const secrets: Record<string, string> = {};
  for (const [key, path] of Object.entries<string>(files)) {
    // Editors and echo end a file with a newline, which is not part of the secret.
    secrets[key.replace(/_FILE$/, '')] = readFileSync(path, 'utf8').replace(/\n$/, '');
  }
  secretsRead = secrets;
  return secrets as Secrets<Key>;
}

/** The secrets namespace. Providers inject secretsConfig.KEY to get the values readSecrets read. */
export const secretsConfig = registerAs('secrets', (): Secrets => {
  if (secretsRead === undefined)
    throw new Error('readSecrets must run before the Nest app is created');
  return secretsRead;
});
