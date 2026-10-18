// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The check behind CI / openapi diff (ADR 0064). The job runs oasdiff breaking on the base branch's
// schema/openapi-v1.json and the pull request's, writes what it finds as JSON, and this script
// decides: an ERR-level change fails, unless NorthMES is still 0.x and the title carries !, the
// breaking-change marker that also bumps the minor and puts the break in the changelog (ADR 0038).
// From 1.0 every ERR-level change fails, because a break of the public API needs a new API major.
// A WARN-level change is reported and passes.

import { existsSync, readFileSync } from 'node:fs';
import { errorAnnotation } from './annotation.mjs';

/** oasdiff's levels (checker/rules/level.go). */
const ERR = 3;
const WARN = 2;

/** A Conventional Commit title marked as a breaking change: ! right before the colon. */
const breakingTitle = /^[a-z]+(?:\([^()\s]+\))?!: /;

/** A workflow command with its message encoded as GitHub decodes it. */
function annotation(kind, message) {
  return errorAnnotation(message).replace(/^::error::/, `::${kind}::`);
}

/** One change as a line: the operation, its path and oasdiff's text. */
function describe({ operation, path, text, id }) {
  return `${operation ?? ''} ${path ?? ''}: ${text ?? id}`.trim();
}

/**
 * Whether the changes oasdiff found may merge. `changes` is undefined when the base branch has no
 * schema/openapi-v1.json. Returns ok and the lines the job prints, as workflow commands.
 * @param {{ changes: readonly { level: number, id?: string, text?: string, operation?: string, path?: string }[] | undefined, title: string, version: string }} input
 * @returns {{ ok: boolean, lines: string[] }}
 */
export function checkBreaking({ changes, title, version }) {
  if (changes === undefined) {
    return {
      ok: true,
      lines: [
        annotation(
          'notice',
          'The base branch has no schema/openapi-v1.json, so there is no public API to break.',
        ),
      ],
    };
  }
  const errors = changes.filter(({ level }) => level >= ERR);
  const lines = changes
    .filter(({ level }) => level === WARN)
    .map((change) => annotation('warning', describe(change)));
  if (errors.length === 0) return { ok: true, lines };
  const listed = errors.map(describe).join('\n');
  const isZero = version.startsWith('0.');
  if (isZero && breakingTitle.test(title)) {
    lines.push(
      annotation(
        'notice',
        `This pull request breaks the public API, and its title marks the break with !, so the release notes name it:\n${listed}`,
      ),
    );
    return { ok: true, lines };
  }
  const remedy = isZero
    ? 'Keep the API compatible, or mark the break with ! before the colon of the title, such as feat(core)!: ..., so the release bumps the minor and the changelog names it.'
    : 'From 1.0 the public API breaks only in a new API major: keep this operation compatible and add the changed one under the next major.';
  lines.push(errorAnnotation(`This pull request breaks the public API.\n${listed}\n${remedy}`));
  return { ok: false, lines };
}

// The job passes the title through the environment, never inside the run script, so a title cannot
// inject shell code.
if (import.meta.main) {
  const file = process.env.OPENAPI_CHANGES ?? '';
  const changes = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
  const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
  const { ok, lines } = checkBreaking({ changes, title: process.env.PR_TITLE ?? '', version });
  for (const line of lines) console.log(line);
  if (!ok) process.exitCode = 1;
}
