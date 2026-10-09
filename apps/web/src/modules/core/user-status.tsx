// SPDX-License-Identifier: AGPL-3.0-or-later
import { Ban, CircleCheck } from 'lucide-react';
import { StatusBadge } from '../../ui/components/status-badge/index.ts';

/** A user's StatusBadge: Active, or Blocked when they cannot sign in (design core-304, US1). */
export function UserStatus({ blocked }: { readonly blocked: boolean }) {
  return blocked ? (
    <StatusBadge tone="destructive" icon={Ban}>
      Blocked
    </StatusBadge>
  ) : (
    <StatusBadge tone="success" icon={CircleCheck}>
      Active
    </StatusBadge>
  );
}
