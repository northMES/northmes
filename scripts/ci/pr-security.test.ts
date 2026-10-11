import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkPrSecurity } from './pr-security.mjs';

const script = fileURLToPath(new URL('./pr-security.mjs', import.meta.url));

// Runs the script as the CI / pr security job does, with the pull request in the environment.
function run(pullRequestEnv: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH, ...pullRequestEnv },
    encoding: 'utf8',
  });
}

// A pull request from a branch in this repository by a person, with the given body.
function pullRequest(body: string) {
  return { body, author: 'a-contributor', headRef: 'ci/pr-security', fromFork: false };
}

// The template's Security section as a pull request gets it, with only the template's comment.
const templateComment =
  '<!-- ADR 0076: the controls this change touches and the threat each one meets, or "none" with a reason. -->';

function body(security: string | undefined) {
  const section = security === undefined ? '' : `## Security\n\n${security}\n\n`;
  return `## What changes\nAdds the check.\n\nCloses #513\n\n${section}## Validation impact\nNone.\n`;
}

describe('CI / pr security', () => {
  it('ADR0076 a body without a Security section fails', () => {
    const result = checkPrSecurity(pullRequest(body(undefined)));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/## Security/);
  });

  it('ADR0076 a body whose Security section is empty or holds only the template comment fails', () => {
    expect(checkPrSecurity(pullRequest(body(''))).ok).toBe(false);
    expect(checkPrSecurity(pullRequest(body(templateComment))).ok).toBe(false);
    expect(checkPrSecurity(pullRequest('Closes #1\n\n## Security')).ok).toBe(false);
  });

  // GitHub renders nothing after a comment that is never closed, so its text is no note.
  it('ADR0076 a Security section that holds only an unclosed comment fails', () => {
    expect(
      checkPrSecurity(pullRequest(body('<!-- ADR 0076: the controls this change touches'))).ok,
    ).toBe(false);
  });

  it('ADR0076 a Security section that says none without a reason fails', () => {
    for (const none of ['None', 'none.', 'N/A', '- None', '- **None**', '_none_', 'None:']) {
      expect(checkPrSecurity(pullRequest(body(none))).ok, none).toBe(false);
    }
  });

  it('ADR0076 a Security section with a note, or none with a reason, passes', () => {
    const notes = [
      'None: the change only edits documentation.',
      '- **The token:** only the e2e step reads it.',
      `${templateComment}\nNone, because the script reads only the pull request body.`,
    ];

    for (const note of notes) {
      expect(checkPrSecurity(pullRequest(body(note))).ok, note).toBe(true);
    }
  });

  // GitHub renders a fenced block as code, so a heading in it is no section.
  it('ADR0076 a Security heading inside a fenced code block is no section', () => {
    for (const fence of ['```', '~~~']) {
      const fenced = `Closes #1\n\n${fence}md\n## Security\nNone: docs only.\n${fence}\n`;

      expect(checkPrSecurity(pullRequest(fenced)).ok, fence).toBe(false);
    }
    expect(
      checkPrSecurity(pullRequest(body('An example:\n```\n## Checks\n```\nNone: docs only.'))).ok,
    ).toBe(true);
  });

  it('ADR0076 the section ends at the next heading of the same or a higher level', () => {
    const subheading = 'Closes #1\n\n## Security\n\n### Token\nOnly the e2e step reads it.\n';
    const nextSection = 'Closes #1\n\n## Security\n\n## Checks\nThe tests pass.\n';

    expect(checkPrSecurity(pullRequest(subheading)).ok).toBe(true);
    expect(checkPrSecurity(pullRequest(nextSection)).ok).toBe(false);
  });

  // Renovate and release-please write their own bodies, as CI / linked issue allows (ADR 0076
  // covers dependency updates through the license gate and the supply-chain checks).
  it('ADR0076 a Renovate or release-please pull request passes without the section', () => {
    expect(checkPrSecurity({ ...pullRequest('Updates pg.'), author: 'renovate[bot]' }).ok).toBe(
      true,
    );
    expect(
      checkPrSecurity({
        ...pullRequest('Release 1.2.0'),
        headRef: 'release-please--branches--main',
      }).ok,
    ).toBe(true);
    expect(
      checkPrSecurity({
        ...pullRequest('Release 1.2.0'),
        headRef: 'release-please--branches--main',
        fromFork: true,
      }).ok,
    ).toBe(false);
  });

  it('ADR0076 the script fails with an error annotation, and a missing PR_FROM_FORK counts as a fork', () => {
    const failed = run({
      PR_BODY: 'Closes #1',
      PR_AUTHOR: 'a-contributor',
      PR_HEAD_REF: 'release-please--branches--main',
    });
    const passed = run({
      PR_BODY: body('None: docs only.'),
      PR_AUTHOR: 'a-contributor',
      PR_HEAD_REF: 'ci/pr-security',
      PR_FROM_FORK: 'false',
    });

    expect(failed.status).toBe(1);
    expect(failed.stdout).toMatch(/^::error::/);
    expect(passed.status).toBe(0);
  });
});
