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

const fromPattern = /^FROM\s+(\S+)\s*$/;

/**
 * @typedef {{ path: string, text: string }} RepositoryFile
 * @typedef {{ path: string, line: number, reference: string }} Finding
 */

/** @param {string} path */
function isDockerfile(path) {
  const name = basename(path);
  return name === 'Dockerfile' || name.startsWith('Dockerfile.') || name.endsWith('.Dockerfile');
}

/** @param {string} reference */
function isPostgres(reference) {
  return reference.split(/[:@]/)[0] === 'postgres';
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
    if (!isDockerfile(path)) {
      continue;
    }
    text.split('\n').forEach((content, index) => {
      const reference = fromPattern.exec(content)?.[1];
      if (reference && isPostgres(reference) && reference !== configuredImage) {
        findings.push({ path, line: index + 1, reference });
      }
    });
  }

  return findings;
}
