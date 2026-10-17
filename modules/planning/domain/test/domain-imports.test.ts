// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The rules of ADR 0057 for the planning domain package: no Nest, Kysely or pg, no process.env,
 * no clock, no locale-dependent comparison. A finding names the file, the line and the text.
 */
const source = fileURLToPath(new URL('../src/', import.meta.url));

const banned: ReadonlyArray<{ readonly pattern: RegExp; readonly why: string }> = [
  { pattern: /from '@nestjs\//, why: 'the domain imports no Nest module' },
  { pattern: /from '(pg|kysely)'/, why: 'the domain reads no database' },
  { pattern: /from 'react(-dom)?'/, why: 'the domain renders nothing' },
  { pattern: /process\.env/, why: 'the domain reads no environment' },
  { pattern: /Temporal\.Now|Date\.now\(|new Date\(\)/, why: 'now is an argument' },
  { pattern: /localeCompare|Intl\.Collator/, why: 'comparators compare code units (ADR 0028)' },
  { pattern: /Math\.random/, why: 'nothing inside uses randomness' },
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('domain imports (ADR 0057)', () => {
  it('the package holds source files', () => {
    expect(sourceFiles(source).length).toBeGreaterThan(0);
  });

  it('no source file imports Nest, Kysely, pg or React, reads process.env, the clock or a locale', () => {
    const findings: string[] = [];
    for (const path of sourceFiles(source)) {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        for (const { pattern, why } of banned) {
          if (pattern.test(line)) {
            findings.push(`${relative(source, path)}:${index + 1} ${line.trim()} (${why})`);
          }
        }
      });
    }
    expect(findings).toEqual([]);
  });
});
