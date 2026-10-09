import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./react-doctor-summary.mjs', import.meta.url));

// The fields of a react-doctor --json report (schema version 3) that the summary reads. The
// findings are synthetic.
interface Finding {
  plugin: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  normalizedFilePath: string;
  line: number;
  column: number;
}

function report(directory: string, projects: Record<string, Finding[]>) {
  const findings = Object.values(projects).flat();
  const errorCount = findings.filter(({ severity }) => severity === 'error').length;
  return {
    schemaVersion: 3,
    ok: true,
    directory,
    projects: Object.entries(projects).map(([path, diagnostics]) => ({
      directory: join(directory, path),
      packageRoot: join(directory, path),
      diagnostics,
    })),
    diagnostics: findings,
    summary: {
      errorCount,
      warningCount: findings.length - errorCount,
      affectedFileCount: new Set(findings.map(({ normalizedFilePath }) => normalizedFilePath)).size,
      totalDiagnosticCount: findings.length,
    },
    error: null,
  };
}

describe('the summary step of CI / react doctor', () => {
  let directory: string;
  let reportFile: string;
  let stepSummary: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'react-doctor-summary-'));
    reportFile = join(directory, 'react-doctor-report.json');
    stepSummary = join(directory, 'step-summary.md');
    writeFileSync(stepSummary, 'an earlier line\n');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  // GitHub runs the step in the checkout, with the report path as the root script passes it.
  function run() {
    return spawnSync(process.execPath, [script, reportFile], {
      cwd: directory,
      env: { PATH: process.env.PATH, GITHUB_STEP_SUMMARY: stepSummary },
      encoding: 'utf8',
    });
  }

  it('appends each finding to the file GITHUB_STEP_SUMMARY names and prints it to the log, by its path from the repository root', () => {
    writeFileSync(
      reportFile,
      JSON.stringify(
        report(directory, {
          'apps/web': [
            {
              plugin: 'react-doctor',
              rule: 'no-derived-state',
              severity: 'error',
              message: 'Compute the label | during render',
              normalizedFilePath: 'src/board.tsx',
              line: 12,
              column: 3,
            },
          ],
          'packages/web-sdk': [
            {
              plugin: 'react',
              rule: 'no-array-index-key',
              severity: 'warning',
              message: 'Key the rows by their order id',
              normalizedFilePath: 'src/shell-context.tsx',
              line: 40,
              column: 9,
            },
          ],
        }),
      ),
    );

    const result = run();
    const markdown = [
      '## React Doctor',
      '',
      '1 error and 1 warning in 2 files.',
      '',
      '| Severity | Rule | Where | Message |',
      '|---|---|---|---|',
      '| error | react-doctor/no-derived-state | apps/web/src/board.tsx:12:3 | Compute the label \\| during render |',
      '| warning | react/no-array-index-key | packages/web-sdk/src/shell-context.tsx:40:9 | Key the rows by their order id |',
      '',
    ].join('\n');

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(stepSummary, 'utf8')).toBe(`an earlier line\n${markdown}`);
    expect(result.stdout).toBe(markdown);
  });

  it('reports a scan without findings', () => {
    writeFileSync(reportFile, JSON.stringify(report(directory, { 'apps/web': [] })));

    const result = run();

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(stepSummary, 'utf8')).toBe(
      'an earlier line\n## React Doctor\n\nNo findings.\n',
    );
  });

  it('reports the error of a scan that did not finish', () => {
    writeFileSync(
      reportFile,
      JSON.stringify({
        ...report(directory, {}),
        ok: false,
        error: { message: 'No React project found in apps/web', name: 'Error', chain: [] },
      }),
    );

    const result = run();

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(stepSummary, 'utf8')).toBe(
      'an earlier line\n## React Doctor\n\nThe scan did not finish: No React project found in apps/web\n',
    );
  });
});
