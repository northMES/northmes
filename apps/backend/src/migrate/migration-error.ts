// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Stops pnpm northmes migrate before it applies a file, with every problem its checks found, so one
 * run shows them all. The command exits with its exit code (ADR 0006).
 */
export class MigrationError extends Error {
  readonly exitCode = 1;
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(listProblems(problems));
    this.name = 'MigrationError';
    this.problems = problems;
  }
}

function listProblems(problems: readonly string[]): string {
  const count = problems.length === 1 ? '1 problem' : `${problems.length} problems`;
  const header = `refused to migrate (${count})`;
  return [header, ...problems.map((problem) => `- ${problem}`)].join('\n');
}
