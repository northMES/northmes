// SPDX-License-Identifier: MIT
import { readFileSync, statSync } from 'node:fs';
import { registerAs } from '@nestjs/config';
import type { z } from 'zod';
import { ConfigError } from './config-error.ts';
import type { nodeEnv } from './keys.ts';

/** A secret is named by its _FILE key without the suffix. */
type SecretName<Key extends string> = Key extends `${infer Name}_FILE` ? Name : never;

/** The values of an entry point's secret files, by secret name. */
export type Secrets<Key extends `${string}_FILE` = `${string}_FILE`> = {
  readonly [K in Key as SecretName<K>]: string;
};

/**
 * Starts every secret the stack script writes for development, so production can refuse one
 * (ADR 0058).
 */
export const DEV_SECRET_MARKER = 'northmes-dev-secret-';

let secretsRead: Secrets | undefined;

/** Reads one secret file, or states the rule it breaks without its path or content. */
function readSecretFile(path: string): { value: string } | { problem: string } {
  const stats = statSync(path, { throwIfNoEntry: false });
  if (stats === undefined) return { problem: 'must point at an existing file' };
  if (!stats.isFile()) return { problem: 'must point at a regular file' };
  // install.sh writes each secret 0440 for root and the app's group, so group read passes and
  // only read by others is refused (ADR 0047).
  if ((stats.mode & 0o004) !== 0) {
    return { problem: 'must point at a file that others cannot read, such as mode 0440 or 0600' };
  }
  // Editors and echo end a file with a newline, which is not part of the secret.
  const value = readFileSync(path, 'utf8').replace(/\n$/, '');
  if (value === '') return { problem: 'must point at a file that is not empty' };
  return { value };
}

/**
 * Reads the file each _FILE key points at and keeps the values for secretsConfig. A missing, empty
 * or other-readable file is listed in one ConfigError naming its key. Once every file reads, a dev
 * secret with NODE_ENV production fails with CONFIG_DEV_SECRET_IN_PRODUCTION. The values stay out
 * of process.env (ADR 0060).
 */
export function readSecrets<Key extends `${string}_FILE`>(
  files: Readonly<Record<Key, string>>,
  options: { nodeEnv: z.output<typeof nodeEnv> },
): Secrets<Key> {
  const secrets: Record<string, string> = {};
  const problems: string[] = [];
  const devSecretKeys: string[] = [];
  for (const [key, path] of Object.entries<string>(files)) {
    const file = readSecretFile(path);
    if ('problem' in file) {
      problems.push(`${key}: ${file.problem}`);
      continue;
    }
    secrets[key.replace(/_FILE$/, '')] = file.value;
    if (file.value.startsWith(DEV_SECRET_MARKER)) devSecretKeys.push(key);
  }
  if (problems.length > 0) throw new ConfigError(problems);
  if (options.nodeEnv === 'production' && devSecretKeys.length > 0) {
    throw new ConfigError(
      devSecretKeys.map((key) => `${key}: holds a dev secret, which NODE_ENV production refuses`),
      { code: 'CONFIG_DEV_SECRET_IN_PRODUCTION' },
    );
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
