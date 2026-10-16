// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Consumer, EventConsumerProvider } from '@northmes/sdk/events';
import { BootError } from '../boot/boot-error.ts';
import type { ValidatorScope } from '../commands/discover-validators.ts';
import { moduleProviders, providerClassOf } from '../module-providers.ts';

/** A consumer the host runs, with its module and the job queue its events go to. */
export interface RegisteredConsumer {
  readonly module: string;
  /** `<module id>.<consumer name>`, the consumer's pg-boss queue. */
  readonly queue: string;
  readonly consumer: Consumer;
}

/** A consumer name: kebab-case, as a module id is. */
const kebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * The event consumers among the providers of each module, with the id of that module and the
 * name of the consumer's job queue (ADR 0014). Each module's walk stops at the Nest module of
 * another module, as discoverValidators' does. Throws one BootError that lists every consumer
 * whose name is not kebab-case or is taken by another consumer of its module.
 */
export function discoverConsumers(modules: readonly ValidatorScope[]): RegisteredConsumer[] {
  const roots = modules.map(({ module }) => module);
  const problems: string[] = [];
  const registered = modules.flatMap(({ id, module }) => {
    const consumers = moduleProviders(module, new Set(roots.filter((root) => root !== module)))
      .map(providerClassOf)
      .flatMap((provider) => {
        const { consumer } = (provider ?? {}) as Partial<EventConsumerProvider>;
        return consumer ? [consumer] : [];
      });
    const seen = new Set<string>();
    for (const { name } of consumers) {
      if (seen.has(name)) {
        problems.push(
          `Module ${id} has two consumers named ${name}; give each consumer a name of its own`,
        );
      }
      seen.add(name);
      if (!kebabCase.test(name)) {
        problems.push(
          `Consumer "${name}" of module ${id} must have a kebab-case name, such as article-log`,
        );
      }
    }
    return consumers.map((consumer) => ({ module: id, queue: `${id}.${consumer.name}`, consumer }));
  });
  if (problems.length > 0) throw new BootError(problems);
  return registered;
}
