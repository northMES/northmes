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

// A workflow command for an error annotation. GitHub decodes %25, %0D and %0A in its message.
function errorAnnotation(message) {
  const encoded = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  return `::error::${encoded}`;
}

// The job passes the pull request through the environment, never inside the run script, so a body
// cannot inject shell code. A missing PR_FROM_FORK counts as a fork, which grants no exemption.
if (import.meta.main) {
  const { ok, message } = checkLinkedIssue({
    body: process.env.PR_BODY ?? '',
    author: process.env.PR_AUTHOR ?? '',
    headRef: process.env.PR_HEAD_REF ?? '',
    fromFork: process.env.PR_FROM_FORK !== 'false',
  });
  if (!ok) {
    console.log(errorAnnotation(message));
    process.exitCode = 1;
  }
}
