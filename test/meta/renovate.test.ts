// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { root } from './docs.ts';

/** The part of renovate.json that these checks read. */
interface RenovateConfig {
  readonly extends?: readonly string[];
  readonly minimumReleaseAge?: string;
  readonly customManagers?: readonly {
    readonly customType: string;
    readonly managerFilePatterns: readonly string[];
    readonly matchStrings: readonly string[];
    readonly datasourceTemplate?: string;
  }[];
  readonly packageRules?: readonly {
    readonly matchDatasources?: readonly string[];
    readonly matchPackageNames?: readonly string[];
    readonly matchUpdateTypes?: readonly string[];
    readonly enabled?: boolean;
  }[];
}

const renovate = JSON.parse(readFileSync(`${root}renovate.json`, 'utf8')) as RenovateConfig;

/** A Renovate duration such as "14 days", in minutes, the unit of pnpm's minimumReleaseAge. */
function minutes(duration: string): number {
  const match = /^(\d+) days?$/.exec(duration);
  if (!match) throw new Error(`renovate.json: ${duration} is not a duration in days`);
  return Number(match[1]) * 24 * 60;
}

/** A pattern of managerFilePatterns: "/regex/" is a regular expression, anything else a glob. */
function filePattern(pattern: string): RegExp {
  if (!pattern.startsWith('/') || !pattern.endsWith('/')) {
    throw new Error(`renovate.json: write ${pattern} as a /regex/`);
  }
  return new RegExp(pattern.slice(1, -1));
}

describe('renovate.json', () => {
  it('the release age matches pnpm-workspace.yaml', () => {
    const workspace = parse(readFileSync(`${root}pnpm-workspace.yaml`, 'utf8')) as {
      minimumReleaseAge: number;
    };

    expect(minutes(renovate.minimumReleaseAge ?? '')).toBe(workspace.minimumReleaseAge);
  });

  it('infra/pg-image.json has a manager that reads its Postgres tag and digest', () => {
    const file = 'infra/pg-image.json';
    const text = readFileSync(`${root}${file}`, 'utf8');
    const { image } = JSON.parse(text) as { image: string };
    const manager = renovate.customManagers?.find((candidate) =>
      candidate.managerFilePatterns.some((pattern) => filePattern(pattern).test(file)),
    );

    expect(manager?.datasourceTemplate).toBe('docker');
    const groups = new RegExp(manager?.matchStrings[0] ?? '$^').exec(text)?.groups;
    expect(`${groups?.depName}:${groups?.currentValue}@${groups?.currentDigest}`).toBe(image);
  });

  it('ADR0064 the oasdiff image of CI / openapi diff has a manager that reads its tag and digest', () => {
    const file = '.github/workflows/ci.yml';
    const text = readFileSync(`${root}${file}`, 'utf8');
    const image = /OASDIFF_IMAGE: (\S+)/.exec(text)?.[1];
    const manager = renovate.customManagers?.find((candidate) =>
      candidate.managerFilePatterns.some((pattern) => filePattern(pattern).test(file)),
    );

    expect(image).toMatch(/^tufin\/oasdiff:/);
    expect(manager?.datasourceTemplate).toBe('docker');
    const groups = new RegExp(manager?.matchStrings[0] ?? '$^').exec(text)?.groups;
    expect(`${groups?.depName}:${groups?.currentValue}@${groups?.currentDigest}`).toBe(image);
  });

  it('GitHub Actions are pinned by digest', () => {
    expect(renovate.extends).toEqual(
      expect.arrayContaining(['config:best-practices', 'helpers:pinGitHubActionDigests']),
    );
  });

  it('Renovate proposes no Postgres major upgrade, which needs pg_upgrade on every plant', () => {
    expect(renovate.packageRules).toContainEqual(
      expect.objectContaining({
        matchDatasources: ['docker'],
        matchPackageNames: ['postgres'],
        matchUpdateTypes: ['major'],
        enabled: false,
      }),
    );
  });
});
