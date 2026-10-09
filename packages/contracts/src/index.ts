// SPDX-License-Identifier: MIT
export { API_MAJOR, apiPath } from './api-path.ts';
export {
  type CommandContract,
  type CommandContractOptions,
  type CommandTarget,
  defineCommandContract,
  timestamp,
  version,
} from './define-command-contract.ts';
export {
  defineListDeclaration,
  defineListQueryContract,
  isListQueryContract,
  LIST_DEFAULT_PAGE_SIZE,
  LIST_MAX_PAGE_SIZE,
  type ListDeclaration,
  type ListOrder,
  type ListQueryContract,
  type ListQueryContractOptions,
  type ListSortColumn,
} from './define-list-query-contract.ts';
export {
  defineCoreLinks,
  defineModuleLinks,
  type LinkBuilder,
  type LinkEntry,
  type LinkEntryDefinition,
  type LinkEntryDefinitions,
  type LinkNode,
  type LinkParams,
  type LinkSearch,
  linkEntry,
  type ModuleLink,
  type ModuleLinkSections,
  type ModuleLinks,
} from './define-module-links.ts';
export {
  defineOperations,
  type Operation,
  type OperationEntry,
  type OperationScope,
  type OperationsDeclaration,
  type OperationsOptions,
  type RestBinding,
  type ToolBinding,
} from './define-operations.ts';
export {
  defineQueryContract,
  type QueryContract,
  type QueryContractOptions,
} from './define-query-contract.ts';
export { isOutsideText, outsideText } from './outside-text.ts';
