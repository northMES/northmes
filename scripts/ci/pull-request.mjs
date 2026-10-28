// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// What the pull request checks read from a pull request: its title's commit type, its body's sections
// as GitHub renders them, and whether a bot opened it.

// Renovate's pull requests update dependencies and finish no issue. A GitHub user name cannot end
// in [bot], so only the Renovate app has this login.
const renovate = 'renovate[bot]';

// release-please opens the release pull request from a branch with this prefix in this repository.
// A fork can name a branch the same way, so the prefix counts only outside forks.
const releaseBranch = 'release-please--branches--';

/** Whether Renovate or release-please opened the pull request, which writes no body sections. */
export function isBotPullRequest({ author, headRef, fromFork }) {
  return author === renovate || (!fromFork && headRef.startsWith(releaseBranch));
}

// A Conventional Commit title marked as a breaking change: ! right before the colon.
const breakingTitle = /^[a-z]+(?:\([^()\s]+\))?!: /;

/** Whether the title marks a breaking change, as feat(core)!: ... does. */
export function isBreakingTitle(title) {
  return breakingTitle.test(title);
}

/** The Conventional Commit type of a title, such as feat in feat(planning)!: ..., or ''. */
export function commitType(title) {
  return /^(\w+)(?:\([^()\s]+\))?!?: /.exec(title)?.[1] ?? '';
}

// "None" alone, or a stand-in for it, gives no reason, also with emphasis or a closing mark.
const bareNone = /^[-*_\s]*(?:none|n\/a|na|-)[*_]*[.!:]?[*_]*$/i;

/** Whether a section's text is empty or says none without a reason. */
export function givesNoReason(text) {
  return text === '' || bareNone.test(text);
}

// A line that opens or closes a fenced code block, whose lines GitHub renders as code.
const fence = /^\s{0,3}(?:```|~~~)/;

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

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The text of the body's `## <heading>` section without HTML comments, or undefined without one.
 * The heading matches without regard to case.
 */
export function section(body, heading) {
  const lines = withoutComments(body).split(/\r?\n/);
  const title = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'i');
  let inFence = false;
  // Whether each line is a heading of level 1 or 2 outside a fenced code block.
  const headings = lines.map((line) => {
    if (fence.test(line)) inFence = !inFence;
    return !inFence && /^#{1,2}\s/.test(line.trim());
  });
  const start = lines.findIndex((line, index) => headings[index] && title.test(line.trim()));
  if (start === -1) return undefined;
  const end = headings.findIndex((isHeading, index) => isHeading && index > start);
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
}

/**
 * The changes of `git diff -z --name-status -M`: NUL-separated fields, the status and then the
 * path, or for a rename or copy the old path and then the new one. A moved file counts under its
 * new path, with the old one as `from` for a check that reads where it came from. -z keeps every
 * path as git stores it, where the plain output quotes unusual characters.
 * @returns {{ status: string, path: string, from?: string }[]}
 */
export function parseNameStatus(output) {
  const fields = output.split('\0');
  const changes = [];
  for (let index = 0; index < fields.length && fields[index] !== ''; ) {
    const status = fields[index];
    if (/^[RC]/.test(status)) {
      changes.push({ status, path: fields[index + 2], from: fields[index + 1] });
      index += 3;
    } else {
      changes.push({ status, path: fields[index + 1] });
      index += 2;
    }
  }
  return changes;
}
