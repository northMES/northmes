// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkBreaking } from './openapi-diff.mjs';

const script = fileURLToPath(new URL('./openapi-diff.mjs', import.meta.url));

// What oasdiff breaking --format json prints when a pull request removes the required response
// property name of GET /api/v1/core/articles/{id}: an ERR-level change (level 3).
const removedResponseField = [
  {
    id: 'response-required-property-removed',
    text: "removed the required property 'name' from the response with the '200' status",
    level: 3,
    operation: 'GET',
    operationId: 'coreArticle',
    path: '/api/v1/core/articles/{id}',
    section: 'paths',
  },
];

// A WARN-level change (level 2), which the gate reports and does not block on.
const warning = [
  {
    id: 'response-non-success-status-removed',
    text: "removed the non-success response with the status '412'",
    level: 2,
    operation: 'POST',
    operationId: 'coreUpdateArticle',
    path: '/api/v1/core/commands/update-article',
    section: 'paths',
  },
];

// An added optional response field is no breaking change, so oasdiff breaking prints none.
const addedOptionalResponseField: unknown[] = [];

// Runs the script as the CI / openapi diff job does: the title in PR_TITLE, and oasdiff's output in
// the file OPENAPI_CHANGES names, or no file when the base branch has no document.
function run(title: string, changes: unknown[] | undefined) {
  const dir = mkdtempSync(join(tmpdir(), 'openapi-diff-'));
  const file = join(dir, 'changes.json');
  if (changes) writeFileSync(file, JSON.stringify(changes));
  return spawnSync(process.execPath, [script], {
    env: { PATH: process.env.PATH, PR_TITLE: title, OPENAPI_CHANGES: file },
    encoding: 'utf8',
  });
}

describe('CI / openapi diff', () => {
  it('ADR0064 a removed response field under a title without ! fails and names the change', () => {
    const result = run('feat(core): rename the article name field', removedResponseField);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('::error::');
    expect(result.stdout).toContain(
      "GET /api/v1/core/articles/{id}: removed the required property 'name'",
    );
    expect(result.stdout).toContain('!');
  });

  it('ADR0064 the same change titled feat(planning)!: passes in 0.x', () => {
    const result = run('feat(planning)!: rename the article name field', removedResponseField);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('::notice::');
  });

  it('ADR0064 an added optional response field passes', () => {
    expect(run('feat(core): add the article weight', addedOptionalResponseField).status).toBe(0);
  });

  it('ADR0064 at version 1.0.0 a removed field fails even with !', () => {
    const result = checkBreaking({
      changes: removedResponseField,
      title: 'feat(core)!: rename the article name field',
      version: '1.0.0',
    });

    expect(result.ok).toBe(false);
    expect(result.lines.join('\n')).toContain('new API major');
  });

  it('ADR0064 a WARN-level change is reported as a warning and passes', () => {
    const result = run('fix(core): stop answering 412 on update', warning);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "::warning::POST /api/v1/core/commands/update-article: removed the non-success response with the status '412'",
    );
  });

  it('ADR0064 a base branch without schema/openapi-v1.json passes with a notice, since there is nothing to compare', () => {
    const result = run('feat(core): serve the public API', undefined);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('::notice::');
    expect(result.stdout).toContain('schema/openapi-v1.json');
  });
});
