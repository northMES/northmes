// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { customerList as customerListDeclaration } from '@northmes/core-contracts';
import { defineList } from '@northmes/sdk/lists';
import { Customer } from '../types/customer.type.ts';

/**
 * The list of the company's customers that core's contracts package declares: coreCustomers, by
 * customer number unless orderBy says otherwise (ADR 0016).
 */
export const customerList = defineList(customerListDeclaration, { node: () => Customer });

/** The arguments of coreCustomers. */
export type CustomerListArgs = Parameters<typeof customerList.page>[2];
