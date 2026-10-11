// The check behind CI / pr security. Every pull request body has a Security section that names the
// controls the change touches and the threat each one meets, or says none with a reason (ADR 0076).

import { errorAnnotation } from './annotation.mjs';

// Renovate's and release-please's pull requests, as CI / linked issue exempts them: neither app
// writes the section, and dependency updates go through the license and supply-chain checks.
const renovate = 'renovate[bot]';
const releaseBranch = 'release-please--branches--';

// "None" alone, or a stand-in for it, gives no reason.
const bareNone = /^[-*\s]*(?:none|n\/a|na|-)[.!]?$/i;

/**
 * The text without its HTML comments, as GitHub renders it: a comment that is never closed hides
 * the rest of the text.
 */
function withoutComments(text) {
  let kept = '';
  let from = 0;
  for (;;) {
    const open = text.indexOf('<!--', from);
    if (open === -1) return kept + text.slice(from);
    kept += text.slice(from, open);
    const close = text.indexOf('-->', open + 4);
    if (close === -1) return kept;
    from = close + 3;
  }
}

/** The text of the body's `## Security` section without HTML comments, or undefined without one. */
function securitySection(body) {
  const lines = withoutComments(body).split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Security\s*$/i.test(line.trim()));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,2}\s/.test(line.trim()));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

export function checkPrSecurity({ body, author, headRef, fromFork }) {
  const release = !fromFork && headRef.startsWith(releaseBranch);
  if (author === renovate || release) return { ok: true, message: '' };
  const section = securitySection(body);
  if (section === undefined) {
    return {
      ok: false,
      message:
        'The pull request body has no ## Security section. Name the controls this change touches and the threat each one meets, or "None" with a reason (ADR 0076).',
    };
  }
  if (section === '' || bareNone.test(section)) {
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
