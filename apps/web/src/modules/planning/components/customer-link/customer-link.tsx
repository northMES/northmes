// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';

const link = 'text-link underline underline-offset-2 hover:no-underline';

/** A customer's name as the link to its page in the customers register (design #728). */
export function CustomerLink({ code, name }: { readonly code: string; readonly name: string }) {
  const { plant } = useShell();
  return (
    <Link to={coreLinks.customers.customer({ plant, customerId: code }).href} className={link}>
      {name}
    </Link>
  );
}
