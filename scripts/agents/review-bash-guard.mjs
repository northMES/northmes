// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The PreToolUse hook of the code-reviewer agent (.claude/agents/code-reviewer.md). The agent reads
// diffs that may carry injected instructions, and Bash can write, so the hook lets through only
// single read commands: git reads, gh views and a vitest run. Everything else is refused (ADR 0065).

// Shell syntax that chains, redirects or substitutes, so one allowed word can carry another command.
const shellSyntax = /[;&|<>`\n]|\$\(/;

// The allowed commands, as their leading words.
const allowed = [
  ['git', 'diff'],
  ['git', 'log'],
  ['git', 'show'],
  ['git', 'status'],
  ['git', 'ls-files'],
  ['git', 'rev-parse'],
  ['git', 'merge-base'],
  ['git', 'blame'],
  ['gh', 'issue', 'view'],
  ['gh', 'pr', 'view'],
  ['gh', 'pr', 'diff'],
  ['pnpm', 'exec', 'vitest', 'run'],
];

// Options that make an allowed command write a file or run another program.
const writingOptions = /^(?:--output(?:=|$)|--ext-diff$|-u$|--update$|--coverage)/;

const refusal = (reason) => ({
  ok: false,
  reason: `The code-reviewer agent runs read-only commands only: ${reason}`,
});

export function reviewCommandAllowed(command) {
  if (shellSyntax.test(command)) return refusal('no chaining, redirection or substitution.');
  const words = command.trim().split(/\s+/);
  const prefix = allowed.find((leading) => leading.every((word, index) => words[index] === word));
  if (prefix === undefined) {
    return refusal('git diff, log, show, status, ls-files, rev-parse, merge-base or blame; gh issue view, pr view or pr diff; pnpm exec vitest run.');
  }
  const option = words.slice(prefix.length).find((word) => writingOptions.test(word));
  if (option !== undefined) return refusal(`${option} writes a file or runs another program.`);
  return { ok: true, reason: '' };
}

// Claude Code passes the tool call as JSON on stdin. Exit code 2 refuses it and shows stderr to the
// agent.
if (import.meta.main) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const { ok, reason } = reviewCommandAllowed(input.tool_input?.command ?? '');
  if (!ok) {
    process.stderr.write(`${reason}\n`);
    process.exitCode = 2;
  }
}
