// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind PR / linked issue. Every pull request finishes an issue, which its body names
// with Closes #N, so the issue closes when the pull request merges.

import { errorAnnotation } from './annotation.mjs';
import { isBotPullRequest } from './pull-request.mjs';

// GitHub's closing keywords, with an optional colon, before #N or owner/repository#N.
const closesIssue =
  /(?:^|\W)(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):? +(?:[\w.-]+\/[\w.-]+)?#\d+/i;

// Renovate's and release-please's pull requests update dependencies or cut a release and finish
// no issue.
export function checkLinkedIssue({ body, author, headRef, fromFork }) {
  if (isBotPullRequest({ author, headRef, fromFork }) || closesIssue.test(body)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message:
      'The pull request body links no issue. Add Closes #N for the issue this pull request finishes.',
  };
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
