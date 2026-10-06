import { describe, expect, it } from 'vitest';
import { run } from './gen.mjs';

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
});
