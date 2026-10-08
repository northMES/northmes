import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scan, trackedFiles } from '../../scripts/lint/path-literals.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

interface Finding {
  path: string;
  line: number;
  literal: string;
}

// A finding as a failing check prints it: file, line and literal.
function describeFinding({ path, line, literal }: Finding): string {
  return `${path}:${line}: ${literal}`;
}

// git in these tests sees no GIT_DIR or GIT_INDEX_FILE from a hook.
function environment(): Record<string, string> {
  const inherited = Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !entry[0].startsWith('GIT_'),
  );
  return Object.fromEntries(inherited);
}

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

  it('E02-S05 redirect({ to }) and router.navigate({ to }) fail, also when the call spans lines', () => {
    const text = [
      'export const route = {',
      '  beforeLoad: () => {',
      '    throw redirect({',
      "      to: '/x',",
      '      replace: true,',
      '    });',
      '  },',
      '};',
      'export function go(router: Router) {',
      "  return router.navigate({ to: '/y' });",
      '}',
      '',
    ].join('\n');

    const findings = scan([{ path: 'modules/planning/web/src/routes.ts', text }], []);

    expect(findings).toEqual([
      { path: 'modules/planning/web/src/routes.ts', line: 4, literal: '/x' },
      { path: 'modules/planning/web/src/routes.ts', line: 10, literal: '/y' },
    ]);
  });

  it('E02-S05 a path literal in the href option of navigate or redirect fails, as in the to option', () => {
    const text = [
      "router.navigate({ href: '/x' });",
      "throw redirect({ href: '/y', replace: true });",
      'router.navigate({ href: planningLinks.orders({ plant }).href });',
      '',
    ].join('\n');

    const findings = scan([{ path: 'apps/web/src/moved.ts', text }], []);

    expect(findings).toEqual([
      { path: 'apps/web/src/moved.ts', line: 1, literal: '/x' },
      { path: 'apps/web/src/moved.ts', line: 2, literal: '/y' },
    ]);
  });

  it('E02-S05 a path in a template literal, a concatenation, a conditional or an as expression fails', () => {
    const text = [
      "test('order', async ({ page }) => {",
      '  await page.goto(`/x`);',
      `  await page.goto(\`/\${plant}/planning\`);`,
      "  await page.goto('/' + plant + '/planning');",
      "  await page.goto(isNew ? '/a' : planningLinks.orders({ plant }).href);",
      "  await page.goto(('/b' as string));",
      "  await page.goto('/c' satisfies string);",
      '});',
      '',
    ].join('\n');

    const findings = scan([{ path: 'e2e/order.spec.ts', text }], []);

    expect(findings).toEqual([
      { path: 'e2e/order.spec.ts', line: 2, literal: '/x' },
      { path: 'e2e/order.spec.ts', line: 3, literal: `/\${plant}/planning` },
      { path: 'e2e/order.spec.ts', line: 4, literal: '/' },
      { path: 'e2e/order.spec.ts', line: 5, literal: '/a' },
      { path: 'e2e/order.spec.ts', line: 6, literal: '/b' },
      { path: 'e2e/order.spec.ts', line: 7, literal: '/c' },
    ]);
  });

  it('E02-S05 a URL with a scheme or a host, a fragment and a relative to of . and .. pass, and a relative to with a named segment fails', () => {
    const text = [
      'export const links = (',
      '  <footer>',
      '    <a href="https://example.com/help">Help</a>',
      '    <a href="//cdn.example.com/guide.pdf">Guide</a>',
      '    <a href="mailto:support@example.com">Support</a>',
      '    <a href="#main">Skip to content</a>',
      '    <Link to="..">Back</Link>',
      '    <Link to="./history">History</Link>',
      '    <Link to="../orders">Orders</Link>',
      '  </footer>',
      ');',
      "export const up = () => router.navigate({ to: '../..' });",
      "export const open = () => router.navigate({ to: 'history' });",
      '',
    ].join('\n');

    expect(scan([{ path: 'apps/web/src/footer.tsx', text }], [])).toEqual([
      { path: 'apps/web/src/footer.tsx', line: 8, literal: './history' },
      { path: 'apps/web/src/footer.tsx', line: 9, literal: '../orders' },
      { path: 'apps/web/src/footer.tsx', line: 13, literal: 'history' },
    ]);
  });

  it('E02-S05 a to template literal that starts with a substitution passes', () => {
    const text = [
      'export const open = (',
      '  <Link to={`${planningLinks.orders({ plant }).to}?tab=open`}>Open</Link>',
      ');',
      '',
    ].join('\n');

    expect(scan([{ path: 'apps/web/src/open.tsx', text }], [])).toEqual([]);
  });

  it('E02-S05 only source files under modules/*/web, examples/*/web, apps/web and e2e are scanned', () => {
    const link = '<Link to="/x">X</Link>;\n';
    const paths = [
      'examples/plugin-validator/web/src/panel.tsx',
      'packages/web-sdk/test/module-link.test.tsx',
      'modules/planning/contracts/src/links.tsx',
      'modules/planning/web-extra/src/a.tsx',
      'modules/planning/src/web/a.tsx',
      'apps/website/src/a.tsx',
      'apps/server/src/a.tsx',
      'e2e-tools/a.tsx',
      'test/e2e/a.tsx',
    ];
    const files = [
      ...paths.map((path) => ({ path, text: link })),
      { path: 'e2e/README.md', text: "```ts\nawait page.goto('/x');\n```\n" },
      { path: 'apps/web/src/notes.txt', text: "await page.goto('/x');\n" },
      { path: 'apps/web/src/main.mts', text: "await router.navigate({ to: '/x' });\n" },
      { path: 'e2e/fixtures/server.cjs', text: "page.goto('/x');\n" },
    ];

    const findings = scan(files, []);

    expect(findings).toEqual([
      { path: 'examples/plugin-validator/web/src/panel.tsx', line: 1, literal: '/x' },
      { path: 'apps/web/src/main.mts', line: 1, literal: '/x' },
      { path: 'e2e/fixtures/server.cjs', line: 1, literal: '/x' },
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

  describe('over git ls-files', () => {
    let repository: string;

    function git(...args: string[]) {
      const result = spawnSync('git', args, {
        cwd: repository,
        encoding: 'utf8',
        env: environment(),
      });
      expect(result.status, result.stderr).toBe(0);
    }

    function write(path: string, text: string) {
      mkdirSync(dirname(join(repository, path)), { recursive: true });
      writeFileSync(join(repository, path), text);
    }

    beforeAll(() => {
      repository = mkdtempSync(join(tmpdir(), 'path-literals-'));
      git('init', '-q');
      write(
        'modules/planning/web/src/board.tsx',
        'const a = 1;\nexport const b = <Link to="/x">X</Link>;\n',
      );
      write('packages/ui/test/link.test.tsx', '<Link to="/x">X</Link>;\n');
      git('add', '.');
      write('apps/web/src/draft.tsx', '<Link to="/y">Y</Link>;\n');
    });

    afterAll(() => {
      rmSync(repository, { recursive: true, force: true });
    });

    it('E02-S05 a literal in a tracked file fails naming the file and line, and an untracked file is not read', () => {
      const findings = scan(trackedFiles(repository), []);

      expect(findings.map(describeFinding)).toEqual(['modules/planning/web/src/board.tsx:2: /x']);
    });

    it('E02-S05 the tracked files of this repository pass with the committed allowlist', () => {
      const allowlist = JSON.parse(
        readFileSync(join(root, 'scripts/lint/path-literals.allow.json'), 'utf8'),
      );

      expect(scan(trackedFiles(root), allowlist).map(describeFinding)).toEqual([]);
    });
  });
});
