// SPDX-License-Identifier: MIT
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { readSecrets, secretsConfig } from '@northmes/sdk/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configErrorOf, keysOf } from './config-error.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'northmes-secrets-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes a secret file and returns its path. chmod sets the mode, so the umask cannot change it. */
function secretFile(name: string, content: string, mode = 0o440): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  chmodSync(path, mode);
  return path;
}

describe('readSecrets', () => {
  it('E02-S01 a 0440 secret file passes and its value stays out of process.env', async () => {
    const value = 'auth-secret-5f2c9a71';

    const secrets = readSecrets(
      { NORTHMES_AUTH_SECRET_FILE: secretFile('auth_secret', value) },
      { nodeEnv: 'production' },
    );
    const app = await NestFactory.createApplicationContext(
      ConfigModule.forRoot({ ignoreEnvFile: true, load: [secretsConfig] }),
      { logger: false },
    );

    expect(secrets).toEqual({ NORTHMES_AUTH_SECRET: value });
    expect(app.get(secretsConfig.KEY)).toEqual({ NORTHMES_AUTH_SECRET: value });
    expect(Object.values(process.env).filter((env) => env?.includes(value))).toEqual([]);
    await app.close();
  });

  it('E02-S01 one trailing newline is trimmed', () => {
    const secrets = readSecrets(
      {
        NORTHMES_DB_APP_PASSWORD_FILE: secretFile('db_app_password', 'app-pw-81c4\n'),
        NORTHMES_DB_AUTH_PASSWORD_FILE: secretFile('db_auth_password', 'auth-pw-27e9\n\n'),
      },
      { nodeEnv: 'production' },
    );

    expect(secrets).toEqual({
      NORTHMES_DB_APP_PASSWORD: 'app-pw-81c4',
      NORTHMES_DB_AUTH_PASSWORD: 'auth-pw-27e9\n',
    });
  });

  it('E02-S01 a missing, empty or world-readable secret file fails naming its key', () => {
    const files = {
      NORTHMES_DB_APP_PASSWORD_FILE: join(dir, 'db_app_password'),
      NORTHMES_DB_AUTH_PASSWORD_FILE: secretFile('db_auth_password', ''),
      NORTHMES_AUTH_SECRET_FILE: secretFile('auth_secret', 'auth-secret-0d3e', 0o444),
      NORTHMES_INSTALLATION_KEY_FILE: secretFile('installation_key', 'install-key-6b18', 0o640),
    };

    const error = configErrorOf(() => readSecrets(files, { nodeEnv: 'production' }));

    expect(keysOf(error)).toEqual([
      'NORTHMES_AUTH_SECRET_FILE',
      'NORTHMES_DB_APP_PASSWORD_FILE',
      'NORTHMES_DB_AUTH_PASSWORD_FILE',
    ]);
    expect(error.message).not.toContain(dir);
    expect(error.message).not.toContain('auth-secret-0d3e');
  });
});
