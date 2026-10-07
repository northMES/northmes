import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { main, run, stages } from './gen.mjs';

const script = fileURLToPath(new URL('./gen.mjs', import.meta.url));

function runScript(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

describe('gen', () => {
  it('gen prints its stages in order', async () => {
    const lines: string[] = [];
    const calls: string[] = [];
    const stage = (name: string) => ({
      name,
      generate: async (outDir: string) => {
        calls.push(`${name}:${outDir}`);
      },
    });
    const io = { log: (line: string) => lines.push(line), root: '/repo' };

    const exitCode = await run([stage('a'), stage('b')], {}, io);

    expect(lines).toEqual(['stages: a, b']);
    expect(calls).toEqual(['a:/repo', 'b:/repo']);
    expect(exitCode).toBe(0);
  });

  it('the stages list is fixed and empty', () => {
    expect(Object.isFrozen(stages)).toBe(true);
    expect(stages).toEqual([]);
  });

  it('the entry point prints its stage order', () => {
    const result = runScript();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('stages: none');
  });

  // Stands for `pnpm gen --check` until the root script is wired. With an empty stage list the
  // flag has no observable effect here, so this guards the entry point against a crash on the
  // flag; the next test covers that main passes the flag to run.
  it('the entry point exits 0 and prints its stage order under --check', () => {
    const result = runScript('--check');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('stages: none');
  });

  it('main reads --check from its arguments and passes it to run', async () => {
    const root = '/repo';
    const outDirs: string[] = [];
    const stage = {
      name: 'fixture',
      generate: async (outDir: string) => {
        outDirs.push(outDir);
      },
    };
    const io = { log: () => {}, error: () => {}, root };

    const writeExitCode = await main([], io, [stage]);
    const checkExitCode = await main(['--check'], io, [stage]);

    expect(writeExitCode).toBe(0);
    expect(checkExitCode).toBe(1);
    expect(outDirs).toHaveLength(2);
    expect(outDirs[0]).toBe(root);
    expect(dirname(outDirs[1])).toBe(tmpdir());
  });

  it('--check generates into a temporary directory and removes it afterwards', async () => {
    const root = '/repo';
    const seen: { outDir: string; existed: boolean }[] = [];
    const stage = {
      name: 'fixture',
      generate: async (outDir: string) => {
        seen.push({ outDir, existed: existsSync(outDir) });
      },
    };

    await run([stage], { check: true }, { log: () => {}, error: () => {}, root });

    expect(seen).toHaveLength(1);
    const { outDir, existed } = seen[0];
    expect(outDir).not.toBe(root);
    expect(dirname(outDir)).toBe(tmpdir());
    expect(existed).toBe(true);
    expect(existsSync(outDir)).toBe(false);
  });

  // The comparison with the repository root arrives with the first real stage. Until then
  // check mode fails whenever a stage runs, so stale generated files cannot pass the check.
  it('--check fails while the comparison with the repository root is not built', async () => {
    const errors: string[] = [];
    const stage = { name: 'fixture', generate: async () => {} };
    const io = { log: () => {}, error: (line: string) => errors.push(line), root: '/repo' };

    const exitCode = await run([stage], { check: true }, io);

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      'gen --check: the comparison with the repository root is not built yet, so check mode fails when a stage runs',
    ]);
  });
});
