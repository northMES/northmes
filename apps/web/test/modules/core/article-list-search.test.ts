// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  articleFilterVariables,
  articleListSearch,
} from '../../../src/modules/core/article-list-search.ts';

describe("the articles list's URL search", () => {
  // The API compares group ids as text, which Postgres prints in lowercase, and NorthMES stands
  // for articles without a source in any case, so a hand-edited link still filters.
  it('E06-S06 a link with an article group id in capitals or NorthMES in another case filters as its canonical value', () => {
    const view = articleListSearch({
      articleGroup: '019A0000-0000-7000-8000-0000000000A1,NONE',
      source: 'northmes,ERP',
    });

    expect(articleFilterVariables(view)).toEqual({
      articleGroupIds: ['019a0000-0000-7000-8000-0000000000a1', null],
      sources: [null, 'ERP'],
    });
  });
});
