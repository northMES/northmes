// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { returnPathOf } from '../../src/auth/sign-in-link.ts';

const origin = 'https://northmes.example';

describe('returnPathOf', () => {
  it('E05-S05 a path on this origin keeps its search and hash', () => {
    expect(returnPathOf({ redirect: '/plant-a/quality?tab=open#late' }, origin)).toBe(
      '/plant-a/quality?tab=open#late',
    );
  });

  it('E05-S05 a return path with a tab after the slash falls back to the default page', () => {
    // The URL parser drops the tab, which leaves the protocol-relative //evil.example (audit W7).
    expect(returnPathOf({ redirect: '/\t/evil.example' }, origin)).toBe('/');
  });

  it('E05-S05 a full URL, a protocol-relative one or one with a backslash falls back to the default page', () => {
    for (const redirect of [
      'https://evil.example/',
      '//evil.example',
      '/\\evil.example',
      '//[evil',
      'javascript:alert(1)',
      'plant-a',
    ]) {
      expect(returnPathOf({ redirect }, origin), redirect).toBe('/');
    }
  });

  it('E05-S05 the sign-in page and a missing return path fall back to the default page', () => {
    expect(returnPathOf({ redirect: '/sign-in?redirect=%2Fplant-a' }, origin)).toBe('/');
    expect(returnPathOf({}, origin)).toBe('/');
  });
});
