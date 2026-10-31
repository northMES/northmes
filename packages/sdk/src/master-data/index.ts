// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
// Server-only: the master-data kit's server factory (ADR 0022), which turns a register's
// defineMasterData definition into its commands, service, resolvers and operations.
export type { MasterDataAccess, MasterDataRequestScope } from './access.ts';
export {
  type MasterDataCreateContext,
  type MasterDataRecord,
  type MasterDataRow,
  type MasterDataServerOptions,
  type MasterDataService,
  masterDataServer,
} from './master-data-server.ts';
export type { MasterDataColumns, MasterDataTable } from './table.ts';
