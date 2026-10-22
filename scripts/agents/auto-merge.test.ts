// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { autoMergeRefusal } from './auto-merge.mjs';

const headSha = 'a1b2c3';
const actions = 15368; // the GitHub Actions app

function riskGate(conclusion: string, overrides: Record<string, unknown> = {}) {
  return {
    name: 'risk gate',
    head_sha: headSha,
    status: 'completed',
    conclusion,
    app: { id: actions },
    ...overrides,
  };
}

const low = { tier: 'low' as const, reasons: [], ok: true };

describe('ADR0086 auto-merge for a low pull request', () => {
  it('ADR0086 allows a low pull request whose risk gate passed on the head commit', () => {
    expect(
      autoMergeRefusal({ risk: low, checkRuns: [riskGate('success')], headSha }),
    ).toBeUndefined();
  });

  it('ADR0086 refuses a high pull request, even one the maintainer approved', () => {
    const risk = {
      tier: 'high' as const,
      reasons: ['changes the high-risk path /.github/CODEOWNERS'],
      ok: true,
    };

    expect(autoMergeRefusal({ risk, checkRuns: [riskGate('success')], headSha })).toMatch(
      /high risk: changes the high-risk path/,
    );
  });

  it('ADR0086 refuses while the risk gate has not passed on the head commit', () => {
    expect(autoMergeRefusal({ risk: low, checkRuns: [], headSha })).toMatch(/risk gate/);
    expect(autoMergeRefusal({ risk: low, checkRuns: [riskGate('failure')], headSha })).toMatch(
      /risk gate/,
    );
    expect(
      autoMergeRefusal({
        risk: low,
        checkRuns: [riskGate('success', { status: 'in_progress', conclusion: null })],
        headSha,
      }),
    ).toMatch(/risk gate/);
    expect(
      autoMergeRefusal({
        risk: low,
        checkRuns: [riskGate('success', { head_sha: 'older' })],
        headSha,
      }),
    ).toMatch(/risk gate/);
  });

  it('ADR0086 counts only a risk gate from the GitHub Actions app, not a status another integration set', () => {
    const forged = riskGate('success', { app: { id: 1 } });

    expect(autoMergeRefusal({ risk: low, checkRuns: [forged], headSha })).toMatch(/risk gate/);
  });

  it('ADR0086 judges the latest risk gate run when the gate ran more than once', () => {
    const runs = [
      riskGate('success', { id: 1, completed_at: '2026-10-22T10:00:00Z' }),
      riskGate('failure', { id: 2, completed_at: '2026-10-22T10:05:00Z' }),
    ];

    expect(autoMergeRefusal({ risk: low, checkRuns: runs, headSha })).toMatch(/risk gate/);
  });

  it('ADR0086 waits for a newer risk gate run that has not finished, even after an older one passed', () => {
    const runs = [
      riskGate('success', { id: 1, completed_at: '2026-10-22T10:00:00Z' }),
      riskGate('success', { id: 2, status: 'in_progress', conclusion: null, completed_at: null }),
    ];

    expect(autoMergeRefusal({ risk: low, checkRuns: runs, headSha })).toMatch(/risk gate/);
  });
});
