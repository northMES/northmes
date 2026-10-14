// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConfigError } from '@northmes/sdk/config';
import { type AdminCommand, runAdminCommand } from './admin/admin-command.ts';
import {
  adminResetPassword,
  companyAddAdmin,
  companyCreate,
  companyList,
} from './admin/commands.ts';
import { type BootOptions, boot } from './boot/boot.ts';
import { BootError } from './boot/boot-error.ts';
import { dbBootstrap } from './db/bootstrap.ts';
import { migrateCommand } from './migrate/command.ts';
import { MigrationError } from './migrate/migration-error.ts';

/**
 * What main.ts hands a command: process.exit, console and standard output. A test also passes an
 * environment, and records what is printed.
 */
export type CliContext = Pick<BootOptions, 'env' | 'exit' | 'log'> & {
  /** Writes an admin command's answer to standard output. It defaults to process.stdout. */
  readonly print?: (text: string) => void;
};

/** The commands of pnpm northmes that take no arguments, by their words. */
const commands: Readonly<Record<string, (context: CliContext) => Promise<void>>> = {
  serve: async (context) => {
    await boot(context);
  },
  'db bootstrap': dbBootstrap,
  migrate: migrateCommand,
};

/**
 * The CLI's company and admin commands, by their two words, which take flags (ADR 0011, ADR 0066).
 * There is no admin create: companies and their first Company admins come from company create.
 */
// biome-ignore lint/suspicious/noExplicitAny: each command validates its own input.
const adminCommands: Readonly<Record<string, AdminCommand<any>>> = {
  'company create': companyCreate,
  'company add-admin': companyAddAdmin,
  'company list': companyList,
  'admin reset-password': adminResetPassword,
};

/**
 * Runs the command that the arguments name, or serve when there are none. A command that stops on
 * a ConfigError, a BootError or a MigrationError writes its message to log.error and exits 1.
 */
export async function cli(argv: readonly string[], context: CliContext): Promise<void> {
  const name = argv.join(' ') || 'serve';
  const adminName = argv.slice(0, 2).join(' ');
  const adminCommand = adminCommands[adminName];
  const command = commands[name];
  if (!command && !adminCommand) {
    const names = [...Object.keys(commands), ...Object.keys(adminCommands)];
    context.log.error(`Unknown command "${name}". Commands: ${names.join(', ')}`);
    context.exit(1);
    return;
  }
  try {
    if (adminCommand) {
      await runAdminCommand(adminCommand, argv.slice(2), {
        ...context,
        print: context.print ?? ((text) => process.stdout.write(text)),
      });
    } else {
      await command?.(context);
    }
  } catch (error) {
    const known =
      error instanceof ConfigError || error instanceof BootError || error instanceof MigrationError;
    if (!known) throw error;
    context.log.error(error.message);
    context.exit(1);
    return;
  }
}
