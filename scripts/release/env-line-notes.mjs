// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// The last step of the release image job (ADR 0080): adds the line to paste into .env, pinned by
// the image's digest, and the three upgrade commands to the release notes. The job passes the tag,
// the version and the digest through the environment, never inside the run script.

import { execFileSync } from 'node:child_process';

const heading = '## Install or upgrade';
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;

/** The .env line of a release, refusing a version or digest of any other shape. */
export function envLine(version, digest) {
  if (!versionPattern.test(version)) throw new Error(`Not a release version: ${version}`);
  if (!digestPattern.test(digest)) throw new Error(`Not an image digest: ${digest}`);
  return `NORTHMES_VERSION=${version}@${digest}`;
}

/** The release notes with the install and upgrade steps added under them, once. */
export function notesWithEnvLine(notes, version, digest) {
  if (notes.includes(heading)) return notes;
  const steps = [
    heading,
    '',
    'Set this line in `.env` next to `compose.yaml`:',
    '',
    '```',
    envLine(version, digest),
    '```',
    '',
    'Then run:',
    '',
    '```',
    'docker compose pull',
    'docker compose down',
    'docker compose up -d',
    '```',
  ].join('\n');
  return `${notes.trimEnd()}\n\n${steps}\n`;
}

if (import.meta.main) {
  const { TAG = '', VERSION = '', DIGEST = '' } = process.env;
  const notes = execFileSync('gh', ['release', 'view', TAG, '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8',
  });
  const updated = notesWithEnvLine(notes, VERSION, DIGEST);
  execFileSync('gh', ['release', 'edit', TAG, '--notes-file', '-'], { input: updated });
}
