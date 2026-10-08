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

  it('E02-S05 a path literal in href= or inside a JSX expression fails', () => {
    const text = [
      'export const menu = (',
      '  <nav>',
      '    <a href="/">Home</a>',
      "    <ModuleLink href={'/plant-a/planning'}>Planning</ModuleLink>",
      '    <Navigate to={"/x"} />',
      '  </nav>',
      ');',
      '',
    ].join('\n');

    const findings = scan([{ path: 'apps/web/src/menu.tsx', text }], []);

    expect(findings).toEqual([
      { path: 'apps/web/src/menu.tsx', line: 3, literal: '/' },
      { path: 'apps/web/src/menu.tsx', line: 4, literal: '/plant-a/planning' },
      { path: 'apps/web/src/menu.tsx', line: 5, literal: '/x' },
    ]);
  });
});
