// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { coreLinks } from '@northmes/core-contracts';
import { useShell } from '@northmes/web-sdk';
import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import { buttonVariants } from '../../../../ui/primitives/button.tsx';
import { useRoutings } from '../../routings-source-context.ts';

/**
 * The Routing section of an article's page (design #729, RO1 and RO6): the active routing of the
 * article by its number, with the count of its operations and the way to it, or that the article
 * has none and what that means. It reads the routings through their own seam, the fixture G1
 * until core's routing API.
 */
export function ArticleRouting({ code, name }: { readonly code: string; readonly name: string }) {
  const { plant } = useShell();
  const id = useId();
  const { snapshot } = useRoutings(undefined);
  const routing = snapshot?.routings.find((each) => each.articleNumber === code);
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-6 text-card-foreground"
    >
      <h2 id={id} className="text-base font-semibold">
        Routing
      </h2>
      {snapshot === undefined ? (
        <p className="text-sm text-muted-foreground">Loading the routing.</p>
      ) : routing === undefined ? (
        <>
          <p className="text-sm font-medium">{name} has no routing</p>
          <p className="text-sm text-muted-foreground">
            Routings come from the ERP with the article’s operations, or are created for orders that
            NorthMES releases. Without a routing an order of {name} cannot be released or planned.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {`ERP routing version ${routing.erpVersion}, ${routing.operations.length} operation${routing.operations.length === 1 ? '' : 's'}.`}
          </p>
          <Link
            to={coreLinks.routings.routing({ plant, articleId: routing.articleNumber }).href}
            className={`${buttonVariants({ variant: 'outline' })} self-start`}
          >
            Open the routing of {routing.articleName}
          </Link>
        </>
      )}
    </section>
  );
}
