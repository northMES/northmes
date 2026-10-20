// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Reads the sections of a pull request body as GitHub renders them, for the pull request checks.

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

function escapeRegExp(text) {
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
