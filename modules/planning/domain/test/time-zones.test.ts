// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * TIME7 (plan 07, ADR 0024): the domain's results do not depend on the host zone. A fresh Node
 * process per zone imports the package's source, which Node runs as TypeScript, computes the floats
 * and chains of every G1 order and prints them; the three prints are compared byte for byte.
 */
const packageRoot = fileURLToPath(new URL('../', import.meta.url));

const script = `
import { criticalChain, floatOf, g1PlanContext } from './src/index.ts';
const context = g1PlanContext();
const result = context.orders.map((order) => ({
  order: order.number,
  float: floatOf(order, context),
  chain: criticalChain(order, context),
}));
process.stdout.write(JSON.stringify(result));
`;

function resultsUnder(timeZone: string): string {
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: { ...process.env, TZ: timeZone },
  });
  expect(child.status, child.stderr).toBe(0);
  return child.stdout;
}

describe('time zones (TIME7)', () => {
  it('floatOf and criticalChain give identical results under TZ=UTC, Europe/Stockholm and Pacific/Chatham', () => {
    const utc = resultsUnder('UTC');

    expect(utc.length).toBeGreaterThan(100);
    expect(resultsUnder('Europe/Stockholm')).toBe(utc);
    expect(resultsUnder('Pacific/Chatham')).toBe(utc);
  });
});
