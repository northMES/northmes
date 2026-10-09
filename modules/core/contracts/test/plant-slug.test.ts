// SPDX-License-Identifier: MIT
import { plantSlug, reservedPlantSlugs } from '@northmes/core-contracts';
import { describe, expect, it } from 'vitest';

describe('plant slug', () => {
  it('E05-S03 slug hel is accepted', () => {
    expect(plantSlug.safeParse('hel')).toMatchObject({ success: true, data: 'hel' });
    expect(plantSlug.safeParse('plant-2')).toMatchObject({ success: true });
  });

  it('E05-S03 slugs api, graphql, mcp, health, modules, assets, station, settings, admin and sign-in are refused', () => {
    const reserved = [
      'api',
      'graphql',
      'mcp',
      'health',
      'modules',
      'assets',
      'station',
      'settings',
      'admin',
      'sign-in',
    ];

    expect([...reservedPlantSlugs].sort()).toEqual([...reserved].sort());
    for (const slug of reserved) {
      expect(plantSlug.safeParse(slug).success, slug).toBe(false);
    }
  });

  it('E05-S03 a slug is lower-case letters and digits in words joined by single hyphens, up to 40 characters', () => {
    for (const slug of ['', 'Hel', 'hel_1', '-hel', 'hel-', 'h--el', 'h el', 'a'.repeat(41)]) {
      expect(plantSlug.safeParse(slug).success, slug).toBe(false);
    }
    expect(plantSlug.safeParse('a'.repeat(40)).success).toBe(true);
  });
});
