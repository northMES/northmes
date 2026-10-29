// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Every REST path comes from ApiController (ADR 0064). A global prefix or URI versioning would also
// move the root routes, and a root route missing from Nest's exclude list would move without an
// error.
const forbiddenMethods = new Set(['setGlobalPrefix', 'enableVersioning']);

// The lines of the calls of a forbidden method in one source file, read with the TypeScript parser
// so a call split across lines or made with optional chaining is found. A call's line is the line
// of the method name.
function forbiddenCallLines(path: string, source: string): number[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const lines: number[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      forbiddenMethods.has(node.expression.name.text)
    ) {
      const start = node.expression.name.getStart(file);
      lines.push(file.getLineAndCharacterOfPosition(start).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
}

// Whether a source file can call a forbidden method: its text holds a method name, or a unicode
// escape that could spell one. Parsing takes most of the scan's time, and the coverage counters of
// CI / test slow it several times, so only these files go through the parser. The check holds while
// forbiddenCallLines matches the method name as an identifier, whose only escape is \u; a check of
// another call form must widen this one too.
function mayCallForbiddenMethod(source: string): boolean {
  if (source.includes('\\u')) return true;
  for (const name of forbiddenMethods) if (source.includes(name)) return true;
  return false;
}

// Each call of setGlobalPrefix or enableVersioning in a source file under <base>/apps, as
// "<path>:<line>" with the path relative to base.
function globalPrefixCalls(base: string): string[] {
  const files = globSync('apps/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', {
    cwd: base,
    exclude: ['**/node_modules', '**/dist'],
  }).sort();

  return files.flatMap((path) => {
    const source = readFileSync(join(base, path), 'utf8');
    if (!mayCallForbiddenMethod(source)) return [];
    return forbiddenCallLines(path, source).map((line) => `${path}:${line}`);
  });
}

function writeFixture(base: string, path: string, content: string): void {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), content);
}

describe('no global prefix', () => {
  it('E02-S03 no file under apps calls app.setGlobalPrefix or app.enableVersioning', () => {
    expect(globalPrefixCalls(root)).toEqual([]);
  });

  it('E02-S03 a fixture call to app.setGlobalPrefix or app.enableVersioning under apps fails the check', () => {
    const base = mkdtempSync(join(tmpdir(), 'northmes-global-prefix-'));
    try {
      writeFixture(
        base,
        'apps/backend/src/main.ts',
        "const app = await NestFactory.create(AppModule);\napp.setGlobalPrefix('api');\n",
      );
      writeFixture(
        base,
        'apps/backend/src/versioning.ts',
        'export function version(app) {\n  app.enableVersioning({ type: VersioningType.URI });\n}\n',
      );

      expect(globalPrefixCalls(base)).toEqual([
        'apps/backend/src/main.ts:2',
        'apps/backend/src/versioning.ts:2',
      ]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('E02-S03 a fixture call split across lines fails the check at the line of the call', () => {
    const base = mkdtempSync(join(tmpdir(), 'northmes-global-prefix-'));
    try {
      writeFixture(
        base,
        'apps/backend/src/main.ts',
        [
          'const app = await NestFactory.create(AppModule);',
          'app.setGlobalPrefix',
          "  ('api');",
          'app?.enableVersioning?.',
          '  ({ type: VersioningType.URI });',
          '',
        ].join('\n'),
      );

      expect(globalPrefixCalls(base)).toEqual([
        'apps/backend/src/main.ts:2',
        'apps/backend/src/main.ts:4',
      ]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('E02-S03 a fixture call with a \\uXXXX or \\u{...} escape in the method name fails the check', () => {
    const base = mkdtempSync(join(tmpdir(), 'northmes-global-prefix-'));
    try {
      writeFixture(
        base,
        'apps/backend/src/main.ts',
        "const app = await NestFactory.create(AppModule);\napp.setGlobalPref\\u0069x('api');\n",
      );
      writeFixture(
        base,
        'apps/backend/src/versioning.ts',
        'export function version(app) {\n  app.enable\\u{56}ersioning({ type: VersioningType.URI });\n}\n',
      );

      expect(globalPrefixCalls(base)).toEqual([
        'apps/backend/src/main.ts:2',
        'apps/backend/src/versioning.ts:2',
      ]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
