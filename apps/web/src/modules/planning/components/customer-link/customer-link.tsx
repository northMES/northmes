// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { planningLinks } from '@northmes/planning-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';

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

/** A customer order's number as the link to its page (design #728). */
export function CustomerOrderLink({
  number,
  className,
}: {
  readonly number: string;
  readonly className?: string;
}) {
  const { plant } = useShell();
  return (
    <Link
      to={planningLinks.customerOrders.customerOrder({ plant, customerOrderId: number }).href}
      className={cn('font-mono', link, className)}
    >
      {number}
    </Link>
  );
}
