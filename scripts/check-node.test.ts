import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compare } from './check-node.mjs';

const script = fileURLToPath(new URL('./check-node.mjs', import.meta.url));
const runningMajor = Number.parseInt(process.version.slice(1), 10);

describe('check-node', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'check-node-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

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

  it('the entry point reads a .node-version fixture', () => {
    const other = join(dir, 'other.node-version');
    const same = join(dir, 'same.node-version');
    writeFileSync(other, `${runningMajor + 1}\n`);
    writeFileSync(same, `${runningMajor}\n`);

    const mismatch = spawnSync(process.execPath, [script, other], { encoding: 'utf8' });
    const match = spawnSync(process.execPath, [script, same], { encoding: 'utf8' });

    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain(process.version);
    expect(mismatch.stderr).toContain(String(runningMajor + 1));
    expect(match.status).toBe(0);
  });
});
