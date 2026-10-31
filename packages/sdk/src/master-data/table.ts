// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Translation } from '@northmes/contracts';
import type { ColumnType, Generated, GeneratedAlways } from 'kysely';

/** The columns every register table has, as pnpm gen:migration --register writes them. */
export interface MasterDataColumns {
  id: Generated<string>;
  company_id: string;
  /** The company's node or a plant's, where the row sits (ADR 0007). */
  scope_id: string;
  /** The span of the row's scope node, an int8range as Postgres writes it (ADR 0009). */
  scope_span: string;
  version: Generated<number>;
  code: string;
  /** lower(code), which the code exclusion constraint compares. */
  code_key: GeneratedAlways<string>;
  name: string;
  /** The translations of the name (ADR 0053), written as a JSON string. */
  translations: ColumnType<Translation[], string | undefined, string>;
  archived_at: Date | null;
  created_at: Generated<Date>;
  /** When the row last changed, its creation included; an update trigger moves it on. */
  updated_at: Generated<Date>;
}

/** A register table's Kysely type: the kit's columns and the register's own. */
export type MasterDataTable<Own extends object = Record<never, never>> = MasterDataColumns & Own;
