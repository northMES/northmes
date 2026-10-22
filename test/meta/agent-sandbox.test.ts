// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { root } from './docs';

// ADR 0084: Claude Code sessions on NorthMES run in auto mode inside the sandbox. The sandbox block
// is compared whole, so a key that widens it (an excluded command, a write path, an allowRead entry,
// a proxy port, filesystem.disabled) fails here and needs a reviewed change to this test.

interface Settings {
  permissions?: {
    disableBypassPermissionsMode?: string;
    blockReadsOutsideWorkingDirectories?: boolean;
    allow?: string[];
    additionalDirectories?: string[];
    deny?: string[];
  };
  sandbox?: unknown;
  env?: Record<string, string>;
}

function read(path: string): string {
  return readFileSync(`${root}${path}`, 'utf8');
}

function settings(): Settings {
  return JSON.parse(read('.claude/settings.json')) as Settings;
}

describe('ADR0084 agent sessions run in the Claude Code sandbox', () => {
  // ADR 0087: unattended sessions run in bypass mode, so no prompt waits for a person. The sandbox
  // below and the deny rules are the boundary, not the auto mode classifier.
  it('ADR0087 bypass permissions mode is allowed', () => {
    expect(settings().permissions?.disableBypassPermissionsMode).toBeUndefined();
  });

  it('ADR0084 the file tools and sandboxed commands read nothing outside the working directories', () => {
    expect(settings().permissions?.blockReadsOutsideWorkingDirectories).toBe(true);
  });

  // gh verifies TLS through macOS's trust service, which the sandbox blocks unless
  // enableWeakerNetworkIsolation is on. The other way the documentation offers, `gh *` in
  // excludedCommands, would run gh, its aliases and its extensions with full access. The Docker
  // sockets and local binding are what Testcontainers needs (accepted risk A-07).
  it('ADR0084 the sandbox is exactly the reviewed one: no unsandboxed command, credential paths denied, a closed network allowlist', () => {
    expect(settings().sandbox).toEqual({
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      enableWeakerNetworkIsolation: true,
      filesystem: {
        denyRead: ['~/.ssh', '~/.config/gh', '~/.aws', '~/.npmrc', '~/.netrc', '~/.gnupg'],
      },
      network: {
        allowedDomains: [
          'registry.npmjs.org',
          'github.com',
          'api.github.com',
          'codeload.github.com',
          'objects.githubusercontent.com',
          'raw.githubusercontent.com',
          'release-assets.githubusercontent.com',
          'cdn.playwright.dev',
          'playwright.download.prss.microsoft.com',
        ],
        allowUnixSockets: ['~/.docker/run/docker.sock', '/var/run/docker.sock'],
        allowLocalBinding: true,
      },
    });
  });

  // turbo looks for the Vercel CLI's login file to authenticate a remote cache, which NorthMES does
  // not use. The sandbox refuses that read, and turbo fails on the refusal, so pnpm check could not
  // run in a session. A folder that does not exist reads as no login. The env block reaches every
  // session in every clone, so it is compared whole: a variable such as NODE_OPTIONS or a proxy would
  // widen the boundary.
  it('ADR0084 the project settings set only the Vercel config folder, one that does not exist', () => {
    expect(settings().env).toEqual({ VERCEL_CONFIG_DIR_PATH: '/nonexistent/vercel' });
  });

  // An Edit allow rule or an additional directory would also widen what sandboxed commands may write.
  it('ADR0084 the project settings add no allow rule and no additional directory', () => {
    const permissions = settings().permissions;

    expect(permissions?.allow ?? []).toEqual([]);
    expect(permissions?.additionalDirectories ?? []).toEqual([]);
  });

  it('ADR0084 the file tools cannot read credentials or edit the settings, shell start-up files and launch agents', () => {
    expect(settings().permissions?.deny).toEqual(
      expect.arrayContaining([
        'Bash(gh pr merge*)',
        'Read(~/.ssh/**)',
        'Read(~/.config/gh/**)',
        'Read(~/.aws/**)',
        'Read(~/.npmrc)',
        'Read(~/.netrc)',
        'Read(~/.gnupg/**)',
        'Edit(~/.ssh/**)',
        'Edit(~/.zshrc)',
        'Edit(~/.zshenv)',
        'Edit(~/.zprofile)',
        'Edit(~/.profile)',
        'Edit(~/.bashrc)',
        'Edit(~/.bash_profile)',
        'Edit(~/.gitconfig)',
        'Edit(~/Library/LaunchAgents/**)',
        'Edit(~/.claude/settings.json)',
        'Edit(/.claude/settings.json)',
        'Edit(/.claude/settings.local.json)',
        'Edit(~/**/.claude/settings.json)',
        'Edit(~/**/.claude/settings.local.json)',
      ]),
    );
  });

  // ADR 0086 rule 5: code owner review on the risk paths makes the maintainer's approval the one that
  // counts there, and a pull request that touches no risk path needs no approval.
  it('ADR0086 CODEOWNERS names the maintainer for exactly the patterns of .github/risk-paths', () => {
    const rules = (path: string) =>
      read(path)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'));

    expect(rules('.github/CODEOWNERS')).toEqual(
      rules('.github/risk-paths').map((pattern) => `${pattern} @Krister-Johansson`),
    );
  });
});
