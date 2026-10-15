// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { envLine, notesWithEnvLine } from './env-line-notes.mjs';

const digest = `sha256:${'a'.repeat(64)}`;

describe('env-line-notes (ADR 0080)', () => {
  it('pins the version line by the image digest', () => {
    expect(envLine('0.0.1', digest)).toBe(`NORTHMES_VERSION=0.0.1@${digest}`);
  });

  it('refuses a version that is not x.y.z or x.y.z-pre', () => {
    expect(() => envLine('0.0.1; rm -rf /', digest)).toThrow(/version/);
    expect(envLine('0.1.0-rc.1', digest)).toBe(`NORTHMES_VERSION=0.1.0-rc.1@${digest}`);
  });

  it('refuses a digest that is not sha256 and 64 hex characters', () => {
    expect(() => envLine('0.0.1', 'sha256:abc')).toThrow(/digest/);
  });

  it('adds the upgrade steps under the release notes once', () => {
    const notes = notesWithEnvLine('## Features\n\n* a', '0.0.1', digest);

    expect(notes).toContain('## Features\n\n* a\n\n## Install or upgrade');
    expect(notes).toContain(`NORTHMES_VERSION=0.0.1@${digest}`);
    expect(notes).toContain('docker compose pull');
    expect(notesWithEnvLine(notes, '0.0.1', digest)).toBe(notes);
  });
});
