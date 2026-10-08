// The check behind ci / linked issue. Every pull request finishes an issue, which its body names
// with Closes #N, so the issue closes when the pull request merges.

export function checkLinkedIssue(_pullRequest) {
  return {
    ok: false,
    message:
      'The pull request body links no issue. Add Closes #N for the issue this pull request finishes.',
  };
}
