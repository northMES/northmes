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

  it('scan reports a Compose image line with a trailing YAML comment', () => {
    const findings = scan([
      {
        path: 'compose.yaml',
        text: 'services:\n  a:\n    image: postgres:17 # pinned\n  b:\n    image: "postgres:16"  # old\n',
      },
    ]);

    expect(findings).toEqual([
      { path: 'compose.yaml', line: 3, reference: 'postgres:17' },
      { path: 'compose.yaml', line: 5, reference: 'postgres:16' },
    ]);
  });

  it('scan ignores a reference with no name character after postgres:', () => {
    const findings = scan([
      {
        path: 'compose.yaml',
        text: `services:\n  a:\n    image: postgres:(\\d+)\n  b:\n    image: postgres:\${TAG}\n`,
      },
    ]);

    expect(findings).toEqual([]);
  });

  it('scan reports a literal other than the configured image in a test file', () => {
    const findings = scan([
      {
        path: 'packages/x/db.int.test.ts',
        text: "const a = 1;\nawait new PostgreSqlContainer('postgres:17').start();\n",
      },
      { path: 'types/db.test-d.ts', text: 'new PostgreSqlContainer("postgres:16");\n' },
    ]);

    expect(findings).toEqual([
      { path: 'packages/x/db.int.test.ts', line: 2, reference: 'postgres:17' },
      { path: 'types/db.test-d.ts', line: 1, reference: 'postgres:16' },
    ]);
  });

  it('scan reports PostgreSqlContainer() with no argument', () => {
    const findings = scan([
      { path: 'a.int.test.ts', text: 'const a = 1;\nawait new PostgreSqlContainer().start();\n' },
    ]);

    expect(findings).toEqual([
      { path: 'a.int.test.ts', line: 2, reference: 'PostgreSqlContainer()' },
    ]);
  });

  it('scan reports a PostgreSqlContainer call with a space before the parenthesis', () => {
    const findings = scan([
      {
        path: 'a.int.test.ts',
        text: "new PostgreSqlContainer ('postgres:17');\nnew PostgreSqlContainer\t();\n",
      },
    ]);

    expect(findings).toEqual([
      { path: 'a.int.test.ts', line: 1, reference: 'postgres:17' },
      { path: 'a.int.test.ts', line: 2, reference: 'PostgreSqlContainer()' },
    ]);
  });

  it('scan ignores a call to a name that only ends in PostgreSqlContainer', () => {
    const findings = scan([
      {
        path: 'a.int.test.ts',
        text: "new MyPostgreSqlContainer().start();\nnew MyPostgreSqlContainer('postgres:17');\n",
      },
    ]);

    expect(findings).toEqual([]);
  });

  it('scan skips docs/**', () => {
    const findings = scan([
      {
        path: 'docs/sources/spike/compose.yaml',
        text: 'services:\n  db:\n    image: postgres:17\n',
      },
      {
        path: 'docs/sources/spike/test/pg.test.mjs',
        text: "new PostgreSqlContainer('postgres:18.4-alpine');\n",
      },
    ]);

    expect(findings).toEqual([]);
  });

  it('scan skips the two pg-image files', () => {
    const findings = scan([
      // The test file quotes the call it checks for, so a skip entry keeps it out of the scan.
      { path: 'test/meta/pg-image.test.ts', text: "new PostgreSqlContainer('postgres:17');\n" },
      // These two are not Dockerfiles, Compose files or test files, so no matcher reads them and no
      // skip entry is needed. This test pins that they stay unreported.
      { path: 'scripts/lint/pg-image.mjs', text: '    image: postgres:17\n' },
      { path: 'infra/pg-image.json', text: '    image: postgres:17\n' },
    ]);

    expect(findings).toEqual([]);
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

    it('scan does not report the configured image in a Compose file or a PostgreSqlContainer call', () => {
      const { image } = JSON.parse(
        readFileSync(fileURLToPath(new URL('../../infra/pg-image.json', import.meta.url)), 'utf8'),
      );

      const findings = scan([
        { path: 'compose.yaml', text: `services:\n  db:\n    image: ${image}\n` },
        { path: 'a.int.test.ts', text: `new PostgreSqlContainer('${image}');\n` },
      ]);

      expect(findings).toEqual([]);
    });

    it('scan does not report an identifier argument to PostgreSqlContainer', () => {
      const findings = scan([
        { path: 'a.int.test.ts', text: 'await new PostgreSqlContainer(image).start();\n' },
      ]);

      expect(findings).toEqual([]);
    });

    it('scan does not report regex text that names postgres: in a test file', () => {
      const findings = scan([
        {
          path: 'packages/testing/test/harness.int.test.ts',
          text: 'const major = /^postgres:(\\d+)[@-]/.exec(image)?.[1];\n',
        },
      ]);

      expect(findings).toEqual([]);
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
