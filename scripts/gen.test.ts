import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { run, stages } from './gen.mjs';

const script = fileURLToPath(new URL('./gen.mjs', import.meta.url));

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

    const exitCode = await run([stage('a'), stage('b')], {}, { log: (line: string) => lines.push(line), root: '/repo' });

    expect(lines).toEqual(['stages: a, b']);
    expect(calls).toEqual(['a:/repo', 'b:/repo']);
    expect(exitCode).toBe(0);
  });

  it('the stages list is fixed and empty', () => {
    expect(Object.isFrozen(stages)).toBe(true);
    expect(stages).toEqual([]);
  });

  it('the entry point prints its stage order', () => {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('stages: none');
  });

  // Stands for `pnpm gen --check` until the root script is wired. With an empty stage list the
  // flag has no observable effect, so this passes before main reads argv; it guards the entry
  // point against a crash on the flag.
  it('the entry point exits 0 and prints its stage order under --check', () => {
    const result = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('stages: none');
  });

  // The comparison with the repository root arrives with the first real stage, so this test
  // covers where --check generates, its cleanup and the exit code, not the comparison.
  it('--check generates into a temporary directory and exits 0 when nothing differs', async () => {
    const root = '/repo';
    const seen: { outDir: string; existed: boolean }[] = [];
    const stage = {
      name: 'fixture',
      generate: async (outDir: string) => {
        seen.push({ outDir, existed: existsSync(outDir) });
      },
    };

    const exitCode = await run([stage], { check: true }, { log: () => {}, root });

    expect(exitCode).toBe(0);
    expect(seen).toHaveLength(1);
    const { outDir, existed } = seen[0];
    expect(outDir).not.toBe(root);
    expect(dirname(outDir)).toBe(tmpdir());
    expect(existed).toBe(true);
    expect(existsSync(outDir)).toBe(false);
  });
});
