// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readdirSync, readFileSync } from 'node:fs';
import { inc, satisfies } from 'semver';
import { describe, expect, it } from 'vitest';

// The example plugins ship in the repository and build in lockstep with NorthMES (ADR 0038), so a
// release must not leave them outside their own NorthMES range: the server refuses to start a
// module whose range does not hold the image's version. Release 0.1.0 found the range <0.1.0-0.

const root = new URL('../../../', import.meta.url);
const version = (
  JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { version: string }
).version;
const examples = readdirSync(new URL('examples/', root)).filter((name) =>
  name.startsWith('plugin-'),
);

function rangeOf(example: string): string {
  const manifest = readFileSync(new URL(`examples/${example}/src/manifest.ts`, root), 'utf8');
  return /northmes: '([^']+)'/.exec(manifest)?.[1] ?? '';
}

describe('the example plugins', () => {
  it.each(examples)(
    'ADR0038 %s runs on this version, the next minor and the next patch',
    (example) => {
      const range = rangeOf(example);

      expect(range, `${example} declares a NorthMES range`).not.toBe('');
      for (const image of [version, inc(version, 'minor'), inc(version, 'patch')]) {
        expect(
          satisfies(image ?? '', range, { includePrerelease: true }),
          `${example} on ${image}`,
        ).toBe(true);
      }
    },
  );
});
