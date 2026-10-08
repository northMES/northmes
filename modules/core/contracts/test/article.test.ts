// SPDX-License-Identifier: MIT
import { createArticle, updateArticle } from '@northmes/core-contracts';
import { describe, expect, it } from 'vitest';

const ARTICLE_ID = '01920000-0000-7000-8000-0000000a0001';

/** The path and code of each issue of a failed parse. */
function issuesOf(result: { error?: { issues: { path: PropertyKey[]; code: string }[] } }) {
  return result.error?.issues.map(({ path, code }) => ({ path, code }));
}

describe('article contracts', () => {
  it('E06-S06 createArticle and updateArticle are core commands on a new and an existing article', () => {
    expect(createArticle).toMatchObject({ name: 'core.createArticle', target: 'new' });
    expect(updateArticle).toMatchObject({ name: 'core.updateArticle', target: 'existing' });
  });

  it('E06-S06 the article fields trim code and name', () => {
    for (const contract of [createArticle, updateArticle]) {
      expect(contract.fields.parse({ code: '  BR-140 ', name: ' Wall bracket  ' })).toEqual({
        code: 'BR-140',
        name: 'Wall bracket',
      });
    }
  });

  it('E06-S06 the article fields refuse a blank code or name, a code over 32 characters and a name over 200', () => {
    expect(issuesOf(createArticle.fields.safeParse({ code: '   ', name: '' }))).toEqual([
      { path: ['code'], code: 'too_small' },
      { path: ['name'], code: 'too_small' },
    ]);
    expect(
      issuesOf(updateArticle.fields.safeParse({ code: 'C'.repeat(33), name: 'N'.repeat(201) })),
    ).toEqual([
      { path: ['code'], code: 'too_big' },
      { path: ['name'], code: 'too_big' },
    ]);
    expect(
      createArticle.fields.safeParse({ code: 'C'.repeat(32), name: 'N'.repeat(200) }).success,
    ).toBe(true);
  });

  it('E06-S06 the article fields word each message as the rule and the fix, with the length typed', () => {
    const messages = (value: { code: string; name: string }) =>
      createArticle.fields.safeParse(value).error?.issues.map(({ path, message }) => ({
        path,
        message,
      }));

    expect(messages({ code: '  ', name: '' })).toEqual([
      { path: ['code'], message: 'Enter an article number.' },
      { path: ['name'], message: 'Enter a name.' },
    ]);
    expect(messages({ code: ` ${'C'.repeat(34)} `, name: 'N'.repeat(201) })).toEqual([
      { path: ['code'], message: 'Article number can be 1 to 32 characters. It has 34.' },
      { path: ['name'], message: 'Name can be 1 to 200 characters. It has 201.' },
    ]);
  });

  it('E06-S06 createArticle takes the new id and updateArticle the id and expectedVersion', () => {
    const fields = { code: 'BR-140', name: 'Wall bracket' };

    expect(createArticle.input.parse({ id: ARTICLE_ID, ...fields })).toEqual({
      id: ARTICLE_ID,
      ...fields,
    });
    expect(updateArticle.input.parse({ id: ARTICLE_ID, expectedVersion: 2, ...fields })).toEqual({
      id: ARTICLE_ID,
      expectedVersion: 2,
      ...fields,
    });
    expect(updateArticle.input.safeParse({ id: ARTICLE_ID, ...fields }).success).toBe(false);
  });
});
