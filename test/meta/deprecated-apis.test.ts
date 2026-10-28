// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, scanProjects } from '../../scripts/lint/deprecated-apis.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

// A finding as a failing test prints it: the file, the line, the column, the code and the message.
function describeFinding({
  path,
  line,
  column,
  code,
  message,
}: {
  path: string;
  line: number;
  column: number;
  code: number;
  message: string;
}) {
  return `${path}:${line}:${column} TS${code} ${message}`;
}

describe('deprecated-apis', () => {
  it('OSPS interfaces_current a use of a deprecated symbol or a deprecated overload fails naming the file and the line', () => {
    const findings = scan(root, [
      {
        path: 'apps/web/src/old.ts',
        text: [
          '/** @deprecated Use next. */',
          'export function old() {}',
          'export function next() {}',
          'export function pick(value: string): string;',
          '/** @deprecated Pass a string. */',
          'export function pick(value: number): string;',
          'export function pick(value: string | number) { return String(value); }',
          '',
        ].join('\n'),
      },
      {
        path: 'apps/web/src/screen.ts',
        text: [
          "import { next, old, pick } from './old.ts';",
          'old();',
          'next();',
          "pick('a');",
          'pick(1);',
          '',
        ].join('\n'),
      },
    ]);

    expect(findings.map(describeFinding)).toEqual([
      "apps/web/src/screen.ts:1:16 TS6385 'old' is deprecated.",
      "apps/web/src/screen.ts:2:1 TS6387 The signature '(): void' of 'old' is deprecated.",
      "apps/web/src/screen.ts:5:1 TS6387 The signature '(value: number): string' of 'pick' is deprecated.",
    ]);
  });

  it('OSPS interfaces_current a scan of tsconfig.json projects names each finding, in the order of the projects', async () => {
    const base = mkdtempSync(join(tmpdir(), 'northmes-deprecated-apis-'));
    try {
      const write = (path: string, lines: string[]) => {
        mkdirSync(dirname(join(base, path)), { recursive: true });
        writeFileSync(join(base, path), lines.join('\n'));
      };
      const tsconfig = JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          lib: ['es2022'],
          types: [],
        },
        include: ['src'],
      });
      for (const project of ['first', 'second']) {
        write(`${project}/tsconfig.json`, [tsconfig]);
        write(`${project}/src/old.ts`, [
          '/** @deprecated Use next. */',
          'export function old() {}',
          '',
        ]);
      }
      write('first/src/screen.ts', ["import { old } from './old.ts';", '']);
      write('second/src/screen.ts', ["import { old } from './old.ts';", '', 'old();', '']);

      const findings = await scanProjects(base, ['second/tsconfig.json', 'first/tsconfig.json']);

      expect(findings.map(describeFinding)).toEqual([
        "second/src/screen.ts:1:10 TS6385 'old' is deprecated.",
        "second/src/screen.ts:3:1 TS6387 The signature '(): void' of 'old' is deprecated.",
        "first/src/screen.ts:1:10 TS6385 'old' is deprecated.",
      ]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  }, 20_000);

  it('OSPS interfaces_current a project whose scan fails in its worker thread fails the scan, naming the tsconfig', async () => {
    // TypeScript's own message names the file by its absolute path; the scan's names the tsconfig
    // as it was given, before any message.
    await expect(scanProjects(root, ['examples/missing/tsconfig.json'])).rejects.toThrow(
      /^examples\/missing\/tsconfig\.json: /,
    );
  }, 20_000);

  it('OSPS interfaces_current the web and the example plugins use no deprecated API', async () => {
    const configs = [
      'apps/web/tsconfig.json',
      ...readdirSync(`${root}examples`)
        .filter((name) => existsSync(`${root}examples/${name}/tsconfig.json`))
        .map((name) => `examples/${name}/tsconfig.json`),
    ];

    expect((await scanProjects(root, configs)).map(describeFinding)).toEqual([]);
    // Without the coverage counters, the scan of the web and the four examples took 18 to 31 s in
    // CI / test.
  }, 60_000);
});
