// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { shipPlan } from './auto-merge.mjs';

const agent = 345317483; // northmes-agent
const maintainer = 24939000; // Krister-Johansson

const blastRadius = [
  '## What changes',
  'Adds a column.',
  '## Blast radius',
  'A wrong backfill rewrites the quantity of every open job order (`migrations/0042.sql:12`).',
  '',
  'Tier: high',
  '## Checks',
  'pnpm check',
].join('\n');

const low = { tier: 'low' as const, reasons: [] };
const high = { tier: 'high' as const, reasons: ['declares a high blast radius'] };

describe('ADR0086 one step after the pull request opens', () => {
  it('ADR0086 turns on auto-merge for a low pull request and asks nobody', () => {
    expect(shipPlan({ authorId: agent, risk: low, body: blastRadius })).toEqual({
      autoMerge: true,
      reviewer: undefined,
      comment: undefined,
    });
  });

  it('ADR0086 turns on auto-merge for a high pull request too, so it merges once the maintainer approves', () => {
    expect(shipPlan({ authorId: agent, risk: high, body: blastRadius }).autoMerge).toBe(true);
  });

  it('ADR0086 asks the maintainer to review a high pull request, with the reasons and the blast radius in a comment', () => {
    const plan = shipPlan({ authorId: agent, risk: high, body: blastRadius });

    expect(plan.reviewer).toBe('Krister-Johansson');
    expect(plan.comment).toContain('@Krister-Johansson');
    expect(plan.comment).toContain('declares a high blast radius');
    expect(plan.comment).toContain('A wrong backfill rewrites the quantity of every open job order');
    expect(plan.comment).toContain('merges by itself once you approve');
  });

  it('ADR0086 refuses a pull request that northmes-agent did not open', () => {
    expect(() => shipPlan({ authorId: maintainer, risk: low, body: blastRadius })).toThrow(
      /northmes-agent/,
    );
  });

  it('ADR0086 still asks for review when the pull request has no Blast radius section', () => {
    const plan = shipPlan({ authorId: agent, risk: high, body: '## What changes\nAdds a column.' });

    expect(plan.reviewer).toBe('Krister-Johansson');
    expect(plan.comment).toContain('declares a high blast radius');
  });
});
