import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/pg-image.mjs';

describe('pg-image', () => {
  it('scan reports an in-memory Dockerfile with FROM postgres:17', () => {
    const findings = scan([{ path: 'infra/Dockerfile', text: 'FROM postgres:17\n' }]);

    expect(findings).toEqual([{ path: 'infra/Dockerfile', line: 1, reference: 'postgres:17' }]);
  });
});
