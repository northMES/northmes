// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { articleSource } from '../src/article.ts';

describe('articleSource', () => {
  it('E06-S06 the source of an upsert is the trimmed name of the integration', () => {
    expect(articleSource.parse(' Pyramid ')).toBe('Pyramid');
  });

  it("E06-S06 a source name with a comma or the name NorthMES is refused, since the articles list's filter reads both", () => {
    const messages = ['Pyramid, test', 'NorthMES', 'northmes'].map(
      (name) => articleSource.safeParse(name).error?.issues[0]?.message,
    );

    expect(messages).toEqual([
      'Name the integration without a comma, and not NorthMES.',
      'Name the integration without a comma, and not NorthMES.',
      'Name the integration without a comma, and not NorthMES.',
    ]);
  });
});
