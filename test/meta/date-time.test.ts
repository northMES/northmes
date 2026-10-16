// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, staleEntries, trackedFiles } from '../../scripts/lint/date-time.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

interface Finding {
  path: string;
  line: number;
  use: string;
}

interface AllowlistEntry {
  path: string;
  use: string;
  reason?: string;
}

// A finding as a failing check prints it: file, line and use.
function describeFinding({ path, line, use }: Finding): string {
  return `${path}:${line}: ${use}`;
}

function readAllowlist(): AllowlistEntry[] {
  return JSON.parse(readFileSync(`${root}scripts/lint/date-time.allow.json`, 'utf8'));
}

describe('date-time', () => {
  it('new Date, Date(), Date.parse and Date.UTC fail, and Date.now passes', () => {
    const text = [
      'export function window(iso: string, now: () => number = Date.now) {',
      '  const start = new Date(iso);',
      '  const label = Date();',
      '  const end = Date.parse(iso) + Date.UTC(2026, 9, 25);',
      '  return { start, label, end, at: now(), stamp: Date.now() };',
      '}',
      '',
    ].join('\n');

    const findings = scan([{ path: 'apps/backend/src/modules/core/core/window.ts', text }], []);

    expect(findings).toEqual([
      { path: 'apps/backend/src/modules/core/core/window.ts', line: 2, use: 'new Date' },
      { path: 'apps/backend/src/modules/core/core/window.ts', line: 3, use: 'Date()' },
      { path: 'apps/backend/src/modules/core/core/window.ts', line: 4, use: 'Date.parse' },
      { path: 'apps/backend/src/modules/core/core/window.ts', line: 4, use: 'Date.UTC' },
    ]);
  });

  it('the Temporal global fails in a call, a type and through globalThis', () => {
    const text = [
      'export function today(at: Temporal.Instant): string {',
      '  const native = globalThis.Temporal !== undefined;',
      "  return native ? Temporal.Now.plainDateISO('UTC').toString() : at.toString();",
      '}',
      '',
    ].join('\n');

    const findings = scan([{ path: 'packages/contracts/src/today.ts', text }], []);

    expect(findings).toEqual([
      { path: 'packages/contracts/src/today.ts', line: 1, use: 'Temporal' },
      { path: 'packages/contracts/src/today.ts', line: 2, use: 'Temporal' },
      { path: 'packages/contracts/src/today.ts', line: 3, use: 'Temporal' },
    ]);
  });

  it('an import of another date library fails, and an import of luxon passes', () => {
    const text = [
      "import { DateTime } from 'luxon';",
      "import 'temporal-polyfill/global';",
      "import { addDays } from 'date-fns';",
      "import { TZDate } from '@date-fns/tz';",
      "import dayjs from 'dayjs';",
      "const moment = require('moment-timezone');",
      "const { Temporal: Polyfill } = await import('@js-temporal/polyfill');",
      '',
    ].join('\n');

    const findings = scan([{ path: 'examples/plugin-validator/src/dates.ts', text }], []);

    expect(findings).toEqual([
      { path: 'examples/plugin-validator/src/dates.ts', line: 2, use: 'import temporal-polyfill' },
      { path: 'examples/plugin-validator/src/dates.ts', line: 3, use: 'import date-fns' },
      { path: 'examples/plugin-validator/src/dates.ts', line: 4, use: 'import @date-fns/tz' },
      { path: 'examples/plugin-validator/src/dates.ts', line: 5, use: 'import dayjs' },
      { path: 'examples/plugin-validator/src/dates.ts', line: 6, use: 'import moment-timezone' },
      { path: 'examples/plugin-validator/src/dates.ts', line: 7, use: 'Temporal' },
      {
        path: 'examples/plugin-validator/src/dates.ts',
        line: 7,
        use: 'import @js-temporal/polyfill',
      },
    ]);
  });

  it('comments, strings and files outside the scanned folders are not findings', () => {
    const code = [
      '// new Date() and Temporal.Now are named here only in a comment.',
      "export const hint = 'Date.parse(text) and Temporal.Instant';",
      '',
    ].join('\n');

    const findings = scan(
      [
        { path: 'apps/web/src/ui/lib/hint.ts', text: code },
        { path: 'docs/sources/tz-spike/t1.mjs', text: 'const at = new Date();\n' },
        { path: 'apps/web/README.md', text: '`new Date()`\n' },
      ],
      [],
    );

    expect(findings).toEqual([]);
  });

  it('an allowlisted use with a reason passes, and an entry without a reason fails the check', () => {
    const files = [
      { path: 'apps/backend/src/auth.ts', text: 'export const at = new Date(Date.parse(text));\n' },
    ];

    const findings = scan(files, [
      { path: 'apps/backend/src/auth.ts', use: 'new Date', reason: 'better-auth takes a Date' },
    ]);

    expect(findings).toEqual([{ path: 'apps/backend/src/auth.ts', line: 1, use: 'Date.parse' }]);
    expect(() => scan(files, [{ path: 'apps/backend/src/auth.ts', use: 'new Date' }])).toThrow(
      /apps\/backend\/src\/auth\.ts new Date has no reason/,
    );
  });

  it('an allowlist entry that matches no use is stale', () => {
    const files = [{ path: 'apps/web/src/a.ts', text: 'export const a = new Date();\n' }];
    const allowlist = [
      { path: 'apps/web/src/a.ts', use: 'new Date', reason: 'a fixture' },
      { path: 'apps/web/src/b.ts', use: 'Date.parse', reason: 'a fixture' },
    ];

    expect(staleEntries(files, allowlist)).toEqual([
      { path: 'apps/web/src/b.ts', use: 'Date.parse', reason: 'a fixture' },
    ]);
  });

  it('no tracked file uses Date or Temporal for date math or another date library outside the allowlist', () => {
    const findings = scan(trackedFiles(root), readAllowlist()).map(describeFinding);

    expect(findings).toEqual([]);
  });

  it('every allowlist entry still matches a use in the repository', () => {
    expect(staleEntries(trackedFiles(root), readAllowlist())).toEqual([]);
  });
});
