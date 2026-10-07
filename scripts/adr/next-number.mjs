// Prints the next free ADR number (docs/adr/README.md, "Adding an ADR"). Two sessions that scan
// docs/adr/ can take the same number, so the number comes from the index.
//
// `node scripts/adr/next-number.mjs` (root script `pnpm adr:next`) reads docs/adr/README.md, found
// from this file's location so the working directory does not matter, and prints the number with
// four digits, such as 0069.

import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * The number that follows the highest one in the index table. A row is a table line that starts
 * with a four-digit number cell. The "Next free number" line and other prose are not rows.
 * @param {string} indexMarkdown The text of docs/adr/README.md.
 * @returns {number} 1 when the index has no rows.
 */
export function nextNumber(indexMarkdown) {
  let highest = 0;
  for (const line of indexMarkdown.split('\n')) {
    const digits = /^\|\s*(\d{4})\s*\|/.exec(line)?.[1];
    if (digits !== undefined) {
      highest = Math.max(highest, Number.parseInt(digits, 10));
    }
  }
  return highest + 1;
}

function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    // Under --eval, argv[1] is a positional argument, not a script path.
    return false;
  }
}

if (isEntryPoint()) {
  const index = readFileSync(new URL('../../docs/adr/README.md', import.meta.url), 'utf8');
  console.log(String(nextNumber(index)).padStart(4, '0'));
}
