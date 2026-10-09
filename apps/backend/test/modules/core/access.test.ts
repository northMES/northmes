// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  accessOf,
  atPlant,
  can,
  canOpen,
  type ScopeGrant,
} from '../../../src/modules/core/core/access/access.ts';

// One company with plants A and B, and an area below plant A, so the walk has three levels.
const company = '019a0000-0000-7000-8000-000000000c01';
const plantA = '019a0000-0000-7000-8000-000000000a01';
const plantB = '019a0000-0000-7000-8000-000000000b01';
const areaA = '019a0000-0000-7000-8000-000000000a02';

/** The company's tree, with `granted` naming the permissions held directly at each node. */
function tree(granted: Readonly<Record<string, readonly string[]>> = {}): ScopeGrant[] {
  return [
    { id: company, parentId: null, permissions: granted[company] ?? [] },
    { id: plantA, parentId: company, permissions: granted[plantA] ?? [] },
    { id: plantB, parentId: company, permissions: granted[plantB] ?? [] },
    { id: areaA, parentId: plantA, permissions: granted[areaA] ?? [] },
  ];
}

const planner = ['core.article:read', 'core.article:update'];
const viewer = ['core.article:read'];

describe('can()', () => {
  it('E05-S06 a permission held at a scope holds at that scope and every scope below it', () => {
    const access = accessOf(tree({ [plantA]: planner }));

    expect(can(access, 'core.article:update', plantA)).toBe(true);
    expect(can(access, 'core.article:update', areaA)).toBe(true);
  });

  it('E05-S06 a permission held at a plant does not hold at its sibling or at the company above it', () => {
    const access = accessOf(tree({ [plantA]: planner }));

    expect(can(access, 'core.article:update', plantB)).toBe(false);
    expect(can(access, 'core.article:update', company)).toBe(false);
  });

  it('E05-S06 a company assignment holds at every plant', () => {
    const access = accessOf(tree({ [company]: viewer }));

    expect(can(access, 'core.article:read', plantA)).toBe(true);
    expect(can(access, 'core.article:read', plantB)).toBe(true);
    expect(can(access, 'core.article:update', plantB)).toBe(false);
  });

  it("E05-S06 a scope outside the principal's companies grants nothing", () => {
    const access = accessOf(tree({ [company]: planner }));

    expect(can(access, 'core.article:read', '019a0000-0000-7000-8000-00000000ffff')).toBe(false);
  });
});

describe('the scope sets of a principal', () => {
  it('E05-S04 a company role reads and writes the company and every plant', () => {
    const { readScopes, writeScopes } = accessOf(tree({ [company]: planner }));

    expect(readScopes).toEqual([company, plantA, areaA, plantB].sort());
    expect(writeScopes).toEqual([company, plantA, areaA, plantB].sort());
  });

  it('E05-S04 a plant planner reads the company above its plant, and writes its plant alone', () => {
    const { readScopes, writeScopes } = accessOf(tree({ [plantA]: planner }));

    expect(readScopes).toEqual([company, plantA, areaA].sort());
    expect(writeScopes).toEqual([plantA, areaA].sort());
  });

  it('E05-S04 a viewer writes nothing', () => {
    const { readScopes, writeScopes } = accessOf(tree({ [plantA]: viewer }));

    expect(readScopes).toEqual([company, plantA, areaA].sort());
    expect(writeScopes).toEqual([]);
  });

  it('E05-S04 a principal without assignments reads and writes nothing', () => {
    expect(accessOf([])).toMatchObject({ readScopes: [], writeScopes: [] });
  });
});

describe('the scope sets of a request at one plant (ADR 0008)', () => {
  it('E05-S04 a company role reads and writes the company and the request plant, and no other plant', () => {
    const { readScopes, writeScopes } = atPlant(accessOf(tree({ [company]: planner })), plantB);

    expect(readScopes).toEqual([company, plantB].sort());
    expect(writeScopes).toEqual([company, plantB].sort());
  });

  it('E05-S04 a planner at both plants reads the company and the request plant with its area, and writes the plant and its area', () => {
    const access = accessOf(tree({ [plantA]: planner, [plantB]: planner }));

    const { readScopes, writeScopes } = atPlant(access, plantA);

    expect(readScopes).toEqual([company, plantA, areaA].sort());
    expect(writeScopes).toEqual([plantA, areaA].sort());
  });

  it('E05-S04 a viewer at the request plant writes nothing', () => {
    const { readScopes, writeScopes } = atPlant(accessOf(tree({ [plantA]: viewer })), plantA);

    expect(readScopes).toEqual([company, plantA, areaA].sort());
    expect(writeScopes).toEqual([]);
  });

  it('E05-S04 a request without a plant reads and writes nothing', () => {
    const access = accessOf(tree({ [company]: planner }));

    expect(atPlant(access, undefined)).toMatchObject({ readScopes: [], writeScopes: [] });
  });

  it('E05-S03 a user can open a plant where it, or its company, holds a role, and no other', () => {
    const access = accessOf(tree({ [plantA]: viewer }));
    const companyWide = accessOf(tree({ [company]: viewer }));

    expect(canOpen(access, plantA)).toBe(true);
    expect(canOpen(access, plantB)).toBe(false);
    expect(canOpen(companyWide, plantB)).toBe(true);
  });
});
