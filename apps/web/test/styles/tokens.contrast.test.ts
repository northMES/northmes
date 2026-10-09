// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { type Color, inGamut, parse, toGamut, wcagContrast } from 'culori';
import { describe, expect, it } from 'vitest';

type Theme = 'light' | 'dark';
type Tokens = ReadonlyMap<string, string>;

/**
 * Reads the color tokens of tokens.css: the declarations of :root are the light theme, and the
 * declarations inside its `@variant dark` block are the dark theme.
 */
function readTokens(): Record<Theme, Tokens> {
  const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const darkStart = css.indexOf('@variant dark {');
  if (darkStart === -1) throw new Error('tokens.css has no @variant dark block');
  const darkEnd = css.indexOf('}', darkStart);
  const colors = (text: string): Tokens =>
    new Map(
      [...text.matchAll(/--([a-z0-9-]+)\s*:\s*(oklch\([^)]*\))\s*;/g)].map(([, name, value]) => [
        `--${name}`,
        value as string,
      ]),
    );
  return {
    light: colors(css.slice(0, darkStart)),
    dark: colors(css.slice(darkStart, darkEnd)),
  };
}

const tokens = readTokens();
const inSrgb = toGamut('rgb', 'oklch');

/** The token's color in that theme, mapped into sRGB the way the D1 contrast table measured it. */
function color(theme: Theme, token: string): Color {
  const value = token.startsWith('#') ? token : tokens[theme].get(token);
  const parsed = value === undefined ? undefined : parse(value);
  if (parsed === undefined) throw new Error(`${token} has no ${theme} value`);
  return inSrgb(parsed);
}

function ratio(theme: Theme, foreground: string, background: string): number {
  return wcagContrast(color(theme, foreground), color(theme, background));
}

/** Each pair below its minimum in that theme, written as "fg on bg: ratio < min". */
function failures(
  theme: Theme,
  pairs: readonly (readonly [string, string])[],
  minimum: number,
): string[] {
  return pairs
    .map(([fg, bg]) => [fg, bg, ratio(theme, fg, bg)] as const)
    .filter(([, , value]) => value < minimum)
    .map(([fg, bg, value]) => `${fg} on ${bg}: ${value.toFixed(2)} < ${minimum}`);
}

// The 84 color tokens of the D1 record (docs/design/ui/ui-189-tokens.md), section by section.
const d1Tokens = [
  // shadcn base (18)
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--border',
  '--input',
  '--ring',
  // shadcn sidebar (8)
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
  // NorthMES additions (12)
  '--primary-hover',
  '--destructive-foreground',
  '--destructive-subtle',
  '--link',
  '--focus-outline',
  '--focus-ring',
  '--success',
  '--success-subtle',
  '--warning',
  '--warning-subtle',
  '--info',
  '--info-subtle',
  // Board (6)
  '--lane',
  '--lane-alt',
  '--off-time',
  '--block-border',
  '--now',
  '--now-foreground',
  // Order status, late and lock owner (18)
  ...['registered', 'planned', 'active', 'paused', 'finished', 'delivered', 'cancelled'].flatMap(
    (status) => [`--status-${status}`, `--status-${status}-foreground`],
  ),
  '--late',
  '--late-foreground',
  '--lock-owner',
  '--lock-owner-foreground',
  // Order palette (20) and equipment group colors (2)
  ...Array.from({ length: 20 }, (_, index) => `--palette-${index + 1}`),
  '--group-1',
  '--group-2',
];

// The text pairs of the D1 contrast table, P1 to P11, at 4.5:1.
const textPairs = [
  ['--foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--foreground', '--muted'],
  ['--foreground', '--info-subtle'],
  ['--muted-foreground', '--muted'],
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--card'],
  ['--muted-foreground', '--popover'],
  ['--muted-foreground', '--accent'],
  ['--muted-foreground', '--info-subtle'],
  ['--muted-foreground', '--sidebar'],
  ['--primary-foreground', '--primary'],
  ['--primary-foreground', '--primary-hover'],
  ['--primary', '--background'],
  ['--primary', '--card'],
  ['--secondary-foreground', '--secondary'],
  ['--accent-foreground', '--accent'],
  ['--link', '--background'],
  ['--link', '--card'],
  ['--link', '--popover'],
  ['--link', '--muted'],
  ['--link', '--info-subtle'],
  ['--destructive', '--background'],
  ['--destructive', '--card'],
  ['--destructive', '--popover'],
  ['--destructive', '--destructive-subtle'],
  ['--destructive-foreground', '--destructive'],
  ['--sidebar-foreground', '--sidebar'],
  ['--sidebar-accent-foreground', '--sidebar-accent'],
  ['--sidebar-primary-foreground', '--sidebar-primary'],
  ['--status-registered-foreground', '--status-registered'],
  ['--status-planned-foreground', '--status-planned'],
  ['--status-active-foreground', '--status-active'],
  ['--status-paused-foreground', '--status-paused'],
  ['--status-finished-foreground', '--status-finished'],
  ['--status-delivered-foreground', '--status-delivered'],
  ['--status-cancelled-foreground', '--status-cancelled'],
  ['--late-foreground', '--late'],
  ['--lock-owner-foreground', '--lock-owner'],
  ['--success', '--background'],
  ['--success', '--card'],
  ['--success', '--success-subtle'],
  ['--warning', '--background'],
  ['--warning', '--card'],
  ['--warning', '--warning-subtle'],
  ['--info', '--background'],
  ['--info', '--card'],
  ['--info', '--info-subtle'],
  ['--now-foreground', '--now'],
] as const;

// The non-text pairs of the D1 contrast table, P13, P15 and P16, at 3:1.
const nonTextPairs = [
  ['--input', '--background'],
  ['--input', '--card'],
  ['--input', '--popover'],
  ['--input', '--muted'],
  ['--input', '--sidebar'],
  ['--primary', '--background'],
  ['--primary', '--card'],
  ['--destructive', '--background'],
  ['--destructive', '--card'],
  ['--block-border', '--lane'],
  ['--block-border', '--lane-alt'],
  ['--block-border', '--off-time'],
  ['--now', '--lane'],
  ['--now', '--lane-alt'],
  ['--now', '--off-time'],
] as const;

// The focus ring pairs of the D1 contrast table, P14, at 3:1: the outer half on every surface, the
// inner half against every control edge it touches.
const focusRingPairs = [
  ['--focus-outline', '--focus-ring'],
  ...[
    '--background',
    '--card',
    '--popover',
    '--muted',
    '--secondary',
    '--accent',
    '--sidebar',
    '--sidebar-accent',
    '--info-subtle',
    '--lane',
    '--lane-alt',
    '--off-time',
  ].map((surface) => ['--focus-outline', surface] as const),
  ...['--primary', '--primary-hover', '--destructive', '--input', '--block-border'].map(
    (edge) => ['--focus-ring', edge] as const,
  ),
] as const;

const fills = [
  ...Array.from({ length: 20 }, (_, index) => `--palette-${index + 1}`),
  '--group-1',
  '--group-2',
];

// The tokens the D1 record marks "(= --name)": the same value as that token in both themes.
const aliases = [
  ['--card-foreground', '--foreground'],
  ['--popover', '--card'],
  ['--popover-foreground', '--foreground'],
  ['--secondary', '--muted'],
  ['--secondary-foreground', '--foreground'],
  ['--accent', '--muted'],
  ['--accent-foreground', '--foreground'],
  ['--ring', '--focus-outline'],
  ['--sidebar', '--card'],
  ['--sidebar-foreground', '--foreground'],
  ['--sidebar-primary', '--primary'],
  ['--sidebar-primary-foreground', '--primary-foreground'],
  ['--sidebar-accent', '--accent'],
  ['--sidebar-accent-foreground', '--accent-foreground'],
  ['--sidebar-border', '--border'],
  ['--sidebar-ring', '--ring'],
  ['--destructive-foreground', '--background'],
  ['--focus-outline', '--foreground'],
  ['--focus-ring', '--background'],
  ['--now', '--destructive'],
  ['--now-foreground', '--background'],
  ['--status-registered', '--muted'],
  ['--status-registered-foreground', '--foreground'],
  ['--status-planned', '--info-subtle'],
  ['--status-planned-foreground', '--info'],
  ['--status-active', '--success-subtle'],
  ['--status-active-foreground', '--success'],
  ['--status-paused', '--warning-subtle'],
  ['--status-paused-foreground', '--warning'],
  ['--status-finished', '--success-subtle'],
  ['--status-finished-foreground', '--success'],
  ['--status-delivered', '--muted'],
  ['--status-delivered-foreground', '--foreground'],
  ['--status-cancelled', '--muted'],
  ['--status-cancelled-foreground', '--muted-foreground'],
  ['--late', '--destructive-subtle'],
  ['--late-foreground', '--destructive'],
  ['--lock-owner', '--muted'],
  ['--lock-owner-foreground', '--foreground'],
] as const;

describe.each(['light', 'dark'] as const)('the D1 tokens in %s', (theme) => {
  it('E04-S01 tokens.css holds every D1 color token', () => {
    expect([...tokens[theme].keys()].sort()).toEqual([...d1Tokens].sort());
  });

  it('E04-S01 every text pair meets 4.5:1', () => {
    expect(failures(theme, textPairs, 4.5)).toEqual([]);
  });

  it('E04-S01 input borders, the checked control, the block border and the now line meet 3:1', () => {
    expect(failures(theme, nonTextPairs, 3)).toEqual([]);
  });

  it('E04-S01 the focus ring meets 3:1 on every surface, and its halves are 9:1 apart', () => {
    expect(failures(theme, focusRingPairs, 3)).toEqual([]);
    // WCAG technique C40: halves 9:1 apart, so one of them reaches 3:1 on any fill.
    expect(failures(theme, [['--focus-outline', '--focus-ring']], 9)).toEqual([]);
    const overFills = fills
      .map(
        (fill) =>
          [
            fill,
            Math.max(ratio(theme, '--focus-outline', fill), ratio(theme, '--focus-ring', fill)),
          ] as const,
      )
      .filter(([, value]) => value < 3)
      .map(([fill, value]) => `the ring over ${fill}: ${value.toFixed(2)} < 3`);
    expect(overFills).toEqual([]);
  });

  it('E04-S01 black block text and its state markers meet 4.58:1 on every palette and group fill', () => {
    expect(
      failures(
        theme,
        fills.map((fill) => ['#000000', fill] as const),
        4.58,
      ),
    ).toEqual([]);
  });

  it('E04-S01 every token lies inside sRGB, and each alias holds the value of its token', () => {
    const outside = [...tokens[theme]]
      .filter(([, value]) => !inGamut('rgb')(parse(value) as Color))
      .map(([name]) => name);
    expect(outside).toEqual([]);
    const drifted = aliases
      .filter(([alias, token]) => tokens[theme].get(alias) !== tokens[theme].get(token))
      .map(([alias, token]) => `${alias} is not ${token}`);
    expect(drifted).toEqual([]);
  });
});

describe('the D1 rule checks', () => {
  it('E04-S01 input borders and muted text keep the lightness limits of plan 06, and the 20 order colors differ', () => {
    const lightness = (theme: Theme, token: string) =>
      (parse(tokens[theme].get(token) ?? '') as { l: number }).l;

    expect(lightness('light', '--input')).toBeLessThanOrEqual(0.669);
    expect(lightness('dark', '--input')).toBeGreaterThanOrEqual(0.478);
    expect(lightness('light', '--muted-foreground')).toBeLessThanOrEqual(0.547);
    for (const theme of ['light', 'dark'] as const) {
      const palette = Array.from({ length: 20 }, (_, index) =>
        tokens[theme].get(`--palette-${index + 1}`),
      );
      expect(new Set(palette).size, theme).toBe(20);
    }
  });
});
