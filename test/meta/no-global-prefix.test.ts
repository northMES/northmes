// SPDX-License-Identifier: AGPL-3.0-or-later
import { globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Every REST path comes from ApiController (ADR 0064). A global prefix or URI versioning would also
// move the root routes, and a root route missing from Nest's exclude list would move without an
// error. A call is the method name followed by an opening parenthesis, optional chaining included.
const forbiddenCall = /\b(?:setGlobalPrefix|enableVersioning)\s*(?:\?\.\s*)?\(/;

// Each call of setGlobalPrefix or enableVersioning in a source file under <base>/apps, as
// "<path>:<line>" with the path relative to base.
function globalPrefixCalls(base: string): string[] {
  const files = globSync('apps/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', {
    cwd: base,
    exclude: ['**/node_modules', '**/dist'],
  }).sort();

  return files.flatMap((path) =>
    readFileSync(join(base, path), 'utf8')
      .split('\n')
      .flatMap((line, index) => (forbiddenCall.test(line) ? [`${path}:${index + 1}`] : [])),
  );
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
        'apps/server/src/main.ts',
        "const app = await NestFactory.create(AppModule);\napp.setGlobalPrefix('api');\n",
      );
      writeFixture(
        base,
        'apps/server/src/versioning.ts',
        'export function version(app) {\n  app.enableVersioning({ type: VersioningType.URI });\n}\n',
      );

      expect(globalPrefixCalls(base)).toEqual([
        'apps/server/src/main.ts:2',
        'apps/server/src/versioning.ts:2',
      ]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
