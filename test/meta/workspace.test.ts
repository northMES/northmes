import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkspaceConfig {
  pmOnFail?: string;
  allowBuilds?: Record<string, boolean>;
}

const root = fileURLToPath(new URL('../../', import.meta.url));

function readText(path: string): string {
  return readFileSync(`${root}${path}`, 'utf8');
}

function readWorkspace(): WorkspaceConfig {
  return parse(readText('pnpm-workspace.yaml')) as WorkspaceConfig;
}

describe('workspace', () => {
  it('pnpm-workspace.yaml sets pmOnFail ignore and refuses builds of cpu-features, protobufjs and ssh2', () => {
    const workspace = readWorkspace();

    expect(workspace.pmOnFail).toBe('ignore');
    for (const name of ['cpu-features', 'protobufjs', 'ssh2']) {
      expect(workspace.allowBuilds?.[name], name).toBe(false);
    }
  });
});
