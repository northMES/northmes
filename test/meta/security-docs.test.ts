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
      expect(read(report), `${report} links its tracking issue`).toMatch(
        /https:\/\/github\.com\/northMES\/northmes\/issues\/\d+/,
      );
    }
  });
});
