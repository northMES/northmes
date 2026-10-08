// SPDX-License-Identifier: AGPL-3.0-or-later
import { cli } from './cli.ts';

await cli(process.argv.slice(2), { exit: (code) => process.exit(code), log: console });
