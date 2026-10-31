// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Server-only: the master-data kit's server side (ADR 0022). masterDataService turns a register's
// defineMasterData definition into its commands and service in core/, and masterDataApi into its
// GraphQL fields and operations in api/.
export type { MasterDataAccess, MasterDataRequestScope } from './access.ts';
export { type MasterDataApiOptions, masterDataApi } from './master-data-api.ts';
export {
  type MasterDataCreateContext,
  type MasterDataRecord,
  type MasterDataRow,
  type MasterDataService,
  type MasterDataServiceKit,
  type MasterDataServiceOptions,
  type MasterDataUpdateContext,
  masterDataService,
} from './master-data-service.ts';
export type { MasterDataColumns, MasterDataTable } from './table.ts';
