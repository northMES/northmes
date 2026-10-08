// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Stops the boot with every problem a boot step found, so one start shows them all. Boot exits
 * with its exit code (ADR 0002).
 */
export class BootError extends Error {
  readonly exitCode = 1;
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(problems.join('\n'));
    this.name = 'BootError';
    this.problems = problems;
  }
}
