import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHostProvided } from '@northmes/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPlugin, main } from './plugin-build.mjs';

const exampleValidator = fileURLToPath(new URL('../examples/plugin-validator', import.meta.url));

function write(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

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

describe('pnpm plugin:build', () => {
  let root: string;
  const lines: string[] = [];
  const errors: string[] = [];
  const io = () => ({
    log: (line: string) => lines.push(line),
    error: (line: string) => errors.push(line),
    root,
  });

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plugin-build-root-'));
    lines.length = 0;
    errors.length = 0;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('E02-S04 plugin:build copies the package and its migrations to plugins/<id>/', async () => {
    // A plugin that imports only host-provided packages, so it builds outside the workspace.
    const plugin = join(root, 'examples/plugin-labels');
    const packageJson = `${JSON.stringify({ name: '@northmes/example-labels', version: '0.0.0', type: 'module' })}\n`;
    const migration = 'create table example_labels.label (id uuid primary key);\n';
    write(join(plugin, 'package.json'), packageJson);
    write(
      join(plugin, 'src/manifest.ts'),
      "import { defineModule } from '@northmes/sdk';\nexport default defineModule({ id: 'example-labels', version: '0.0.0', northmes: '>=0.0.0-0 <0.1.0-0', server: () => import('./server.ts') });\n",
    );
    write(join(plugin, 'src/server.ts'), 'export default class ExampleLabelsModule {}\n');
    write(join(plugin, 'migrations/20261008120000_label.sql'), migration);
    // A file an earlier build left, which the new build does not write.
    write(join(root, 'plugins/example-labels/dist/old.js'), '');

    const exitCode = await main(['example-labels'], io());

    const installed = join(root, 'plugins/example-labels');
    expect(exitCode).toBe(0);
    expect(readdirSync(installed, { recursive: true }).sort()).toEqual([
      'dist',
      'dist/manifest.js',
      'dist/server.js',
      'migrations',
      'migrations/20261008120000_label.sql',
      'package.json',
    ]);
    expect(readFileSync(join(installed, 'package.json'), 'utf8')).toBe(packageJson);
    expect(readFileSync(join(installed, 'migrations/20261008120000_label.sql'), 'utf8')).toBe(
      migration,
    );
    expect(readFileSync(join(installed, 'dist/server.js'), 'utf8')).toContain(
      'ExampleLabelsModule',
    );
    expect(lines).toEqual(['Built examples/plugin-labels into plugins/example-labels']);
    expect(errors).toEqual([]);
  });
});
