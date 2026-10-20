// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reviewCommandAllowed } from './review-bash-guard.mjs';

const script = fileURLToPath(new URL('./review-bash-guard.mjs', import.meta.url));

// Runs the guard as Claude Code runs a PreToolUse hook: the tool call as JSON on stdin.
function hook(command: string) {
  return spawnSync(process.execPath, [script], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  });
}

describe('the code-reviewer agent Bash guard', () => {
  it('allows git reads and gh views', () => {
    for (const command of [
      'git diff origin/main...HEAD',
      'git diff HEAD -- scripts/cla/check.mjs',
      'git status --short',
      'git log --oneline -5',
      'git show HEAD:CLAUDE.md',
      'gh issue view 747 --repo northMES/northmes',
      'gh pr diff 748 --repo northMES/northmes',
    ]) {
      expect(reviewCommandAllowed(command), command).toEqual({ ok: true, reason: '' });
    }
  });

  // An instruction in a reviewed diff must not get the reviewer to change the branch.
  it('refuses commands that write, chain or reach beyond the allowed reads', () => {
    for (const command of [
      'git checkout -- CLAUDE.md',
      'git commit -am fix',
      'git -c core.pager=sh diff',
      'git diff --output=/tmp/x',
      'git diff --ext-diff',
      "sed -i '' s/a/b/ CLAUDE.md",
      'rm -rf node_modules',
      'git diff && rm CLAUDE.md',
      'git status; touch x',
      'git log | tee out.txt',
      'git diff > out.patch',
      'git show $(rm x)',
      'git show `rm x`',
      'gh pr comment 748 --body hi',
      'gh pr merge 748',
      // A test run executes test files and configuration from the branch under review.
      'pnpm exec vitest run --project unit scripts/cla/check.test.ts',
      'pnpm exec vitest run --reporter=json --outputFile=CLAUDE.md',
      'pnpm check',
      'FOO=1 git diff',
    ]) {
      expect(reviewCommandAllowed(command).ok, command).toBe(false);
    }
  });

  it('as a hook, exits 2 with the reason on stderr for a refused command and 0 for an allowed one', () => {
    const refused = hook('git checkout -- CLAUDE.md');
    const allowed = hook('git status --short');

    expect(refused.status).toBe(2);
    expect(refused.stderr).toMatch(/read-only/);
    expect(allowed.status).toBe(0);
  });

  // A guard that crashes must refuse, not let the command through.
  it('as a hook, refuses with exit 2 when its input cannot be read', () => {
    const broken = spawnSync(process.execPath, [script], { input: 'not json', encoding: 'utf8' });

    expect(broken.status).toBe(2);
  });
});
