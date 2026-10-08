// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConfigError } from '@northmes/sdk/config';
import { type BootOptions, boot } from './boot/boot.ts';
import { dbBootstrap } from './db/bootstrap.ts';

/** What main.ts hands a command: process.exit and console. A test also passes an environment. */
export type CliContext = Omit<BootOptions, 'importManifest'>;

/** The commands of pnpm northmes, by their words. */
const commands: Readonly<Record<string, (context: CliContext) => Promise<void>>> = {
  serve: async (context) => {
    await boot({ ...context, importManifest: (specifier) => import(specifier) });
  },
  'db bootstrap': dbBootstrap,
};

/**
 * Runs the command that the arguments name, or serve when there are none. A command that stops on
 * a ConfigError writes its message to log.error and exits 1.
 */
export async function cli(argv: readonly string[], context: CliContext): Promise<void> {
  const name = argv.join(' ') || 'serve';
  const command = commands[name];
  if (!command) {
    context.log.error(`Unknown command "${name}". Commands: ${Object.keys(commands).join(', ')}`);
    context.exit(1);
    return;
  }
  try {
    await command(context);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    context.log.error(error.message);
    context.exit(1);
  }
}
