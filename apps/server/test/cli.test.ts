// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { cli } from '../src/cli.ts';

describe('cli', () => {
  it('E02-S01 an unknown command exits 1 and names the commands', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    const exit = vi.fn<(code: number) => void>();

    await cli(['migrate'], { env: {}, exit, log });

    expect(log.error.mock.calls).toEqual([['Unknown command "migrate". Commands: serve']]);
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.info).not.toHaveBeenCalled();
  });
});
