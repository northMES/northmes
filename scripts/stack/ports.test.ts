import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { freePort, freePorts } from './ports.mjs';

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

describe('freePorts', () => {
  it('E02-S08 the ports pnpm dev takes in one process are disjoint and leave out the stack port', async () => {
    // freePort closes its socket before it resolves, so the next call may get the same port. pnpm
    // dev takes the stack's PORT for the server and one more port for the shell and each remote.
    const stackPort = await freePort();

    const ports = await freePorts(8, { except: [stackPort] });

    expect(ports).toHaveLength(8);
    expect(new Set(ports).size).toBe(8);
    expect(ports).not.toContain(stackPort);
    await expect(Promise.all(ports.map(listenOn))).resolves.toBeDefined();
  });
});
