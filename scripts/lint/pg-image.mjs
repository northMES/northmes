// Keeps every Postgres image reference on infra/pg-image.json (docs/adr/0041-test-strategy-tdd-
// vitest-projects-testcontainers-and-playwright.md). A reference other than the configured one is a
// finding, so `postgres:17` and `postgres:18` without the digest both fail. Three matchers read
// one line at a time:
//
// - Dockerfiles (Dockerfile, Dockerfile.* or *.Dockerfile): a FROM line that names `postgres`.
// - Compose files (compose*.y(a)ml, docker-compose*.y(a)ml): an `image: postgres:...` line.
// - Test files (*.test.* and *.test-d.*): a PostgreSqlContainer call with a literal other than the
//   configured image, or with no argument.
//
// A call split over several lines is not seen. docs/** and the pg-image test file are skipped.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const configuredImage = JSON.parse(
  readFileSync(new URL('../../infra/pg-image.json', import.meta.url), 'utf8'),
).image;

// FROM [--flag=value ...] image [AS name], with the instruction and AS in any case.
const fromPattern = /^FROM\s+(?:--\S+\s+)*(?<image>[^\s-]\S*)(?:\s+AS\s+\S+)?\s*$/i;

// A Compose `image: postgres:...` line, with the value optionally quoted and a trailing ` # comment`
// allowed. A name character must follow the colon, so `postgres:(\d+)` and `postgres:${TAG}` are
// not references.
const composeImagePattern =
  /^\s*image:\s*["']?(?<image>postgres:[A-Za-z0-9][^\s"']*)["']?(?:\s+#.*)?\s*$/;

// PostgreSqlContainer('literal') with a quoted literal, or PostgreSqlContainer() with none. An
// identifier argument has no quote, and a template literal with `${` stops the match at the `$`, so
// both are left alone.
const containerCallPattern =
  /PostgreSqlContainer\(\s*(?:(['"`])(?<literal>[^'"`$]+)\1|(?<noArgument>\)))/;

/**
 * @typedef {{ path: string, text: string }} RepositoryFile
 * @typedef {{ path: string, line: number, reference: string }} Finding
 */

/** @param {string} path */
function isDockerfile(path) {
  const name = basename(path);
  return name === 'Dockerfile' || name.startsWith('Dockerfile.') || name.endsWith('.Dockerfile');
}

/** @param {string} path */
function isCompose(path) {
  return /^(docker-)?compose.*\.ya?ml$/.test(basename(path));
}

/** @param {string} path */
function isTestFile(path) {
  return /\.test(-d)?\.[^.]+$/.test(basename(path));
}

/**
 * docs/** holds the spike sources and quotes images on purpose. The pg-image test file quotes the
 * calls it checks for. scripts/lint/pg-image.mjs and infra/pg-image.json need no entry because no
 * matcher reads them. Paths are repository-relative with forward slashes, as `git ls-files` prints
 * them.
 * @param {string} path
 */
function isSkipped(path) {
  return path.startsWith('docs/') || path === 'test/meta/pg-image.test.ts';
}

/** @param {string} reference */
function isPostgres(reference) {
  return reference.split(/[:@]/)[0] === 'postgres';
}

/**
 * The Postgres image reference a line names, if the file kind has a pattern for it.
 * @param {string} path
 * @param {string} content
 */
function referenceOn(path, content) {
  if (isDockerfile(path)) {
    const image = fromPattern.exec(content)?.groups?.image;
    return image && isPostgres(image) ? image : undefined;
  }
  if (isCompose(path)) {
    return composeImagePattern.exec(content)?.groups?.image;
  }
  if (isTestFile(path)) {
    const call = containerCallPattern.exec(content)?.groups;
    return call?.noArgument ? 'PostgreSqlContainer()' : call?.literal;
  }
  return undefined;
}

/**
 * Finds Postgres image references in Dockerfiles that differ from infra/pg-image.json.
 * @param {readonly RepositoryFile[]} files
 * @returns {Finding[]}
 */
export function scan(files) {
  /** @type {Finding[]} */
  const findings = [];

  for (const { path, text } of files) {
    if (isSkipped(path)) {
      continue;
    }
    text.split('\n').forEach((content, index) => {
      const reference = referenceOn(path, content);
      if (reference && reference !== configuredImage) {
        findings.push({ path, line: index + 1, reference });
      }
    });
  }

  return findings;
}
