// The check behind ci / linked issue. Every pull request finishes an issue, which its body names
// with Closes #N, so the issue closes when the pull request merges.

// GitHub's closing keywords, with an optional colon, before #N or owner/repository#N.
const closesIssue =
  /(?:^|\W)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):? +(?:[\w.-]+\/[\w.-]+)?#\d+/i;

// Renovate's pull requests update dependencies and finish no issue. A GitHub user name cannot end
// in [bot], so only the Renovate app has this login.
const renovate = 'renovate[bot]';

// release-please opens the release pull request from a branch with this prefix in this repository.
// A fork can name a branch the same way, so the prefix counts only outside forks.
const releaseBranch = 'release-please--branches--';

export function checkLinkedIssue({ body, author, headRef, fromFork }) {
  const release = !fromFork && headRef.startsWith(releaseBranch);
  if (author === renovate || release || closesIssue.test(body)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message:
      'The pull request body links no issue. Add Closes #N for the issue this pull request finishes.',
  };
}
