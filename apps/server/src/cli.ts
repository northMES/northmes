// SPDX-License-Identifier: AGPL-3.0-or-later
import { type BootOptions, boot } from './boot/boot.ts';

/** What main.ts hands a command: the process environment, exit and console. */
export type CliContext = Omit<BootOptions, 'importManifest'>;

/** The commands of pnpm northmes, by name. */
const commands: Readonly<Record<string, (context: CliContext) => Promise<void>>> = {
  serve: async (context) => {
    await boot({ ...context, importManifest: (specifier) => import(specifier) });
  },
};

/** Runs the command that the first argument names, or serve when there is none. */
export async function cli(argv: readonly string[], context: CliContext): Promise<void> {
  const [name = 'serve'] = argv;
  const command = commands[name];
  if (!command) {
    context.log.error(`Unknown command "${name}". Commands: ${Object.keys(commands).join(', ')}`);
    context.exit(1);
    return;
  }
  await command(context);
}
