// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind CI / pr security. Every pull request body has a Security section that names the
// controls the change touches and the threat each one meets, or says none with a reason (ADR 0076).

import { errorAnnotation } from './annotation.mjs';
import { givesNoReason, isBotPullRequest, section } from './pull-request.mjs';

// Renovate's and release-please's pull requests are exempt, as for CI / linked issue: neither app
// writes the section, and dependency updates go through the license and supply-chain checks.
export function checkPrSecurity({ body, author, headRef, fromFork }) {
  if (isBotPullRequest({ author, headRef, fromFork })) return { ok: true, message: '' };
  const security = section(body, 'Security');
  if (security === undefined) {
    return {
      ok: false,
      message:
        'The pull request body has no ## Security section. Name the controls this change touches and the threat each one meets, or "None" with a reason (ADR 0076).',
    };
  }
  if (givesNoReason(security)) {
    return {
      ok: false,
      message:
        'The ## Security section of the pull request body is empty or says none without a reason. Name the controls this change touches and the threat each one meets, or "None" with a reason (ADR 0076).',
    };
  }
  return { ok: true, message: '' };
}

// The job passes the pull request through the environment, never inside the run script, so a body
// cannot inject shell code. A missing PR_FROM_FORK counts as a fork, which grants no exemption.
if (import.meta.main) {
  const { ok, message } = checkPrSecurity({
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
