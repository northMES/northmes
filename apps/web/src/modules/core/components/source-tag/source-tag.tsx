// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Pencil, TriangleAlert } from 'lucide-react';
import { OwnerTag } from '../../../../ui/components/owner-tag/index.ts';
import { StatusBadge } from '../../../../ui/components/status-badge/index.ts';

/** Who set a master data value (design #729): the ERP, NorthMES, a planner's kept value, the import. */
export type SourceTagKind = 'erp' | 'northmes' | 'kept' | 'import';

/**
 * The tag beside a master data value that says who set it (design #729, proposals): From the ERP
 * (muted, lock), Set in NorthMES (info, pencil), Kept in NorthMES (warning, lock: the import leaves
 * it) and Created by the import (warning, alert).
 */
export function SourceTag({ kind }: { readonly kind: SourceTagKind }) {
  switch (kind) {
    case 'erp':
      return <OwnerTag>From the ERP</OwnerTag>;
    case 'northmes':
      return (
        <StatusBadge tone="info" icon={Pencil}>
          Set in NorthMES
        </StatusBadge>
      );
    case 'kept':
      return <StatusBadge tone="warning">Kept in NorthMES</StatusBadge>;
    case 'import':
      return (
        <StatusBadge tone="warning" icon={TriangleAlert}>
          Created by the import
        </StatusBadge>
      );
  }
}
