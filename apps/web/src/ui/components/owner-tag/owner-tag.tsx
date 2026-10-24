// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../../primitives/badge.tsx';

/**
 * The tag that names who owns a value another system sends (design #686 PO5, #688 MA4 and #728),
 * such as "From the ERP": an outline pill with the lock, beside a label, a title or a value, so the
 * person sees what the next import changes.
 */
export function OwnerTag({ children }: { readonly children: ReactNode }) {
  return (
    <Badge variant="outline" className="h-4.5 gap-1 px-1.5 text-tick">
      <Lock aria-hidden className="size-3" />
      {children}
    </Badge>
  );
}
