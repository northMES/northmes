// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConfigError } from '@northmes/sdk/config';
import { type BootOptions, boot } from './boot/boot.ts';
import { BootError } from './boot/boot-error.ts';
import { dbBootstrap } from './db/bootstrap.ts';
import { migrateCommand } from './migrate/command.ts';
import { MigrationError } from './migrate/migration-error.ts';

/** What main.ts hands a command: process.exit and console. A test also passes an environment. */
export type CliContext = Pick<BootOptions, 'env' | 'exit' | 'log'>;

/** The commands of pnpm northmes, by their words. */
const commands: Readonly<Record<string, (context: CliContext) => Promise<void>>> = {
  serve: async (context) => {
    await boot(context);
  },
  'db bootstrap': dbBootstrap,
  migrate: migrateCommand,
};

/**
 * Runs the command that the arguments name, or serve when there are none. A command that stops on
 * a ConfigError, a BootError or a MigrationError writes its message to log.error and exits 1.
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
    const known =
      error instanceof ConfigError || error instanceof BootError || error instanceof MigrationError;
    if (!known) throw error;
    context.log.error(error.message);
    context.exit(1);
  }
}
