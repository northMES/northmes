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
// `node scripts/lint/no-customer-data.mjs` (root script `pnpm lint:customer-data`) scans every
// text file git tracks in the current repository and reads the deny hashes from
// NORTHMES_DENY_HASHES, separated by commas (whitespace also works). It exits 1 on any finding and
// 2 when the variable holds something other than SHA-256 hex digests. Binary files (a NUL byte in
// the first 8000 bytes, git's own test), symbolic links and untracked files are not scanned.
//
// `node scripts/lint/no-customer-data.mjs --hash` reads one name per line on stdin and prints each
// distinct name's deny hash, the value to put in NORTHMES_DENY_HASHES. It exits 2 on a name longer
// than 8 words, which the scan could never match.
//
// Findings and errors name the file and line only, never the matched text, because CI logs are
// public.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const organisationNumberPattern = /\d{6}-\d{4}/;
const wordPattern = /[\p{L}\p{M}\p{N}]+/gu;

/** The longest name, in words, that the name check compares. */
const maxNameWords = 8;

const denyHashesVariable = 'NORTHMES_DENY_HASHES';
const hashPattern = /^[0-9a-f]{64}$/i;

/** Git's own test for a binary file: a NUL byte in the first 8000 bytes. */
const binaryProbeLength = 8000;

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

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

/**
 * Reads every tracked regular text file of the git repository that holds `cwd`.
 * @param {string} cwd
 * @returns {RepositoryFile[]}
 */
function readTrackedFiles(cwd) {
  const top = git(cwd, 'rev-parse', '--show-toplevel').trim();
  const files = [];
  for (const path of git(top, 'ls-files', '-z').split('\0').filter(Boolean)) {
    const absolute = join(top, path);
    let stats;
    try {
      stats = lstatSync(absolute);
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    if (!stats.isFile()) {
      continue;
    }
    const buffer = readFileSync(absolute);
    if (!buffer.subarray(0, binaryProbeLength).includes(0)) {
      files.push({ path, content: buffer.toString('utf8') });
    }
  }
  return files;
}

/**
 * @param {string | undefined} value
 * @returns {{ hashes: string[] } | { error: string }}
 */
function parseDenyHashes(value) {
  const hashes = (value ?? '').split(/[\s,]+/).filter(Boolean);
  const invalid = hashes.findIndex((hash) => !hashPattern.test(hash));
  if (invalid !== -1) {
    return {
      error: `Entry ${invalid + 1} of ${denyHashesVariable} is not a SHA-256 hex digest. The variable holds hashes of the deny-listed names, never the names.`,
    };
  }
  return { hashes };
}

const kindLabels = {
  'organisation-number': 'organisation number pattern',
  'customer-name': 'deny-listed customer name',
};

function printHashes() {
  const hashes = new Set();
  const lines = readFileSync(0, 'utf8').split('\n');
  for (const [index, name] of lines.entries()) {
    const nameWords = words(name).map(({ word }) => word);
    if (nameWords.length > maxNameWords) {
      console.error(
        `Line ${index + 1} has more than ${maxNameWords} words, and the name check compares at most ${maxNameWords}.`,
      );
      process.exitCode = 2;
      return;
    }
    if (nameWords.length > 0) {
      hashes.add(sha256(nameWords.join(' ')));
    }
  }
  for (const hash of hashes) {
    console.log(hash);
  }
}

function main() {
  const parsed = parseDenyHashes(process.env[denyHashesVariable]);
  if ('error' in parsed) {
    console.error(parsed.error);
    process.exitCode = 2;
    return;
  }

  const files = readTrackedFiles(process.cwd());
  const { findings, notice } = scan(files, parsed.hashes);
  if (notice) {
    console.log(`Notice: ${notice} Set ${denyHashesVariable} to run the name check.`);
  }
  for (const { path, line, kind } of findings) {
    console.error(`${path}:${line}: ${kindLabels[kind]}`);
  }
  if (findings.length > 0) {
    console.error(
      `${findings.length} finding(s) in ${files.length} tracked files. Replace them with synthetic values (docs/plan/11-quality-and-testing.md, "Test data and fixtures").`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`No customer data found in ${files.length} tracked files.`);
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
  if (process.argv.includes('--hash')) {
    printHashes();
  } else {
    main();
  }
}
