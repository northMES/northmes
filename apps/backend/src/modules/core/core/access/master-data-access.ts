// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { MasterDataAccess } from '@northmes/sdk/master-data';
import type { CoreContext } from '../commands/context.ts';
import { requestCompany } from '../commands/company-scope.ts';
import { type RequestScope, readAsRequest, readIn, requestScope } from './request-scope.ts';

/**
 * What core's registers built with the master-data kit learn of the running request (ADR 0022):
 * its scope and read scopes as core's own services read them, and the company a command writes at.
 */
export const masterDataAccess: MasterDataAccess<RequestScope> = {
  requestScope,
  readIn,
  readAsRequest,
  requestCompany: (input, context) =>
    requestCompany(input, context as Pick<CoreContext, 'tx' | 'plantId'>),
};
