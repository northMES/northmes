import { describe, expect, it } from 'vitest';
import { scan } from '../../scripts/lint/path-literals.mjs';

describe('path-literals', () => {
  it('E02-S05 a fixture <Link to="/x"> in a module web file fails, and a builder call passes', () => {
    const text = [
      "import { planningLinks } from '@northmes/planning-contracts';",
      '',
      'export function Board({ plant }: { plant: string }) {',
      '  return (',
      '    <nav>',
      '      <Link to="/x">X</Link>',
      '      <Link {...planningLinks.orders({ plant })}>Orders</Link>',
      '      <Link to={planningLinks.orders({ plant }).to}>Orders</Link>',
      '    </nav>',
      '  );',
      '}',
      '',
    ].join('\n');

    const findings = scan([{ path: 'modules/planning/web/src/board.tsx', text }], []);

    expect(findings).toEqual([
      { path: 'modules/planning/web/src/board.tsx', line: 6, literal: '/x' },
    ]);
  });
});
