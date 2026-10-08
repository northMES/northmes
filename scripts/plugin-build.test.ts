import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHostProvided } from '@northmes/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPlugin } from './plugin-build.mjs';

const exampleValidator = fileURLToPath(new URL('../examples/plugin-validator', import.meta.url));

describe('buildPlugin', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'plugin-build-'));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('E02-S04 plugin:build keeps every HOST_PROVIDED import external and bundles ms', async () => {
    const { files, imports } = await buildPlugin(exampleValidator, outDir);

    expect(files).toEqual(['dist/manifest.js', 'dist/server.js']);
    // The manifest imports defineModule and the server part imports Nest; both stay imports, and
    // ms, which the server part also imports, is not left as one.
    expect(imports).toEqual({
      'dist/manifest.js': ['@northmes/sdk'],
      'dist/server.js': ['@nestjs/common'],
    });
    for (const specifier of Object.values(imports).flat()) {
      expect(isHostProvided(specifier), specifier).toBe(true);
    }
    // ms throws this message for a value it cannot parse, so its code is inside the bundle.
    expect(readFileSync(join(exampleValidator, 'dist/server.js'), 'utf8')).toContain(
      'val is not a non-empty string or a valid number',
    );
  });
});
