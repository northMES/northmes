// SPDX-License-Identifier: AGPL-3.0-or-later
import { cli } from './cli.ts';

await cli(process.argv.slice(2), {
  // biome-ignore lint/style/noProcessEnv: the entry point hands the environment to boot, which validates it (ADR 0060).
  env: process.env,
  exit: (code) => process.exit(code),
  log: console,
});
