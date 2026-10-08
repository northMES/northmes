import { describe, expect, it } from 'vitest';
import { checkLinkedIssue } from './linked-issue.mjs';

// A pull request from a branch in this repository by a person, with the given body.
function pullRequest(body: string) {
  return { body, author: 'a-contributor', headRef: 'ci/gate-on-pull-requests', fromFork: false };
}

describe('ci / linked issue', () => {
  it('passes a pull request whose body has Closes #N', () => {
    expect(checkLinkedIssue(pullRequest('Closes #196')).ok).toBe(true);
    expect(checkLinkedIssue(pullRequest('Runs the gate.\n\ncloses #7\n')).ok).toBe(true);
  });

  it('fails a pull request whose body has no Closes #N, saying how to link one', () => {
    for (const body of ['', 'Adds the gate.', 'Closes #N', 'Part of #196.', 'This encloses #12.']) {
      const result = checkLinkedIssue(pullRequest(body));

      expect(result.ok, body).toBe(false);
      expect(result.message, body).toContain('Closes #N');
    }
  });
});
