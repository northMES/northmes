// Prints the next free ADR number (docs/adr/README.md, "Adding an ADR"). Two sessions that scan
// docs/adr/ can take the same number, so the number comes from the index.

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
