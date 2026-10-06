// Every export is named; this package is host-provided at run time.
export { type Principal, type SubgraphContext, loaderFor } from "./context.js";
export { batchLoader } from "./loader.js";
export { RequirePermission, Public, PermissionGuard, guardLog } from "./permission.js";
export { PageInfo, entityRef, entityRefs, connectionOf, toConnection } from "./types.js";
export {
  FEDERATION_LINK,
  InProcessSubgraphDriver,
  SubgraphRegistry,
  SubgraphRegistryModule,
  defineSubgraph,
  type SubgraphEntry,
  type DefineSubgraphOptions,
} from "./subgraph.js";
export { defineModule, moduleNames, MODULE_ID, type ModuleManifest, type ModuleNames } from "./manifest.js";
export {
  COMMAND_BUS,
  COMMAND_VALIDATOR_KEY,
  CommandValidator,
  CommandRejected,
  type CommandBus,
  type CommandContext,
  type CommandValidatorOptions,
  type ValidatorVerdict,
} from "./commands.js";
export { HOST_PROVIDED, isHostProvided } from "./host-provided.js";
