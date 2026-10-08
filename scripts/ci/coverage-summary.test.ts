import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./coverage-summary.mjs', import.meta.url));

const summary = `
=============================== Coverage summary ===============================
Statements   : 71.43% ( 10/14 )
Branches     : 50% ( 2/4 )
Functions    : 100% ( 3/3 )
Lines        : 71.43% ( 10/14 )
================================================================================
`;

describe('the coverage summary step of CI / test', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'coverage-summary-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('appends coverage/text-summary.txt to the file GITHUB_STEP_SUMMARY names, in a code block under a heading', () => {
    const stepSummary = join(directory, 'step-summary.md');
    mkdirSync(join(directory, 'coverage'));
    writeFileSync(join(directory, 'coverage/text-summary.txt'), summary);
    writeFileSync(stepSummary, 'an earlier line\n');

    // GitHub runs the step in the checkout, where pnpm test:coverage wrote coverage/.
    const result = spawnSync(process.execPath, [script], {
      cwd: directory,
      env: { PATH: process.env.PATH, GITHUB_STEP_SUMMARY: stepSummary },
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(stepSummary, 'utf8')).toBe(
      `an earlier line\n## Coverage of the UTC leg\n\n\`\`\`text\n${summary.trim()}\n\`\`\`\n`,
    );
  });
});
