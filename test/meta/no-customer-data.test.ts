import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/no-customer-data.mjs';

// Built at run time, so this file never holds the pattern it tests. The check digit is wrong, so
// the number belongs to no organisation.
const organisationNumber = ['123', '456', '-', '78', '90'].join('');

describe('no-customer-data', () => {
  it('an in-memory file with a 6-4 digit organisation number fails', () => {
    const result = scan(
      [
        { path: 'README.md', content: 'Nothing to report.\n' },
        {
          path: 'modules/orders/src/customer.ts',
          content: `const a = 1;\nconst org = '${organisationNumber}';\n`,
        },
      ],
      [],
    );

    expect(result.findings).toEqual([
      { path: 'modules/orders/src/customer.ts', line: 2, kind: 'organisation-number' },
    ]);
  });
});
