// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { cli } from '../src/cli.ts';

describe('cli', () => {
  it('E02-S01 an unknown command exits 1 and names the commands', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();

    await cli(['migrate'], { env: {}, exit, log });

    expect(log.error.mock.calls).toEqual([
      ['Unknown command "migrate". Commands: serve, db bootstrap'],
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
});
