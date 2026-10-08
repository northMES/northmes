// SPDX-License-Identifier: MIT
import { ConfigError } from '@northmes/sdk/config';

/** Calls fn and returns the ConfigError it throws, so a test can read its problems. */
export function configErrorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError, but nothing was thrown');
}

/** The keys a ConfigError names, sorted. Each problem reads "KEY: rule". */
export function keysOf(error: ConfigError): string[] {
  return error.problems.map((problem) => problem.split(':')[0] ?? problem).sort();
}
