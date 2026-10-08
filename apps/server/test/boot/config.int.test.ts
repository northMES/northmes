// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootBuilt } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Preloaded into the built server to list the specifiers it imports.
const recordImports = new URL('./record-imports.mjs', import.meta.url).href;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'northmes-boot-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('the built server', () => {
  it('E02-S01 an invalid environment exits 1 before any manifest import and lists every bad key', {
    timeout: 120_000,
  }, async () => {
    const importsFile = join(dir, 'imports.json');

    // NORTHMES_PUBLIC_ORIGIN is missing, and PORT and NORTHMES_ROLE are out of range.
    const { exitCode, stderr } = await bootBuilt({
      env: {
        NODE_OPTIONS: `--import=${recordImports}`,
        NM_TEST_IMPORTS_FILE: importsFile,
        NODE_ENV: 'production',
        NORTHMES_ROLE: 'web',
        PORT: '70000',
      },
    });
    const [header, ...problems] = stderr.trimEnd().split('\n');
    const imports = JSON.parse(readFileSync(importsFile, 'utf8')) as string[];

    expect(exitCode).toBe(1);
    expect(header).toBe('invalid configuration (3 problems)');
    expect(problems.map((problem) => problem.split(':')[0]).sort()).toEqual([
      '- NORTHMES_PUBLIC_ORIGIN',
      '- NORTHMES_ROLE',
      '- PORT',
    ]);
    expect(stderr).not.toContain('70000');
    expect(stderr).not.toMatch(/\bweb\b/);
    // The configuration code loaded, and no manifest did.
    expect(imports).toContain('@northmes/sdk/config');
    expect(imports.filter((specifier) => specifier.endsWith('/manifest'))).toEqual([]);
  });
});
