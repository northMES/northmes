import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

  it('scan reports a Compose image line for postgres:17', () => {
    const text = 'services:\n  db:\n    image: postgres:17\n';

    const findings = scan([
      { path: 'compose.yaml', text },
      { path: 'docker-compose.dev.yml', text },
    ]);

    expect(findings).toEqual([
      { path: 'compose.yaml', line: 3, reference: 'postgres:17' },
      { path: 'docker-compose.dev.yml', line: 3, reference: 'postgres:17' },
    ]);
  });

  // These pass on arrival. They pin what scan() leaves alone, so a later change that widens it
  // fails here.
  describe('characterisation', () => {
    it('scan does not report the image in infra/pg-image.json', () => {
      const { image } = JSON.parse(
        readFileSync(fileURLToPath(new URL('../../infra/pg-image.json', import.meta.url)), 'utf8'),
      );

      expect(scan([{ path: 'Dockerfile', text: `FROM ${image}\n` }])).toEqual([]);
    });

    it('scan reports postgres:18 without the digest', () => {
      const findings = scan([{ path: 'Dockerfile', text: 'FROM postgres:18\n' }]);

      expect(findings).toEqual([{ path: 'Dockerfile', line: 1, reference: 'postgres:18' }]);
    });

    it('scan does not report a FROM line for another image or for a build stage', () => {
      const findings = scan([
        { path: 'Dockerfile', text: 'FROM node:26 AS build\nRUN true\nFROM build\n' },
      ]);

      expect(findings).toEqual([]);
    });

    it('scan ignores files that are neither Dockerfiles nor Compose files', () => {
      const findings = scan([
        { path: 'config.yaml', text: 'services:\n  db:\n    image: postgres:17\n' },
        { path: 'README.md', text: '```\nFROM postgres:17\n```\n' },
      ]);

      expect(findings).toEqual([]);
    });
  });
});
