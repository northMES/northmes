// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, scanProject } from '../../scripts/lint/deprecated-apis.mjs';

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

  it('OSPS interfaces_current the web and the example plugins use no deprecated API', () => {
    const configs = [
      'apps/web/tsconfig.json',
      ...readdirSync(`${root}examples`)
        .filter((name) => existsSync(`${root}examples/${name}/tsconfig.json`))
        .map((name) => `examples/${name}/tsconfig.json`),
    ];

    expect(configs.flatMap((config) => scanProject(root, config)).map(describeFinding)).toEqual([]);
    // A language service per tsconfig type-checks each project, which takes up to 35 s on a CI
    // runner for the web and the four examples.
  }, 60_000);
});
