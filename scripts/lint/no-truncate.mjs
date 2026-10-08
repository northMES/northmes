// Keeps TRUNCATE away from every role, so nm_app holds SELECT, INSERT, UPDATE and DELETE only
// (docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md). A GRANT
// statement whose privilege list names TRUNCATE is a finding, wherever it sits in a migration
// file: on its own, split over several lines, or inside ALTER DEFAULT PRIVILEGES.
//
// test/meta/no-truncate.test.ts scans every .sql file under a migrations folder outside docs/, so
// pnpm check fails on a finding.

/**
 * @typedef {{ path: string, text: string }} MigrationFile
 * @typedef {{ path: string, line: number }} Finding
 */

// GRANT <privileges> ON <object> TO, within one statement. The privilege list ends at the first ON.
const grantPattern = /\bgrant\s+(?<privileges>[^;]*?)\s+on\s+[^;]*?\s+to\b/gi;

/**
 * The 1-based line of an offset in text.
 * @param {string} text
 * @param {number} offset
 */
function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

/**
 * Finds the GRANT statements that grant TRUNCATE, by file and the line the statement starts on.
 * @param {readonly MigrationFile[]} files
 * @returns {Finding[]}
 */
export function scan(files) {
  /** @type {Finding[]} */
  const findings = [];

  for (const { path, text } of files) {
    for (const grant of text.matchAll(grantPattern)) {
      if (/\btruncate\b/i.test(grant.groups?.privileges ?? '')) {
        findings.push({ path, line: lineAt(text, grant.index) });
      }
    }
  }

  return findings;
}
