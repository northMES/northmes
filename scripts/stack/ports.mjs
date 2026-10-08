// The ports of the stack script (ADR 0058): taken from the operating system, never fixed, so two
// stacks on one machine never share one.

import { createServer } from 'node:net';

/**
 * Binds 127.0.0.1:0, reads the port the operating system picked and closes the socket again, so
 * the process the port is meant for can listen on it.
 * @returns {Promise<number>}
 */
export async function freePort() {
  const [port = 0] = await freePorts(1);
  return port;
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
      const port = await bindAnyPort(server);
      if (!except.includes(port)) ports.push(port);
    }
  } finally {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  }
  return ports;
}

/**
 * Binds server to 127.0.0.1:0 and resolves with the port the operating system picked.
 * @param {import('node:net').Server} server
 * @returns {Promise<number>}
 */
function bindAnyPort(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });
}
