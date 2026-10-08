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
