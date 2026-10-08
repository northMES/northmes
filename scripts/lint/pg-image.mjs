// Keeps every Postgres image reference on infra/pg-image.json (docs/adr/0041-test-strategy-tdd-
// vitest-projects-testcontainers-and-playwright.md). A Dockerfile whose FROM line names the image
// `postgres` with any reference other than the configured one is a finding, so `postgres:17` and
// `postgres:18` without the digest both fail.
//
// This first slice reads Dockerfiles only: files named Dockerfile, Dockerfile.* or *.Dockerfile.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const configuredImage = JSON.parse(
  readFileSync(new URL('../../infra/pg-image.json', import.meta.url), 'utf8'),
).image;

// FROM [--flag=value ...] image [AS name], with the instruction and AS in any case.
const fromPattern = /^FROM\s+(?:--\S+\s+)*(?<image>[^\s-]\S*)(?:\s+AS\s+\S+)?\s*$/i;

// A Compose `image: postgres:...` line, with the value optionally quoted. A name character must
// follow the colon, so `postgres:(\d+)` and `postgres:${TAG}` are not references.
const composeImagePattern = /^\s*image:\s*["']?(?<image>postgres:[A-Za-z0-9][^\s"']*)["']?\s*$/;

// PostgreSqlContainer('literal') with a quoted literal. An identifier argument has no quote, and a
// template literal with `${` stops the match at the `$`, so both are left alone.
const containerCallPattern = /PostgreSqlContainer\(\s*(['"`])(?<literal>[^'"`$]+)\1/;

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
    return containerCallPattern.exec(content)?.groups?.literal;
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
    text.split('\n').forEach((content, index) => {
      const reference = referenceOn(path, content);
      if (reference && reference !== configuredImage) {
        findings.push({ path, line: index + 1, reference });
      }
    });
  }

  return findings;
}
