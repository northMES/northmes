import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/pg-image.mjs';

describe('pg-image', () => {
  it('scan reports an in-memory Dockerfile with FROM postgres:17', () => {
    const findings = scan([{ path: 'infra/Dockerfile', text: 'FROM postgres:17\n' }]);

    expect(findings).toEqual([{ path: 'infra/Dockerfile', line: 1, reference: 'postgres:17' }]);
  });

  it('scan reports a FROM line with a --platform flag, an AS alias and lowercase from', () => {
    const findings = scan([
      {
        path: 'db/Dockerfile.dev',
        text: 'FROM node:26 AS build\nRUN true\nfrom --platform=linux/amd64 postgres:17 AS db\n',
      },
    ]);

    expect(findings).toEqual([{ path: 'db/Dockerfile.dev', line: 3, reference: 'postgres:17' }]);
  });
});
