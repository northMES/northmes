// The check behind ci / linked issue. Every pull request finishes an issue, which its body names
// with Closes #N, so the issue closes when the pull request merges.

// GitHub's closing keywords, with an optional colon, before #N or owner/repository#N.
const closesIssue =
  /(?:^|\W)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):? +(?:[\w.-]+\/[\w.-]+)?#\d+/i;

// Renovate's pull requests update dependencies and finish no issue. A GitHub user name cannot end
// in [bot], so only the Renovate app has this login.
const renovate = 'renovate[bot]';

export function checkLinkedIssue({ body, author }) {
  if (author === renovate || closesIssue.test(body)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message:
      'The pull request body links no issue. Add Closes #N for the issue this pull request finishes.',
  };
}
