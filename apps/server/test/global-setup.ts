// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The server's global setup in the integration project. It runs after the harness setup of
 * @northmes/testing has started Postgres; the role bootstrap and the migrations of later tasks go
 * here. Vitest refuses a global setup file without a setup, teardown or default export, so until
 * then it exports a setup that does nothing.
 */
export default function setup(): void {}
