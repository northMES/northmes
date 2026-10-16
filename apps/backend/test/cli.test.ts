// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it, vi } from 'vitest';
import { cli } from '../src/cli.ts';

describe('cli', () => {
  it('E02-S01 an unknown command exits 1 and names the commands', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();

    await cli(['seed'], { env: {}, exit, log });

    expect(log.error.mock.calls).toEqual([
      [
        'Unknown command "seed". Commands: serve, db bootstrap, migrate, company create, company add-admin, company list, admin reset-password',
      ],
    ]);
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.info).not.toHaveBeenCalled();
  });

  it('E02-S02 db bootstrap with an invalid environment exits 1 and lists every bad key without its value', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();

    // DATABASE_URL carries a login, and the four secret file keys are missing.
    await cli(['db', 'bootstrap'], {
      env: { DATABASE_URL: 'postgres://postgres:hunter2@db:5432/northmes' },
      exit,
      log,
    });
    const [header, ...problems] = (log.error.mock.calls[0]?.[0] ?? '').split('\n');

    expect(exit.mock.calls).toEqual([[1]]);
    expect(header).toBe('invalid configuration (5 problems)');
    expect(problems.map((problem) => problem.split(':')[0]).sort()).toEqual([
      '- DATABASE_URL',
      '- NORTHMES_DB_APP_PASSWORD_FILE',
      '- NORTHMES_DB_AUTH_PASSWORD_FILE',
      '- NORTHMES_DB_OWNER_PASSWORD_FILE',
      '- POSTGRES_PASSWORD_FILE',
    ]);
    expect(log.error.mock.calls.join('\n')).not.toContain('hunter2');
    expect(log.info).not.toHaveBeenCalled();
  });

  it('E02-S02 migrate with an invalid environment exits 1 and lists every bad key without its value', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();

    // DATABASE_URL carries a login, and the owner's secret file key is missing.
    await cli(['migrate'], {
      env: { DATABASE_URL: 'postgres://nm_owner:hunter2@db:5432/northmes' },
      exit,
      log,
    });
    const [header, ...problems] = (log.error.mock.calls[0]?.[0] ?? '').split('\n');

    expect(exit.mock.calls).toEqual([[1]]);
    expect(header).toBe('invalid configuration (2 problems)');
    expect(problems.map((problem) => problem.split(':')[0]).sort()).toEqual([
      '- DATABASE_URL',
      '- NORTHMES_DB_OWNER_PASSWORD_FILE',
    ]);
    expect(log.error.mock.calls.join('\n')).not.toContain('hunter2');
    expect(log.info).not.toHaveBeenCalled();
  });

  it('E05-S05 admin create is not a command: companies and their first admins come from company create', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();

    await cli(['admin', 'create', '--username', 'ada'], { env: {}, exit, log });

    expect(log.error.mock.calls[0]?.[0]).toMatch(/^Unknown command "admin create --username ada"/);
    expect(exit.mock.calls).toEqual([[1]]);
  });

  it.each([
    ['admin reset-password without --reason', ['admin', 'reset-password', '--username', 'ada']],
    [
      'admin reset-password with an empty --reason',
      ['admin', 'reset-password', '--username', 'ada', '--reason', ' '],
    ],
    [
      'admin reset-password with a --password flag',
      ['admin', 'reset-password', '--username', 'ada', '--reason', 'x', '--password', 'secret'],
    ],
    [
      'company create without --reason',
      [
        'company',
        'create',
        '--name',
        'Acme',
        '--admin-username',
        'ada',
        '--admin-email',
        'ada@example.test',
      ],
    ],
    [
      'company create without --admin-email',
      ['company', 'create', '--name', 'Acme', '--admin-username', 'ada', '--reason', 'x'],
    ],
    [
      'company create with an --id that is not a uuidv7',
      [
        'company',
        'create',
        '--id',
        'acme',
        '--name',
        'Acme',
        '--admin-username',
        'ada',
        '--admin-email',
        'ada@example.test',
        '--reason',
        'x',
      ],
    ],
    [
      'company add-admin without --company',
      ['company', 'add-admin', '--username', 'ada', '--reason', 'x'],
    ],
    ['company list with a stray argument', ['company', 'list', 'extra']],
  ])(
    'E05-S14 %s exits 2 with its usage, before it reads any configuration or prompts',
    async (_name, args) => {
      const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
      const exit = vi.fn<(code: number) => void>();
      const print = vi.fn<(text: string) => void>();

      await cli(args, { env: {}, exit, log, print });

      expect(exit.mock.calls).toEqual([[2]]);
      expect(log.error.mock.calls.join('\n')).toContain('Usage: northmes ');
      expect(log.error.mock.calls.join('\n')).not.toContain('secret');
      expect(print).not.toHaveBeenCalled();
    },
  );
});
