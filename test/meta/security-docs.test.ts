// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { root, trackedFiles } from './docs.ts';

// The evidence that ADR 0076 keeps for an auditor: the pull request template asks for the
// security note, the controls index states each control's status, and every audit report is
// linked from the index and names its tracking issue.

function read(path: string): string {
  return readFileSync(`${root}${path}`, 'utf8');
}

const index = 'docs/security/README.md';
const statuses = new Set(['built', 'decided', 'gap', 'accepted']);

describe('security docs', () => {
  it('ADR0076 the pull request template asks for a Security section and the validation impact', () => {
    const headings = read('.github/PULL_REQUEST_TEMPLATE.md')
      .split('\n')
      .filter((line) => line.startsWith('## '));

    expect(headings).toEqual(expect.arrayContaining(['## Security', '## Validation impact']));
  });

  it('ADR0076 every control in the controls index has the status built, decided, gap or accepted', () => {
    const rows = read(index)
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Control |'))
      .map((line) => line.split(' | ').map((cell) => cell.replace(/^\| /, '').trim()));
    const unknown = rows.filter(([, status]) => !statuses.has(status?.split(' ')[0] ?? ''));

    expect(rows.length).toBeGreaterThan(0);
    expect(unknown).toEqual([]);
  });

  it('ADR0076 the controls index links the threat model, and the threat model lists every surface', () => {
    expect(read(index)).toContain('(threat-model.md)');
    const surfaces = read('docs/security/threat-model.md')
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Surface |'))
      .map((line) => line.split(' | ')[0]?.replace(/^\| /, '').toLowerCase() ?? '');

    // The surfaces #485 names. A new surface adds its row to the threat model (ADR 0076 rule 4).
    for (const surface of [
      'web app',
      'graphql',
      'rest',
      'websocket',
      'cli',
      'plugins',
      'erp connector',
      'operator station',
    ]) {
      expect(
        surfaces.some((row) => row.includes(surface)),
        `threat model surface ${surface}`,
      ).toBe(true);
    }
  });

  it('ADR0076 the controls index links the risk register, and each accepted risk has an owner, a review date and an ADR or issue', () => {
    expect(read(index)).toContain('(risks.md)');
    const rows = read('docs/security/risks.md')
      .split('\n')
      .filter((line) => /^\| A-\d{2} \|/.test(line));

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const [, , , owner = '', review = '', link = ''] = row.split(' | ');
      expect(owner.trim(), row.slice(0, 40)).not.toBe('');
      expect(review.trim(), row.slice(0, 40)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(link, row.slice(0, 40)).toMatch(/ADR \d{4}|#\d+/);
    }
  });

  it('ADR0076 the controls index links every audit report, and each report links its tracking issue', () => {
    const reports = [...trackedFiles()].filter((path) =>
      /^docs\/security\/audits\/\d{4}-\d{2}-\d{2}\.md$/.test(path),
    );
    const text = read(index);

    expect(reports.length).toBeGreaterThan(0);
    for (const report of reports) {
      expect(text, `${index} links ${report}`).toContain(
        `(${report.replace('docs/security/', '')})`,
      );
      const reportText = read(report);
      expect(reportText, `${report} links its tracking issue`).toMatch(
        /https:\/\/github\.com\/northMES\/northmes\/issues\/\d+/,
      );
      // Each finding names its issue, or says why it has none: fixed, accepted, none, noted or
      // checked again later.
      const findings = reportText.split('\n').filter((line) => /^\| [A-Z]+\d+ \|/.test(line));
      for (const finding of findings) {
        const disposition = finding.split(' | ').at(-1)?.replace(/\|$/, '').trim() ?? '';
        expect(disposition, `${report}: ${finding.slice(0, 40)}`).toMatch(
          /#\d+|^fixed\b|^accepted\b|^none\b|^noted\b|^checked again\b/,
        );
      }
    }
  });
});
