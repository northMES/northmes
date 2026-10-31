// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
export { API_MAJOR, apiPath } from './api-path.ts';
export {
  type CommandContract,
  type CommandContractOptions,
  type CommandTarget,
  defineCommandContract,
  timestamp,
  version,
} from './define-command-contract.ts';
export { defineEventContract, type EventContract } from './define-event-contract.ts';
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
  defineMasterData,
  type MasterDataDefinition,
  type MasterDataOptions,
  type MasterDataScope,
  type MasterDataScopes,
  scopeLevel,
} from './define-master-data.ts';
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
export {
  type LocalizedText,
  resolveLocalized,
  type Translation,
  translation,
  translations,
} from './localized-text.ts';
export { isOutsideText, outsideText } from './outside-text.ts';
export { paletteColor, paletteColors } from './palette.ts';
export { fieldError, problem } from './problem.ts';
export {
  DEFAULT_STOCK_UNIT,
  type Dimension,
  type StockUnitCode,
  stockUnit,
  stockUnitCodes,
  type Unit,
  unitCatalog,
  unitOf,
} from './units.ts';
