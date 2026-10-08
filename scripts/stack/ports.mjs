// The ports of the stack script (ADR 0058): taken from the operating system, never fixed, so two
// stacks on one machine never share one.

import { createServer } from 'node:net';

/**
 * Binds 127.0.0.1:0, reads the port the operating system picked and closes the socket again, so
 * the process the port is meant for can listen on it.
 * @returns {Promise<number>}
 */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Takes count ports, as freePort takes one, that differ from each other and from the ports in
 * except. Each socket stays bound until all ports are taken, so the operating system cannot pick
 * one port twice; a port in except, which an earlier call took and released, is skipped. The
 * sockets are closed when the promise resolves.
 * @param {number} count
 * @param {{ except?: readonly number[] }} [options]
 * @returns {Promise<number[]>}
 */
export async function freePorts(count, { except = [] } = {}) {
  /** @type {import('node:net').Server[]} */
  const servers = [];
  /** @type {number[]} */
  const ports = [];
  try {
    while (ports.length < count) {
      const server = createServer();
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(undefined));
      });
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      if (!except.includes(port)) ports.push(port);
    }
  } finally {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  }
  return ports;
}
