// The check behind ci / linked issue. Every pull request finishes an issue, which its body names
// with Closes #N, so the issue closes when the pull request merges.

// GitHub's closing keywords, with an optional colon, before #N or owner/repository#N.
const closesIssue =
  /(?:^|\W)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):? +(?:[\w.-]+\/[\w.-]+)?#\d+/i;

export function checkLinkedIssue({ body }) {
  if (closesIssue.test(body)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message:
      'The pull request body links no issue. Add Closes #N for the issue this pull request finishes.',
  };
}
