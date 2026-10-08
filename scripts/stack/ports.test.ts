import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { freePort } from './ports.mjs';

const servers: Server[] = [];

/** Listens on 127.0.0.1:port, as the server does with PORT, and rejects with the listen error. */
function listenOn(port: number): Promise<void> {
  const server = createServer();
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

afterEach(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  servers.length = 0;
});

describe('freePort', () => {
  it('E02-S08 two stack instances get disjoint ports', async () => {
    // Each instance takes its port as the stack does, and both start together.
    const ports = await Promise.all([freePort(), freePort()]);

    expect(new Set(ports).size).toBe(2);
    for (const port of ports) expect(port).toBeGreaterThan(0);
    // Each instance can listen on its port: no EADDRINUSE.
    await expect(Promise.all(ports.map(listenOn))).resolves.toBeDefined();
  });
});
