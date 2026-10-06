// Keeps customer data out of the repository (docs/plan/11-quality-and-testing.md, "Test data and
// fixtures"). Two checks run:
//
// - The organisation number pattern (six digits, a hyphen, four digits) fails in any file.
// - A deny-listed customer name fails in files under docs/sources/ and under any folder named
//   fixtures. The deny list is never committed; the check receives it as SHA-256 hashes. Without
//   hashes (local runs, handoff's Tester, fork pull requests) the name check is skipped with a
//   notice and the number check still runs.
//
// Names are compared as hashes of word sequences. Text is folded with Unicode NFKC and lowercased,
// and a word is a run of letters, combining marks and digits, so punctuation, line breaks and runs
// of whitespace all separate words alike. A deny-list entry is the SHA-256 (hex) of the name's
// words joined by one space: "Acme Verkstad AB", "ACME  verkstad, ab" and "acme-verkstad ab" all
// hash as "acme verkstad ab". The check hashes every sequence of 1 to 8 consecutive words in a
// file, so a name of up to 8 words matches even when it wraps across lines, and a longer word
// such as "abc" never matches the entry "ab".
//
// Findings name the file and line only, never the matched text, because CI logs are public.

import { createHash } from 'node:crypto';

const organisationNumberPattern = /\d{6}-\d{4}/;
const wordPattern = /[\p{L}\p{M}\p{N}]+/gu;

/** The longest name, in words, that the name check compares. */
const maxNameWords = 8;

const skippedNameCheckNotice =
  'No deny hashes were given, so the customer name check was skipped. The organisation number check ran.';

/**
 * @typedef {{ path: string, content: string }} RepositoryFile
 * @typedef {'organisation-number' | 'customer-name'} FindingKind
 * @typedef {{ path: string, line: number, kind: FindingKind }} Finding
 */

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** @param {string} path */
function isNameChecked(path) {
  return path.startsWith('docs/sources/') || path.split('/').slice(0, -1).includes('fixtures');
}

function countNewlines(text, from, to) {
  let count = 0;
  for (let at = text.indexOf('\n', from); at !== -1 && at < to; at = text.indexOf('\n', at + 1)) {
    count += 1;
  }
  return count;
}

/** The folded words of a text, each with the line it starts on. */
function words(content) {
  const folded = content.normalize('NFKC').toLowerCase();
  const result = [];
  let line = 1;
  let counted = 0;
  for (const match of folded.matchAll(wordPattern)) {
    line += countNewlines(folded, counted, match.index);
    counted = match.index;
    result.push({ word: match[0], line });
  }
  return result;
}

/** @returns {Set<number>} */
function organisationNumberLines(content) {
  const lines = new Set();
  content.split('\n').forEach((text, index) => {
    if (organisationNumberPattern.test(text)) {
      lines.add(index + 1);
    }
  });
  return lines;
}

/** @returns {Set<number>} */
function customerNameLines(content, denyHashes) {
  const lines = new Set();
  const found = words(content);
  for (let start = 0; start < found.length; start += 1) {
    const last = Math.min(found.length, start + maxNameWords);
    let phrase = '';
    for (let end = start; end < last; end += 1) {
      phrase = end === start ? found[end].word : `${phrase} ${found[end].word}`;
      if (denyHashes.has(sha256(phrase))) {
        lines.add(found[start].line);
        break;
      }
    }
  }
  return lines;
}

/**
 * Scans in-memory files for organisation numbers and deny-listed customer names.
 * @param {readonly RepositoryFile[]} files
 * @param {Iterable<string> | undefined} denyHashes SHA-256 hex digests of the deny-listed names.
 * @returns {{ findings: Finding[], notice?: string }}
 */
export function scan(files, denyHashes) {
  const hashes = new Set([...(denyHashes ?? [])].map((hash) => hash.trim().toLowerCase()));
  const nameCheck = hashes.size > 0;
  const findings = [];

  for (const { path, content } of files) {
    /** @type {Finding[]} */
    const inFile = [];
    for (const line of organisationNumberLines(content)) {
      inFile.push({ path, line, kind: 'organisation-number' });
    }
    if (nameCheck && isNameChecked(path)) {
      for (const line of customerNameLines(content, hashes)) {
        inFile.push({ path, line, kind: 'customer-name' });
      }
    }
    findings.push(...inFile.sort((a, b) => a.line - b.line));
  }

  return nameCheck ? { findings } : { findings, notice: skippedNameCheckNotice };
}
