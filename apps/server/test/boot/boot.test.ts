// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';

// A valid server environment. PORT 0 lets the operating system pick a free port.
const env = { NODE_ENV: 'test', PORT: '0', NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4100' };

// Collects the lines boot writes.
function recordingLog() {
  return { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
}

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('boot', () => {
  it('E02-S01 a valid environment boots core then planning and logs them in that order', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();

    app = await boot({ env, importManifest: (specifier) => import(specifier), exit, log });
    const url = await app?.getUrl();

    expect(exit).not.toHaveBeenCalled();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(log.info.mock.calls).toEqual([
      ['Modules in boot order: core, planning'],
      [`Listening on ${url}`],
    ]);
    expect(log.error).not.toHaveBeenCalled();
  });
});
