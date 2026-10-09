import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, run, stages } from './gen.mjs';

/** A stage that writes `files`, each path relative to the repository root, under its outDir. */
function writing(name: string, outputs: string[], files: Record<string, string>) {
  return {
    name,
    outputs,
    generate: async (outDir: string) => {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(outDir, path)), { recursive: true });
        writeFileSync(join(outDir, path), text);
      }
    },
  };
}

describe('gen', () => {
  let root: string;
  let lines: string[];
  let errors: string[];
  let io: { log: (line: string) => void; error: (line: string) => void; root: string };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gen-root-'));
    lines = [];
    errors = [];
    io = { log: (line) => lines.push(line), error: (line) => errors.push(line), root };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes a file at a path relative to the repository root. */
  function put(path: string, text: string) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }

  /** The text of a file at a path relative to the repository root, or undefined. */
  function read(path: string) {
    return existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : undefined;
  }

  it('the stages print the schema first, then the web documents that read it', () => {
    expect(Object.isFrozen(stages)).toBe(true);
    expect(stages.map((stage: { name: string }) => stage.name)).toEqual([
      'schema',
      'web documents',
    ]);
    expect(stages.map((stage: { outputs: string[] }) => stage.outputs)).toEqual([
      ['schema/api.graphql'],
      ['apps/web/src/**/*.graphql.gen.ts'],
    ]);
  });

  it('writes what the stages generate and prints the stages in order', async () => {
    const exitCode = await run(
      [writing('a', ['out/a.txt'], { 'out/a.txt': 'a\n' }), writing('b', ['out/b.txt'], {})],
      {},
      io,
    );

    expect(exitCode).toBe(0);
    expect(lines).toEqual(['stages: a, b', 'wrote out/a.txt']);
    expect(read('out/a.txt')).toBe('a\n');
  });

  it('leaves a file that is already up to date alone', async () => {
    put('out/a.txt', 'a\n');

    const exitCode = await run([writing('a', ['out/*.txt'], { 'out/a.txt': 'a\n' })], {}, io);

    expect(exitCode).toBe(0);
    expect(lines).toEqual(['stages: a']);
  });

  it('removes a file the stage owns but no longer writes', async () => {
    put('out/old.txt', 'old\n');
    put('out/kept.md', 'not owned\n');

    const exitCode = await run([writing('a', ['out/*.txt'], { 'out/a.txt': 'a\n' })], {}, io);

    expect(exitCode).toBe(0);
    expect(lines).toEqual(['stages: a', 'wrote out/a.txt', 'removed out/old.txt']);
    expect(read('out/old.txt')).toBeUndefined();
    expect(read('out/kept.md')).toBe('not owned\n');
  });

  it('a later stage reads what an earlier stage wrote, before the repository root changes', async () => {
    put('schema/api.graphql', 'old\n');
    const seen: string[] = [];
    const reader = {
      name: 'reader',
      outputs: [],
      generate: async (outDir: string) => {
        seen.push(readFileSync(join(outDir, 'schema/api.graphql'), 'utf8'));
      },
    };

    await run(
      [writing('schema', ['schema/api.graphql'], { 'schema/api.graphql': 'new\n' }), reader],
      {},
      io,
    );

    expect(seen).toEqual(['new\n']);
  });

  it('a stage that fails leaves the repository root as it was', async () => {
    put('out/a.txt', 'a\n');
    const failing = {
      name: 'failing',
      outputs: ['out/*.txt'],
      generate: async () => {
        throw new Error('schema invalid');
      },
    };

    await expect(
      run([writing('a', ['out/*.txt'], { 'out/a.txt': 'changed\n' }), failing], {}, io),
    ).rejects.toThrow('schema invalid');
    expect(read('out/a.txt')).toBe('a\n');
  });

  it('--check passes when every generated file matches the repository root', async () => {
    put('out/a.txt', 'a\n');

    const exitCode = await run(
      [writing('a', ['out/*.txt'], { 'out/a.txt': 'a\n' })],
      { check: true },
      io,
    );

    expect(exitCode).toBe(0);
    expect(errors).toEqual([]);
  });

  it('--check fails naming each changed, missing and stale file, and writes nothing', async () => {
    put('out/changed.txt', 'before\n');
    put('out/stale.txt', 'stale\n');
    const stage = writing('a', ['out/*.txt'], {
      'out/changed.txt': 'after\n',
      'out/missing.txt': 'new\n',
    });

    const exitCode = await run([stage], { check: true }, io);

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      [
        'gen --check: 3 generated files differ from what pnpm gen writes',
        '- out/changed.txt is out of date',
        '- out/missing.txt is missing',
        '- out/stale.txt is stale: no stage writes it',
        'Run pnpm gen and commit the result.',
      ].join('\n'),
    ]);
    expect(read('out/changed.txt')).toBe('before\n');
    expect(read('out/missing.txt')).toBeUndefined();
    expect(read('out/stale.txt')).toBe('stale\n');
  });

  it('generates into a temporary directory and removes it afterwards', async () => {
    const seen: { outDir: string; existed: boolean }[] = [];
    const stage = {
      name: 'fixture',
      outputs: [],
      generate: async (outDir: string) => {
        seen.push({ outDir, existed: existsSync(outDir) });
      },
    };

    await run([stage], { check: true }, io);
    await run([stage], {}, io);

    expect(seen).toHaveLength(2);
    for (const { outDir, existed } of seen) {
      expect(outDir).not.toBe(root);
      expect(dirname(outDir)).toBe(tmpdir());
      expect(existed).toBe(true);
      expect(existsSync(outDir)).toBe(false);
    }
  });

  it('main reads --check from its arguments and passes it to run', async () => {
    put('out/a.txt', 'before\n');
    const stage = writing('a', ['out/*.txt'], { 'out/a.txt': 'after\n' });

    const checkExitCode = await main(['--check'], io, [stage]);
    const before = read('out/a.txt');
    const writeExitCode = await main([], io, [stage]);

    expect(checkExitCode).toBe(1);
    expect(before).toBe('before\n');
    expect(writeExitCode).toBe(0);
    expect(read('out/a.txt')).toBe('after\n');
  });
});
