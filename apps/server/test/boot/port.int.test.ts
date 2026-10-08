// SPDX-License-Identifier: AGPL-3.0-or-later
import { createServer, type Server } from 'node:net';
import { bootBuilt } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useServerEnv } from '../fixtures/server-env.ts';

const env = useServerEnv();

// Another process's socket on the port the server is told to take.
let holder: Server;
let port: number;

beforeEach(async () => {
  holder = createServer();
  await new Promise<void>((resolve) => holder.listen(0, '127.0.0.1', resolve));
  const address = holder.address();
  if (typeof address !== 'object' || address === null) throw new Error('the holder has no port');
  port = address.port;
});

afterEach(async () => {
  await new Promise((resolve) => holder.close(resolve));
});

describe('the built server', () => {
  it('E02-S08 a port in use stops boot with a message naming PORT', {
    timeout: 120_000,
  }, async () => {
    const { exitCode, stderr } = await bootBuilt({ env: { ...env, PORT: String(port) } });

    expect(exitCode).toBe(1);
    expect(stderr).toContain(
      `refused to start (1 problem)\n- PORT: 127.0.0.1:${port} is in use by another process (EADDRINUSE). Stop that process, or set PORT to a free port or to 0`,
    );
  });
});
