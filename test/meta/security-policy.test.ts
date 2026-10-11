import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { root } from './docs.ts';

// SECURITY.md is the first file OpenSSF Scorecard, the OpenSSF Best Practices criteria and an
// auditor read (plan 12, ADR 0051). It names where to report, what happens next, which versions
// get fixes, and that a plugin runs with the server's rights (ADR 0037, ADR 0068).
describe('SECURITY.md', () => {
  const path = `${root}SECURITY.md`;
  const text = () => readFileSync(path, 'utf8');
  const headings = () =>
    text()
      .split('\n')
      .filter((line) => line.startsWith('## '));

  it('ADR0076 SECURITY.md names a reporting channel, a response target and the plugin trust model', () => {
    expect(existsSync(path), 'SECURITY.md').toBe(true);
    expect(headings()).toEqual(
      expect.arrayContaining([
        '## Reporting a vulnerability',
        '## What happens next',
        '## Supported versions',
        '## Plugins run with full trust',
      ]),
    );
    expect(text()).toContain('https://github.com/northMES/northmes/security/advisories/new');
    expect(text()).toContain('security@northmes.dev');
    expect(text()).toMatch(/within 5 working days/);
    expect(text()).toMatch(/within 10 working days/);
  });
});
