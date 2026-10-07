// SPDX-License-Identifier: MIT
import { randomBytes } from 'node:crypto';

/** What one test run uses to reach its container: no value is shared between runs or worktrees. */
export interface RunCredentials {
  password: string;
  database: string;
}

/** A random superuser password and a random database name for the container of one test run. */
export function newRunCredentials(): RunCredentials {
  return {
    password: randomBytes(32).toString('hex'),
    database: `nm_run_${randomBytes(6).toString('hex')}`,
  };
}
