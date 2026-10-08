// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import core from '@northmes/module-core/manifest';
import { satisfies } from 'semver';
import { describe, expect, it } from 'vitest';

function packageVersion(path: string): string {
  const url = new URL(`../../../${path}`, import.meta.url);
  return (JSON.parse(readFileSync(url, 'utf8')) as { version: string }).version;
}

describe('core manifest', () => {
  it('E02-S01 core northmes range accepts image version 0.0.0', () => {
    expect(satisfies('0.0.0', core.northmes), core.northmes).toBe(true);
  });

  it('E02-S01 core manifest version comes from its package.json', () => {
    expect(core.version).toBe(packageVersion('modules/core/package.json'));
  });
});
