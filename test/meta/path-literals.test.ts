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

  it('E02-S05 navigate({ to: "/x" }) and page.goto("/x") fail, and an allowlisted literal with a reason passes', () => {
    const files = [
      {
        path: 'modules/planning/web/src/use-release.ts',
        text: [
          'export function useRelease() {',
          '  const navigate = useNavigate();',
          "  return () => navigate({ to: '/x' });",
          '}',
          '',
        ].join('\n'),
      },
      {
        path: 'e2e/board.spec.ts',
        text: [
          "test('board', async ({ page }) => {",
          "  await page.goto('/x');",
          "  await page.goto('/plant-a/planning/board');",
          '});',
          '',
        ].join('\n'),
      },
    ];
    const allowlist = [
      {
        path: 'e2e/board.spec.ts',
        literal: '/plant-a/planning/board',
        reason: 'The spec opens the board URL as a person types it.',
      },
    ];

    const findings = scan(files, allowlist);

    expect(findings).toEqual([
      { path: 'modules/planning/web/src/use-release.ts', line: 3, literal: '/x' },
      { path: 'e2e/board.spec.ts', line: 2, literal: '/x' },
    ]);
  });

  it('E02-S05 an allowlist entry without a reason fails', () => {
    const files = [{ path: 'e2e/board.spec.ts', text: "await page.goto('/x');\n" }];
    const withReason = { path: 'e2e/board.spec.ts', literal: '/y', reason: 'A reason.' };

    for (const entry of [
      { path: 'e2e/board.spec.ts', literal: '/x' },
      { path: 'e2e/board.spec.ts', literal: '/x', reason: '' },
      { path: 'e2e/board.spec.ts', literal: '/x', reason: ' \n' },
    ]) {
      expect(() => scan(files, [withReason, entry]), JSON.stringify(entry)).toThrow(
        'Path literal allowlist entry 2 (e2e/board.spec.ts, /x) gives no reason',
      );
    }
  });
});
