// SPDX-License-Identifier: MIT

/**
 * Stops an entry point with every configuration problem found, so one start shows them all. A
 * problem names its key and the key's rule, never the value (ADR 0060).
 */
export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(listProblems(problems));
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function listProblems(problems: readonly string[]): string {
  const count = problems.length === 1 ? '1 problem' : `${problems.length} problems`;
  return [`invalid configuration (${count})`, ...problems.map((problem) => `- ${problem}`)].join(
    '\n',
  );
}
