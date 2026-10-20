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
  it('ADR0084 bypass permissions mode is disabled', () => {
    expect(settings().permissions?.disableBypassPermissionsMode).toBe('disable');
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

  // An Edit allow rule or an additional directory would also widen what sandboxed commands may write.
  // turbo looks for the Vercel CLI's login file to authenticate a remote cache, which NorthMES does
  // not use. The sandbox refuses that read, and turbo fails on the refusal, so pnpm check could not
  // run in a session. A folder that does not exist reads as no login.
  it('ADR0084 sessions point turbo at a Vercel config folder that does not exist', () => {
    expect(settings().env?.VERCEL_CONFIG_DIR_PATH).toBe('/nonexistent/vercel');
  });

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

  it('ADR0084 CODEOWNERS names the maintainer for every path, so code owner review means his approval', () => {
    const rules = read('.github/CODEOWNERS')
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#'));

    expect(rules).toEqual(['* @Krister-Johansson']);
  });
});
