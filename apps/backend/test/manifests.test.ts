// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { satisfies } from 'semver';
import { describe, expect, it } from 'vitest';
import core from '../src/modules/core/northmes.module.ts';
import planning from '../src/modules/planning/northmes.module.ts';

function packageVersion(path: string): string {
  const url = new URL(`../../../${path}`, import.meta.url);
  return (JSON.parse(readFileSync(url, 'utf8')) as { version: string }).version;
}

describe('core manifest', () => {
  it('E02-S01 core northmes range accepts image version 0.0.0', () => {
    expect(satisfies('0.0.0', core.northmes), core.northmes).toBe(true);
  });

  it("E02-S01 core manifest version is the backend's version", () => {
    expect(core.version).toBe(packageVersion('apps/backend/package.json'));
  });
});

describe('planning manifest', () => {
  it('E02-S01 planning depends on core', () => {
    expect(planning.dependsOn).toEqual(['core']);
  });

  it('E02-S01 planning northmes range accepts image version 0.0.0', () => {
    expect(satisfies('0.0.0', planning.northmes), planning.northmes).toBe(true);
  });

  it('E02-S01 planning declares planning.releaseProductionOrder validatable', () => {
    expect(planning.commands?.['planning.releaseProductionOrder']).toEqual({ validatable: true });
  });

  it('E02-S01 planning has a web block with a label and an order', () => {
    expect(planning.web).toMatchObject({ label: 'Planning', order: expect.any(Number) });
  });
});
