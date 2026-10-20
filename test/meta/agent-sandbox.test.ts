// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { root } from './docs';

// ADR 0084: Claude Code sessions on NorthMES run in auto mode inside the sandbox. These checks keep
// the project settings from widening the boundary without a reviewed change to this test.

interface Settings {
  permissions?: { disableBypassPermissionsMode?: string; deny?: string[] };
  sandbox?: {
    enabled?: boolean;
    failIfUnavailable?: boolean;
    allowUnsandboxedCommands?: boolean;
    excludedCommands?: string[];
    enableWeakerNetworkIsolation?: boolean;
    enableWeakerNestedSandbox?: boolean;
    filesystem?: { denyRead?: string[]; allowWrite?: string[] };
    network?: {
      allowedDomains?: string[];
      allowUnixSockets?: string[];
      allowAllUnixSockets?: boolean;
    };
  };
}

function settings(): Settings {
  return JSON.parse(readFileSync(`${root}.claude/settings.json`, 'utf8')) as Settings;
}

const credentialPaths = ['~/.ssh', '~/.config/gh', '~/.aws', '~/.npmrc', '~/.netrc', '~/.gnupg'];

describe('ADR0084 agent sessions run in the Claude Code sandbox', () => {
  it('ADR0084 bypass permissions mode is disabled', () => {
    expect(settings().permissions?.disableBypassPermissionsMode).toBe('disable');
  });

  it('ADR0084 the sandbox is on, refuses to start without isolation and allows no unsandboxed command', () => {
    const sandbox = settings().sandbox;

    expect(sandbox?.enabled).toBe(true);
    expect(sandbox?.failIfUnavailable).toBe(true);
    expect(sandbox?.allowUnsandboxedCommands).toBe(false);
    expect(sandbox?.excludedCommands ?? []).toEqual([]);
  });

  // gh verifies TLS through macOS's trust service, which the sandbox blocks unless this is on. The
  // other way the documentation offers, `gh *` in excludedCommands, would run gh, its aliases and
  // its extensions with full access.
  it('ADR0084 the only weaker isolation is the TLS trust service that gh needs', () => {
    const sandbox = settings().sandbox;

    expect(sandbox?.enableWeakerNetworkIsolation).toBe(true);
    expect(sandbox?.enableWeakerNestedSandbox ?? false).toBe(false);
  });

  it('ADR0084 sandboxed commands and the file tools cannot read the credential paths', () => {
    const { sandbox, permissions } = settings();

    expect(sandbox?.filesystem?.denyRead).toEqual(expect.arrayContaining(credentialPaths));
    expect(permissions?.deny).toEqual(
      expect.arrayContaining([
        'Read(~/.ssh/**)',
        'Read(~/.config/gh/**)',
        'Read(~/.aws/**)',
        'Read(~/.npmrc)',
        'Read(~/.netrc)',
        'Read(~/.gnupg/**)',
      ]),
    );
  });

  it('ADR0084 sandboxed commands write only to the worktree, temp and the pnpm and Playwright caches', () => {
    expect(settings().sandbox?.filesystem?.allowWrite).toEqual([
      '~/Library/pnpm/store',
      '~/Library/Caches/pnpm',
      '~/Library/Caches/ms-playwright',
    ]);
  });

  it('ADR0084 the network allowlist is the npm registry, GitHub and the Playwright downloads, and nothing else', () => {
    expect(settings().sandbox?.network?.allowedDomains).toEqual([
      'registry.npmjs.org',
      'github.com',
      'api.github.com',
      'codeload.github.com',
      'objects.githubusercontent.com',
      'raw.githubusercontent.com',
      'release-assets.githubusercontent.com',
      'cdn.playwright.dev',
      'playwright.download.prss.microsoft.com',
    ]);
  });

  it('ADR0084 the only Unix sockets are the Docker sockets that Testcontainers needs', () => {
    const network = settings().sandbox?.network;

    expect(network?.allowUnixSockets).toEqual(['~/.docker/run/docker.sock', '/var/run/docker.sock']);
    expect(network?.allowAllUnixSockets ?? false).toBe(false);
  });

  it('ADR0084 a session cannot merge a pull request with gh', () => {
    expect(settings().permissions?.deny).toContain('Bash(gh pr merge*)');
  });
});
