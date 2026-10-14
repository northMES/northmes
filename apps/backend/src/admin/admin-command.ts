// SPDX-License-Identifier: AGPL-3.0-or-later
import { type ParseArgsOptionsConfig, parseArgs } from 'node:util';
import { z } from 'zod';
import { type BootOptions, bootForAdmin } from '../boot/boot.ts';
import {
  AdministrationNotFound,
  AdministrationRefused,
  AdministrationService,
} from '../modules/core/public-api.ts';

/**
 * The exit codes of the CLI's company and admin commands (ADR 0066): 0 done, 1 an unexpected
 * error, a bad configuration or a refused boot, 2 a usage error, 3 refused, 4 not found.
 */
export const EXIT_USAGE = 2;
export const EXIT_REFUSED = 3;
export const EXIT_NOT_FOUND = 4;

/** What an admin command answers: one object for --json, and lines of text otherwise. */
export interface AdminAnswer {
  readonly json: unknown;
  readonly text: readonly string[];
}

/**
 * A command of the CLI that runs on the host's database through core's AdministrationService.
 * Its options are string flags; every command also takes --json. input validates the flags, so a
 * missing or bad flag is a usage error before anything boots. No command prompts or takes a
 * password as a flag.
 */
export interface AdminCommand<Input> {
  /** The command's words and flags, as its usage line shows them. */
  readonly usage: string;
  /** The string flags it takes, by name without the dashes. */
  readonly flags: readonly string[];
  /** Validates the flags it was given. */
  readonly input: z.ZodType<Input>;
  run(service: AdministrationService, input: Input): Promise<AdminAnswer>;
}

/** What a command needs from main.ts: its environment, process.exit, the log and standard output. */
export type AdminContext = Pick<BootOptions, 'env' | 'exit' | 'log'> & {
  /** Writes to standard output, where the answer goes and nothing else. */
  readonly print: (text: string) => void;
};

/** The required --reason of every command that writes, recorded once the audit trail arrives. */
export const reasonFlag = z
  .string('missing, give the reason for the change')
  .trim()
  .min(1, 'missing, give the reason for the change')
  .max(500, 'can be at most 500 characters');

/** The flags of args, or the lines of a usage error, which name flags and rules but no value. */
function parse<Input>(
  command: AdminCommand<Input>,
  args: readonly string[],
): { input: Input & { json: boolean } } | { problems: string[] } {
  const options: ParseArgsOptionsConfig = { json: { type: 'boolean' } };
  for (const flag of command.flags) options[flag] = { type: 'string' };
  let values: Record<string, unknown>;
  try {
    ({ values } = parseArgs({ args: [...args], options, strict: true, allowPositionals: false }));
  } catch (error) {
    // parseArgs names the option or the argument, never a flag's value.
    return { problems: [(error as Error).message] };
  }
  const parsed = command.input.safeParse(values);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map(({ path, message }) => `--${path.join('.')}: ${message}`),
    };
  }
  return { input: { ...parsed.data, json: values.json === true } };
}

/**
 * Runs an admin command: validates its flags, which exits 2 with the usage on a problem, boots the
 * app without listening, calls the command and prints its answer, as text or as one JSON object
 * with --json. A refusal exits 3 and a company or user that does not exist exits 4, each with its
 * message on the log. Boot's progress lines are left out, so standard output holds the answer
 * only. The app closes afterwards.
 */
export async function runAdminCommand<Input>(
  command: AdminCommand<Input>,
  args: readonly string[],
  context: AdminContext,
): Promise<void> {
  const { log, exit, print } = context;
  const parsed = parse(command, args);
  if ('problems' in parsed) {
    log.error([...parsed.problems, `Usage: ${command.usage} [--json]`].join('\n'));
    exit(EXIT_USAGE);
    return;
  }
  const { app } = await bootForAdmin({
    ...context,
    log: { info: () => undefined, error: (line) => log.error(line) },
  });
  try {
    await app.init();
    const answer = await command.run(app.get(AdministrationService), parsed.input);
    print(parsed.input.json ? `${JSON.stringify(answer.json)}\n` : `${answer.text.join('\n')}\n`);
  } catch (error) {
    if (error instanceof AdministrationRefused) {
      log.error(error.message);
      exit(EXIT_REFUSED);
      return;
    }
    if (error instanceof AdministrationNotFound) {
      log.error(error.message);
      exit(EXIT_NOT_FOUND);
      return;
    }
    throw error;
  } finally {
    await app.close();
  }
}
