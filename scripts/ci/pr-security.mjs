// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind CI / pr security. Every pull request body has a Security section that names the
// controls the change touches and the threat each one meets, or says none with a reason (ADR 0076).

import { errorAnnotation } from './annotation.mjs';
import { section } from './pr-body.mjs';

// Renovate's and release-please's pull requests, as CI / linked issue exempts them: neither app
// writes the section, and dependency updates go through the license and supply-chain checks.
const renovate = 'renovate[bot]';
const releaseBranch = 'release-please--branches--';

// "None" alone, or a stand-in for it, gives no reason, also with emphasis or a closing mark.
const bareNone = /^[-*_\s]*(?:none|n\/a|na|-)[*_]*[.!:]?[*_]*$/i;

export function checkPrSecurity({ body, author, headRef, fromFork }) {
  const release = !fromFork && headRef.startsWith(releaseBranch);
  if (author === renovate || release) return { ok: true, message: '' };
  const security = section(body, 'Security');
  if (security === undefined) {
    return {
      ok: false,
      message:
        'The pull request body has no ## Security section. Name the controls this change touches and the threat each one meets, or "None" with a reason (ADR 0076).',
    };
  }
  if (security === '' || bareNone.test(security)) {
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
