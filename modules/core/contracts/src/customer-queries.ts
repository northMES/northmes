// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineListDeclaration, outsideText, timestamp, version } from '@northmes/contracts';
import { z } from 'zod';

/**
 * A customer of the company as core answers it: its customer number and its name, and no
 * organisation number, address or phone number (story E06-S07). Both are outside text, since an
 * ERP names them.
 */
export const customer = z.object({
  id: z.uuid(),
  code: outsideText(),
  name: outsideText(),
  version,
  updatedAt: timestamp,
});

/**
 * The list of the company's customers (ADR 0016): by customer number unless orderBy says
 * otherwise, with search over number and name.
 */
export const customerList = defineListDeclaration({
  name: 'Customer',
  node: customer,
  sortFields: {
    code: { column: 'code', type: 'text' },
    name: { column: 'name', type: 'text' },
    updatedAt: { column: 'updated_at', type: 'timestamptz' },
  },
  defaultOrderBy: ['code'],
  search: ['code', 'name'],
});
