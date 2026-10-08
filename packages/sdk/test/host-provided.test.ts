// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { isHostProvided } from '../src/host-provided.ts';

describe('isHostProvided', () => {
  it('E02-S01 isHostProvided matches @nestjs/core and graphql and not ms', () => {
    expect(isHostProvided('@nestjs/core')).toBe(true);
    expect(isHostProvided('graphql')).toBe(true);
    expect(isHostProvided('ms')).toBe(false);
  });
});
