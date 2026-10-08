// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { given } from '../src/index.ts';

const uuidv7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('given', () => {
  it('E02-S02 given.plant() returns a fresh scope id on each call', () => {
    const plants = [given.plant(), given.plant()];

    expect(plants).toEqual([expect.stringMatching(uuidv7), expect.stringMatching(uuidv7)]);
    expect(plants[0]).not.toBe(plants[1]);
  });
});
