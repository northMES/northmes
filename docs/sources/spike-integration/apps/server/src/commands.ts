import { Global, Inject, Injectable, Module, type OnApplicationBootstrap } from "@nestjs/common";
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import {
  COMMAND_BUS, COMMAND_VALIDATOR_KEY, CommandRejected, type CommandBus, type CommandContext,
  type CommandValidatorOptions, type ValidatorVerdict,
} from "@northmes/sdk";
import { CATALOG, type LoadedCatalog } from "./tokens.js";

interface RegisteredValidator {
  readonly owner: string;
  readonly order: number;
  readonly name: string;
  readonly timeoutMs: number;
  readonly fn: (input: unknown, ctx: CommandContext) => Promise<ValidatorVerdict | void> | ValidatorVerdict | void;
}

export class ValidatorRegistrationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Command validator registration failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
}

@Injectable()
export class CommandBusImpl implements CommandBus, OnApplicationBootstrap {
  private readonly validators = new Map<string, RegisteredValidator[]>();
  readonly log: string[] = [];

  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(MetadataScanner) private readonly scanner: MetadataScanner,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(CATALOG) private readonly catalog: LoadedCatalog,
  ) {}

  onApplicationBootstrap() {
    const problems: string[] = [];
    const ownerByModule = new Map([...this.catalog.serverModules].map(([id, cls]) => [cls, id]));
    const orderOf = new Map(this.catalog.ordered.map((m, i) => [m.manifest.id, i]));
    const declaredBy = new Map<string, string>();
    for (const m of this.catalog.ordered) {
      for (const [name, def] of Object.entries(m.manifest.commands ?? {})) if (def.validatable) declaredBy.set(name, m.manifest.id);
    }
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || typeof instance !== "object") continue;
      const proto = Object.getPrototypeOf(instance);
      for (const method of this.scanner.getAllMethodNames(proto)) {
        const meta = this.reflector.get<CommandValidatorOptions | undefined>(COMMAND_VALIDATOR_KEY, (instance as any)[method]);
        if (!meta) continue;
        const owner = ownerByModule.get(wrapper.host?.metatype as any) ?? "?";
        const declarer = declaredBy.get(meta.command);
        const where = `${owner}: ${wrapper.name}.${method}`;
        if (!declarer) problems.push(`${where} validates "${meta.command}", which no installed module declares as validatable`);
        else if (declarer !== owner && !this.catalog.dependencyClosure(owner).has(declarer)) {
          problems.push(`${where} validates "${meta.command}" of ${declarer} but does not depend on ${declarer}`);
        }
        const list = this.validators.get(meta.command) ?? [];
        list.push({ owner, order: orderOf.get(owner) ?? 1e6, name: `${owner}:${wrapper.name}.${method}`, timeoutMs: meta.timeoutMs ?? 2000, fn: (instance as any)[method].bind(instance) });
        this.validators.set(meta.command, list);
      }
    }
    for (const list of this.validators.values()) list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    if (problems.length) throw new ValidatorRegistrationError(problems);
  }

  validatorsFor(command: string) {
    return (this.validators.get(command) ?? []).map((v) => v.name);
  }

  async run<I, O>(command: string, input: I, ctx: CommandContext, handler: (input: I) => Promise<O>): Promise<O> {
    for (const v of this.validators.get(command) ?? []) {
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<ValidatorVerdict>((resolve) => {
        timer = setTimeout(() => resolve({ reject: `${v.owner} did not answer within ${v.timeoutMs} ms` }), v.timeoutMs);
      });
      const verdict = await Promise.race([Promise.resolve(v.fn(Object.freeze({ ...input }), ctx)), timeout]).finally(() => clearTimeout(timer));
      this.log.push(`${command} ${v.name} ${verdict?.reject ? "reject" : "allow"}`);
      if (verdict?.reject) throw new CommandRejected(command, v.owner, verdict.reject);
    }
    return handler(input);
  }
}

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [CommandBusImpl, { provide: COMMAND_BUS, useExisting: CommandBusImpl }],
  exports: [COMMAND_BUS, CommandBusImpl],
})
export class CommandsModule {}
