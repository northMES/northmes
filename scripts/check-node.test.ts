import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compare } from './check-node.mjs';

const script = fileURLToPath(new URL('./check-node.mjs', import.meta.url));
const rootNodeVersion = fileURLToPath(new URL('../.node-version', import.meta.url));
const runningMajor = Number.parseInt(process.version.slice(1), 10);

describe('check-node', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'check-node-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function runScript(path: string, ...args: string[]) {
    return spawnSync(process.execPath, [path, ...args], { cwd: dir, encoding: 'utf8' });
  }

  function run(...args: string[]) {
    return runScript(script, ...args);
  }

  function fixture(name: string, contents: string): string {
    const path = join(dir, name);
    writeFileSync(path, contents);
    return path;
  }

  it('a Node major other than .node-version fails naming both versions', () => {
    const result = compare('v24.1.0', '26');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('v24.1.0');
    expect(result.message).toContain('26');
  });

  it('the same major passes', () => {
    expect(compare('v26.0.0', '26').ok).toBe(true);
    expect(compare('v26.3.1', '26.0.0\n').ok).toBe(true);
  });

  it('the message names both versions without surrounding whitespace', () => {
    const mismatch = compare('v24.1.0\n', ' 26.0.0\r\n');
    const unparseable = compare('v26.0.0', 'lts/*\n');

    expect(mismatch.ok).toBe(false);
    expect(mismatch.message).toContain('Node v24.1.0 is running');
    expect(mismatch.message).toContain('pins 26.0.0.');
    expect(mismatch.message).not.toMatch(/[\r\n]/);
    expect(unparseable.message).toContain(JSON.stringify('lts/*'));
  });

  it('a .node-version without a major fails naming the file and its content', () => {
    for (const pinned of ['lts/*', '']) {
      const result = compare('v26.0.0', pinned);

      expect(result.ok).toBe(false);
      expect(result.message).toContain('.node-version');
      expect(result.message).toContain(JSON.stringify(pinned));
      expect(result.message).not.toContain('Switch to Node');
    }
  });

  it('a .node-version with text after the version fails naming the file and its content', () => {
    for (const pinned of ['26invalid', '26.x', '26 # lts']) {
      const result = compare('v26.0.0', pinned);

      expect(result.ok).toBe(false);
      expect(result.message).toContain('.node-version');
      expect(result.message).toContain(JSON.stringify(pinned));
      expect(result.message).not.toContain('Switch to Node');
    }
  });

  it('the entry point reads a .node-version fixture', () => {
    const mismatch = run(fixture('other.node-version', `${runningMajor + 1}\n`));
    const match = run(fixture('same.node-version', `${runningMajor}\n`));

    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain(process.version);
    expect(mismatch.stderr).toContain(String(runningMajor + 1));
    expect(match.status).toBe(0);
    expect(match.stderr).toBe('');
  });

  it('the entry point reads a full-version pin with a CRLF line ending', () => {
    const otherPin = `${runningMajor + 1}.0.0`;

    const match = run(fixture('full-same.node-version', `${runningMajor}.0.0\r\n`));
    const mismatch = run(fixture('full-other.node-version', `${otherPin}\r\n`));

    expect(match.status).toBe(0);
    expect(match.stderr).toBe('');
    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain(otherPin);
    expect(mismatch.stderr).not.toContain('\r');
  });

  it('the entry point names a missing .node-version in one line and exits 1', () => {
    const missing = join(dir, 'missing.node-version');

    const result = run(missing);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(missing);
    expect(result.stderr.trim().split('\n')).toHaveLength(1);
  });

  it('the entry point fails a mismatch when it is run through a symlink', () => {
    const link = join(dir, 'linked-check-node.mjs');
    symlinkSync(script, link);

    const result = runScript(link, fixture('symlink.node-version', `${runningMajor + 1}\n`));

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(process.version);
  });

  it('importing the module without a script path does nothing', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { compare } from ${JSON.stringify(pathToFileURL(script).href)}; console.log(compare('v26.0.0', '26').ok);`,
      ],
      { cwd: dir, encoding: 'utf8' },
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('true');
  });

  it('importing the module with a positional argument that is not a file does nothing', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { compare } from ${JSON.stringify(pathToFileURL(script).href)}; console.log(compare('v26.0.0', '26').ok);`,
        '--',
        'not-a-file',
      ],
      { cwd: dir, encoding: 'utf8' },
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('true');
  });

  it('the entry point defaults to the repository .node-version', () => {
    const pinned = readFileSync(rootNodeVersion, 'utf8').trim();

    const result = run();

    if (Number.parseInt(pinned, 10) === runningMajor) {
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
    } else {
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(process.version);
      expect(result.stderr).toContain(pinned);
    }
  });
});
