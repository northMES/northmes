// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { HOST_PROVIDED, isHostProvided } from '../src/host-provided.ts';

describe('isHostProvided', () => {
  it('E02-S01 isHostProvided matches @nestjs/core and graphql and not ms', () => {
    expect(isHostProvided('@nestjs/core')).toBe(true);
    expect(isHostProvided('graphql')).toBe(true);
    expect(isHostProvided('ms')).toBe(false);
  });

  it('E02-S01 HOST_PROVIDED lists temporal-polyfill', () => {
    expect(HOST_PROVIDED).toEqual(
      expect.arrayContaining([
        '@nestjs/common',
        '@nestjs/core',
        '@nestjs/graphql',
        '@apollo/subgraph',
        'graphql',
        'reflect-metadata',
        'rxjs',
        'zod',
        '@northmes/sdk',
        'temporal-polyfill',
      ]),
    );
  });

  it('E02-S01 isHostProvided matches subpaths such as graphql/language and not graphqlx', () => {
    expect(isHostProvided('graphql/language')).toBe(true);
    expect(isHostProvided('@nestjs/graphql/dist/index.js')).toBe(true);
    expect(isHostProvided('graphqlx')).toBe(false);
  });
});
