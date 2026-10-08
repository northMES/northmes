// Keeps TRUNCATE away from every role, so nm_app holds SELECT, INSERT, UPDATE and DELETE only
// (docs/adr/0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md). A GRANT
// statement whose privilege list names TRUNCATE is a finding, wherever it sits in a migration
// file: on its own, split over several lines, or inside ALTER DEFAULT PRIVILEGES. So is GRANT ALL
// on tables, which includes TRUNCATE; GRANT ALL on another kind of object, such as a schema or a
// sequence, is not. A GRANT inside a -- or /* */ comment is not a statement and is skipped. Text
// inside a string, a quoted identifier or a dollar-quoted body is scanned as it is, so a GRANT run
// through EXECUTE is a finding, and so is one in a comment inside a DO block's body.
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

// The object kinds of GRANT ... ON other than tables. An object without a kind is a table. A kind
// keyword is followed by whitespace and the object's name, so in types.rejection, types is a schema.
const otherKindPattern =
  /^(?:all\s+)?(?:sequences?|database|domain|foreign\s+(?:data\s+wrapper|server)|functions?|procedures?|routines?|language|large\s+object|parameter|schemas?|tablespace|types?)\s/i;

/**
 * Whether a GRANT with this privilege list on this object grants TRUNCATE.
 * @param {string} privileges
 * @param {string} object
 */
function grantsTruncate(privileges, object) {
  if (/\btruncate\b/i.test(privileges)) return true;
  return allPattern.test(privileges.trim()) && !otherKindPattern.test(object.trim());
}

// A dollar quote's tag: $$ or $name$, where the name does not start with a digit.
const dollarTagPattern = /\$(?:[A-Za-z_]\w*)?\$/y;

/**
 * The offset just past the closing quote of a string or quoted identifier whose text starts at
 * from. A doubled quote is an escaped quote, and so is a backslash before one in an E'' string.
 * @param {string} text
 * @param {number} from
 * @param {string} quote
 * @param {boolean} backslashEscapes
 */
function quoteEnd(text, from, quote, backslashEscapes) {
  for (let index = from; index < text.length; index += 1) {
    if (backslashEscapes && text[index] === '\\') {
      index += 1;
    } else if (text[index] === quote) {
      if (text[index + 1] !== quote) return index + 1;
      index += 1;
    }
  }
  return text.length;
}

/**
 * The offset just past the closing marker of a block comment whose text starts at from. Block
 * comments nest, as in Postgres, so each opening marker inside needs a closing marker of its own.
 * @param {string} text
 * @param {number} from
 */
function blockCommentEnd(text, from) {
  let depth = 1;
  for (let index = from; index < text.length - 1; index += 1) {
    const pair = text.slice(index, index + 2);
    if (pair === '/*' || pair === '*/') {
      depth += pair === '/*' ? 1 : -1;
      index += 1;
      if (depth === 0) return index + 1;
    }
  }
  return text.length;
}

/**
 * The comment, string, quoted identifier or dollar-quoted body that starts at start, as the offset
 * just past its end, or undefined when none starts there. An unclosed one runs to the end of text.
 * @param {string} text
 * @param {number} start
 * @returns {{ end: number, comment: boolean } | undefined}
 */
function regionAt(text, start) {
  const pair = text.slice(start, start + 2);
  if (pair === '--') {
    const newline = text.indexOf('\n', start);
    return { end: newline === -1 ? text.length : newline, comment: true };
  }
  if (pair === '/*') return { end: blockCommentEnd(text, start + 2), comment: true };
  const before = text[start - 1] ?? '';
  if (text[start] === "'") {
    const escapes = /[eE]/.test(before) && !/[\w$]/.test(text[start - 2] ?? '');
    return { end: quoteEnd(text, start + 1, "'", escapes), comment: false };
  }
  if (text[start] === '"') return { end: quoteEnd(text, start + 1, '"', false), comment: false };
  if (text[start] === '$' && !/[\w$]/.test(before)) {
    dollarTagPattern.lastIndex = start;
    const tag = dollarTagPattern.exec(text)?.[0];
    if (tag !== undefined) {
      const close = text.indexOf(tag, start + tag.length);
      return { end: close === -1 ? text.length : close + tag.length, comment: false };
    }
  }
  return undefined;
}

/**
 * Replaces each -- line comment and each block comment with spaces and keeps its newlines, so a
 * comment can neither hide a GRANT nor fake one, and offsets and line numbers stay the same. A --
 * or a /* inside a string, a quoted identifier or a dollar-quoted body starts no comment.
 * @param {string} text
 */
function blankComments(text) {
  let blanked = '';
  let index = 0;
  while (index < text.length) {
    const region = regionAt(text, index);
    if (region === undefined) {
      blanked += text[index];
      index += 1;
    } else {
      const part = text.slice(index, region.end);
      blanked += region.comment ? part.replace(/[^\n]/g, ' ') : part;
      index = region.end;
    }
  }
  return blanked;
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
