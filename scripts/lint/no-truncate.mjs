// Keeps TRUNCATE away from every role, so nm_app holds SELECT, INSERT, UPDATE and DELETE only
// (docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md). A GRANT
// statement whose privilege list names TRUNCATE is a finding, wherever it sits in a migration
// file: on its own, split over several lines, or inside ALTER DEFAULT PRIVILEGES. So is GRANT ALL
// on tables, which includes TRUNCATE; GRANT ALL on another kind of object, such as a schema or a
// sequence, is not. A GRANT inside a -- or /* */ comment is not a statement and is skipped.
//
// test/meta/no-truncate.test.ts scans every .sql file under a migrations folder outside docs/, so
// pnpm check fails on a finding.

/**
 * @typedef {{ path: string, text: string }} MigrationFile
 * @typedef {{ path: string, line: number }} Finding
 */

// GRANT <privileges> ON <object> TO, within one statement. The privilege list ends at the first ON.
const grantPattern = /\bgrant\s+(?<privileges>[^;]*?)\s+on\s+(?<object>[^;]*?)\s+to\b/gi;

// ALL or ALL PRIVILEGES without a column list, which on a table includes TRUNCATE.
const allPattern = /^all(?:\s+privileges)?$/i;

// The object kinds of GRANT ... ON other than tables. An object without a kind is a table.
const otherKindPattern =
  /^(?:all\s+)?(?:sequences?|database|domain|foreign\s+(?:data\s+wrapper|server)|functions?|procedures?|routines?|language|large\s+object|parameter|schemas?|tablespace|types?)\b/i;

/**
 * Whether a GRANT with this privilege list on this object grants TRUNCATE.
 * @param {string} privileges
 * @param {string} object
 */
function grantsTruncate(privileges, object) {
  if (/\btruncate\b/i.test(privileges)) return true;
  return allPattern.test(privileges.trim()) && !otherKindPattern.test(object.trim());
}

/**
 * Replaces each -- line comment and each block comment with spaces and keeps its newlines, so a
 * comment can neither hide a GRANT nor fake one, and offsets and line numbers stay the same. A --
 * inside a string literal counts as a comment too, which a GRANT in a migration does not need.
 * @param {string} text
 */
function blankComments(text) {
  return text.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

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
    for (const grant of blankComments(text).matchAll(grantPattern)) {
      if (grantsTruncate(grant.groups?.privileges ?? '', grant.groups?.object ?? '')) {
        findings.push({ path, line: lineAt(text, grant.index) });
      }
    }
  }

  return findings;
}
