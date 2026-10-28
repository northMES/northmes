// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assessRisk, checkRisk, summary } from './risk-gate.mjs';

const agent = 345317483; // northmes-agent
const maintainer = 24939000; // Krister-Johansson

const riskPaths = [
  '# Paths where a wrong merge is expensive.',
  '/.github/',
  '**/migrations/**',
  '/apps/backend/src/modules/*/permissions.ts',
  '/package.json',
  'Dockerfile',
  '/apps/backend/src/db',
  '',
].join('\n');

function body(tier: string, validationImpact = 'None.') {
  return [
    '## What changes',
    'Fixes a typo.',
    '## Security',
    'None: documentation only.',
    '## Validation impact',
    validationImpact,
    '## Blast radius',
    'A reader sees the old wording until the next release.',
    '',
    `Tier: ${tier}`,
    '## Checks',
    'pnpm check',
  ].join('\n');
}

// An agent pull request that changes only the given files and declares the given tier.
function agentPull(files: string[], tier = 'low', validationImpact = 'None.') {
  return {
    riskPaths,
    files,
    body: body(tier, validationImpact),
    title: 'docs: fix a typo',
    authorId: agent,
    reviews: [],
    headSha: 'abc123',
  };
}

describe('risk gate', () => {
  it('an agent pull request that changes no high-risk path and declares a low tier is low', () => {
    const result = assessRisk(agentPull(['docs/guide/start.md']));

    expect(result.tier).toBe('low');
    expect(result.reasons).toEqual([]);
  });

  // The patterns follow .gitignore, as CODEOWNERS does: a leading slash anchors a pattern at the
  // root, a pattern with no slash matches at any depth, * stays within one folder, ** crosses
  // folders, and a pattern that names a folder covers everything below it.
  // A pattern with a space would never match, which would fail open, so the gate refuses it. So
  // does a pattern with ! or [, which CODEOWNERS does not support.
  it('a risk path with whitespace, ! or [ makes the gate throw', () => {
    for (const pattern of ['/deploy/ # note', '/deploy/ @owner', '!/docs/', '/docs/[ab].md']) {
      expect(
        () => assessRisk({ ...agentPull(['docs/a.md']), riskPaths: pattern }),
        pattern,
      ).toThrow(/risk-paths/);
    }
  });

  // CODEOWNERS: docs/* matches the files directly in docs and not the ones further down.
  it('a risk path that ends in /* matches the files directly in its folder only', () => {
    const pull = { ...agentPull([]), riskPaths: '/docs/security/*' };

    expect(assessRisk({ ...pull, files: ['docs/security/README.md'] }).tier).toBe('high');
    expect(assessRisk({ ...pull, files: ['docs/security/audits/2026.md'] }).tier).toBe('low');
  });

  it('a change to a high-risk path makes the pull request high, and the reason names the file', () => {
    const high = [
      '.github/workflows/ci.yml',
      'apps/backend/src/modules/core/migrations/0001_auth.sql',
      'examples/plugin-article-log/migrations/0001.sql',
      'apps/backend/src/modules/planning/permissions.ts',
      'package.json',
      'Dockerfile',
      'deploy/pg/Dockerfile',
      'apps/backend/src/db/scoped-database.ts',
    ];
    const low = [
      'docs/.github/notes.md',
      'apps/backend/src/modules/planning/core/permissions.ts',
      'packages/sdk/package.json',
      'apps/backend/src/dbx/pool.ts',
      'docs/migrations.md',
    ];

    for (const file of high) {
      const result = assessRisk(agentPull(['docs/guide/start.md', file]));

      expect(result.tier, file).toBe('high');
      expect(result.reasons, file).toEqual([`changes the high-risk path ${file}`]);
    }
    for (const file of low) {
      expect(assessRisk(agentPull([file])).tier, file).toBe('low');
    }
  });

  // ADR 0051 rule 18: a change to records, security, calculations or data needs a person to judge
  // whether the system still does what its validation says. Only none and UI only are low, so a
  // value the gate cannot read counts as high.
  it('a validation impact other than none or UI only makes the pull request high', () => {
    const high = [
      'Records',
      'Security: the sign-in rate limit.',
      'Calculation (the run length).',
      'data migration',
      'UI only, records',
      '- Records',
      'Records change in the run table.',
      'Records or calculation',
      'records; security',
      'Record',
      'Data migrations',
      'See below.\n\nRecords',
    ];
    const low = [
      'None.',
      'UI only: a label changes.',
      'None: no records change.',
      '- **None**',
      'UI only',
      'None, UI only.',
    ];

    for (const impact of high) {
      const result = assessRisk(agentPull(['docs/guide/start.md'], 'low', impact));
      const firstLine = impact.split('\n')[0];

      expect(result.tier, impact).toBe('high');
      expect(result.reasons, impact).toEqual([`has the validation impact ${firstLine}`]);
    }
    for (const impact of low) {
      expect(assessRisk(agentPull(['docs/guide/start.md'], 'low', impact)).tier, impact).toBe(
        'low',
      );
    }
  });

  it('a body without a Validation impact section makes the pull request high', () => {
    const pull = agentPull(['docs/guide/start.md']);
    const result = assessRisk({
      ...pull,
      body: pull.body.replace('## Validation impact', '## Notes'),
    });

    expect(result.tier).toBe('high');
    expect(result.reasons).toEqual(['has no Validation impact section']);
  });

  // The blast-radius review can raise the tier and never lower it below the rules above.
  it('a Blast radius section that declares a high tier makes the pull request high', () => {
    for (const tier of ['high', 'High', '**high**', '`high`']) {
      const result = assessRisk(agentPull(['docs/guide/start.md'], tier));

      expect(result.tier, tier).toBe('high');
      expect(result.reasons, tier).toEqual(['declares a high blast radius']);
    }
  });

  it('a declared low tier does not lower a high-risk path', () => {
    const result = assessRisk(agentPull(['.github/CODEOWNERS'], 'low'));

    expect(result.tier).toBe('high');
  });

  it('a Tier line that says high makes the pull request high wherever it stands in the section', () => {
    const pull = agentPull(['docs/guide/start.md']);
    const twoLines = pull.body.replace('Tier: low', 'Tier: low\n\nTier: high');

    expect(assessRisk({ ...pull, body: twoLines }).tier).toBe('high');
  });

  it('a body without a Blast radius section or a Tier line makes the pull request high', () => {
    const pull = agentPull(['docs/guide/start.md']);
    const withoutSection = pull.body.replace('## Blast radius', '## Notes');
    const withoutTier = pull.body.replace('Tier: low', 'Low, probably.');

    for (const changed of [withoutSection, withoutTier]) {
      const result = assessRisk({ ...pull, body: changed });

      expect(result.tier).toBe('high');
      expect(result.reasons).toEqual(['declares no tier in a Blast radius section']);
    }
  });

  // PR / openapi diff lets a break of the public API through only when the title marks it with !.
  it('a title that marks a breaking change makes the pull request high', () => {
    const result = assessRisk({
      ...agentPull(['docs/guide/start.md']),
      title: 'feat(core)!: drop a field',
    });

    expect(result.tier).toBe('high');
    expect(result.reasons).toEqual(['marks a breaking change in its title']);
  });

  // Only agent sessions fill the Blast radius section from a fresh-context review. Contributors,
  // Renovate, Dependabot and release-please go to the maintainer.
  it('a pull request that the machine user did not open is high', () => {
    const result = assessRisk({ ...agentPull(['docs/guide/start.md']), authorId: 29139614 });

    expect(result.tier).toBe('high');
    expect(result.reasons).toEqual(['was not opened by northmes-agent']);
  });

  describe('the gate', () => {
    const highPull = agentPull(['.github/CODEOWNERS']);

    function review(userId: number, state: string, commitId = highPull.headSha) {
      return { userId, state, commitId };
    }

    it('a low pull request passes without a review', () => {
      expect(assessRisk(agentPull(['docs/guide/start.md'])).ok).toBe(true);
    });

    it('a high pull request passes only once the maintainer approved its head commit', () => {
      const cases: [string, ReturnType<typeof review>[], boolean][] = [
        ['no review', [], false],
        ['the maintainer approved the head commit', [review(maintainer, 'APPROVED')], true],
        [
          'the maintainer approved an older commit',
          [review(maintainer, 'APPROVED', 'old456')],
          false,
        ],
        ['another account approved', [review(agent, 'APPROVED')], false],
        [
          'the maintainer approved, then asked for changes',
          [review(maintainer, 'APPROVED'), review(maintainer, 'CHANGES_REQUESTED')],
          false,
        ],
        // GitHub records a dismissal as the state of the dismissed review itself.
        ['the approval was dismissed', [review(maintainer, 'DISMISSED')], false],
        // A dismissed request for changes does not bring an earlier approval back: the machine
        // user may dismiss reviews, so the maintainer approves again.
        [
          'the maintainer approved, asked for changes, and that request was dismissed',
          [review(maintainer, 'APPROVED'), review(maintainer, 'DISMISSED')],
          false,
        ],
        [
          'the maintainer approved, then commented',
          [review(maintainer, 'APPROVED'), review(maintainer, 'COMMENTED')],
          true,
        ],
      ];

      for (const [name, reviews, ok] of cases) {
        expect(assessRisk({ ...highPull, reviews }).ok, name).toBe(ok);
      }
    });
  });

  describe('reading the pull request from GitHub', () => {
    const apiUrl = 'https://api.github.com';
    const repository = 'northMES/northmes';

    // GitHub's REST API as the check sees it: each route answers its JSON or text, and any other
    // path answers 404.
    function github(routes: Record<string, unknown>) {
      const requests: string[] = [];
      const fetch = async (url: string, init?: { headers?: Record<string, string> }) => {
        const path = url.slice(`${apiUrl}/`.length);
        requests.push(path);
        expect(init?.headers?.authorization).toBe('Bearer a-token');
        const answer = routes[path];
        if (answer === undefined) return new Response('{"message":"Not Found"}', { status: 404 });
        return new Response(typeof answer === 'string' ? answer : JSON.stringify(answer));
      };
      return { fetch, requests };
    }

    const pull = {
      number: 800,
      title: 'docs: move the guide',
      body: body('low'),
      user: { id: agent, login: 'northmes-agent' },
      head: { sha: 'abc123' },
      base: { repo: { default_branch: 'main' } },
      changed_files: 2,
    };

    function routes(overrides: Record<string, unknown> = {}) {
      return {
        [`repos/${repository}/pulls/800`]: pull,
        [`repos/${repository}/pulls/800/files?per_page=100&page=1`]: [
          { filename: 'docs/guide/start.md' },
          { filename: 'docs/guide/workflows.md', previous_filename: '.github/workflow-notes.md' },
        ],
        [`repos/${repository}/pulls/800/reviews?per_page=100&page=1`]: [],
        [`repos/${repository}/contents/.github/risk-paths?ref=main`]: riskPaths,
        ...overrides,
      };
    }

    async function check(answers: Record<string, unknown>) {
      const { fetch } = github(answers);
      return checkRisk({ fetch, apiUrl, repository, token: 'a-token', pullNumber: 800 });
    }

    // A rename out of a high-risk folder changes that folder too.
    it('reads the risk paths from the default branch and counts the old path of a renamed file', async () => {
      const result = await check(routes());

      expect(result.tier).toBe('high');
      expect(result.reasons).toEqual(['changes the high-risk path .github/workflow-notes.md']);
    });

    it("passes a high pull request on the maintainer's approval of its head commit", async () => {
      const result = await check(
        routes({
          [`repos/${repository}/pulls/800/reviews?per_page=100&page=1`]: [
            { user: { id: maintainer }, state: 'APPROVED', commit_id: 'abc123' },
          ],
        }),
      );

      expect(result.ok).toBe(true);
    });

    // GitHub lists at most 3000 files of a pull request, so a larger one cannot be read whole.
    it('a pull request with more files than GitHub lists is high', async () => {
      const result = await check(
        routes({
          [`repos/${repository}/pulls/800`]: { ...pull, changed_files: 3001 },
          [`repos/${repository}/pulls/800/files?per_page=100&page=1`]: undefined,
        }),
      );

      expect(result.tier).toBe('high');
      expect(result.reasons).toEqual(['changes more files than GitHub lists']);
      expect(result.ok).toBe(false);
    });
  });

  // The gate guards itself: a pull request that edits the gate, its path list, the workflows, the
  // meta tests or the agents' settings and instructions is high, and the default branch's copy judges
  // it (ADR 0086 rule 1). test/meta/agent-sandbox.test.ts holds the list against CODEOWNERS; this
  // test holds that the gate reads the repository's own list the way it reads the fixture above.
  it("ADR0086 the repository's risk paths make a change to the gate, the workflows, the meta tests and the agent files high, and a module change low", () => {
    const repositoryRiskPaths = readFileSync(
      new URL('../../.github/risk-paths', import.meta.url),
      'utf8',
    );
    const tierOf = (file: string) =>
      assessRisk({ ...agentPull([file]), riskPaths: repositoryRiskPaths }).tier;

    for (const file of [
      'scripts/ci/risk-gate.mjs',
      '.github/risk-paths',
      '.github/workflows/ci.yml',
      'test/meta/workflows.test.ts',
      'scripts/agents/auto-merge.mjs',
      '.claude/agents/blast-radius.md',
      'CLAUDE.md',
      'AGENTS.md',
      'skills-lock.json',
    ]) {
      expect(tierOf(file), file).toBe('high');
    }
    for (const file of [
      'apps/backend/src/modules/core/permissions.ts',
      'modules/planning/domain/src/index.ts',
      'docs/adr/0086-risk-tiered-review-and-merge-of-agent-pull-requests.md',
    ]) {
      expect(tierOf(file), file).toBe('low');
    }
  });

  // The path list is a reviewed security boundary (ADR 0086 rule 1), so its whole content is pinned
  // on purpose: every edit to it is a two-place edit that a reviewer sees.
  it("ADR0086 the repository's risk paths are pinned as the reviewed boundary: exactly .github, scripts/ci, scripts/agents, test/meta, .claude, CLAUDE.md, AGENTS.md and skills-lock.json", () => {
    const patterns = readFileSync(new URL('../../.github/risk-paths', import.meta.url), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));

    expect(patterns).toEqual([
      '/.github/',
      '/scripts/ci/',
      '/scripts/agents/',
      '/test/meta/',
      '/.claude/',
      '/CLAUDE.md',
      '/AGENTS.md',
      '/skills-lock.json',
    ]);
  });

  it('the job summary names the tier, each reason and what a high pull request waits for', () => {
    expect(summary({ tier: 'low', reasons: [], ok: true })).toBe('Risk tier: **low**\n\n');
    expect(summary({ tier: 'high', reasons: ['declares a high blast radius'], ok: false })).toBe(
      'Risk tier: **high**\n\n- The pull request declares a high blast radius.\n\nA high pull request merges after the maintainer approves its head commit (ADR 0086).\n',
    );
  });
});
