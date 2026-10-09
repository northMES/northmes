// SPDX-License-Identifier: AGPL-3.0-or-later
import { useRouter } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import type { PageState } from '../../ui/components/page-frame/index.ts';
import { Button } from '../../ui/primitives/button.tsx';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../ui/primitives/empty.tsx';
import { permissionLine } from './permission-names.ts';

/** "the permission to read roles (core.role:read)", as a refusal names what it needs. */
export function permissionPhrase(key: string): string {
  const line = permissionLine(key);
  return `the permission to ${line.charAt(0).toLowerCase()}${line.slice(1)} (${key})`;
}

/** Go back, the way out of a page the user may not open. */
function GoBack() {
  const router = useRouter();
  return (
    <Button variant="outline" onClick={() => router.history.back()}>
      Go back
    </Button>
  );
}

/**
 * The state of a page opened by URL without its permission (design core-304, NO1 and RO31): no
 * data, the permission it needs at the place where the API checks it, who can give it, and a way
 * out. place is the plant's name for a permission checked at the plant, and the company's for one
 * checked at the company, whose admin then gives it. The page's h1 says "No access to Roles", so
 * the state has no heading of its own.
 */
export function noAccessState(
  page: string,
  permission: string,
  place: string,
  admin = 'a plant admin',
): PageState {
  return {
    status: 'empty',
    description: `Opening ${page} needs ${permissionPhrase(permission)} at ${place}. Ask ${admin} for a role that includes it.`,
    action: <GoBack />,
  };
}

interface ForbiddenRegionProps {
  /** What the region would show, such as "You cannot see what Sara Nyberg can do here". */
  readonly title: string;
  readonly permission: string;
  readonly plant: string;
}

/**
 * A region whose data the API refused with FORBIDDEN (design core-304, NO3 and AS25): the region
 * keeps its card and h2, and this note names the permission it needs, under an h3.
 */
export function ForbiddenRegion({ title, permission, plant }: ForbiddenRegionProps) {
  return (
    <Empty className="items-start gap-2 p-0 text-left">
      <EmptyHeader className="max-w-prose items-start text-left">
        <EmptyMedia className="mb-0">
          <Lock aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>
          <h3 className="text-sm font-semibold">{title}</h3>
        </EmptyTitle>
        <EmptyDescription>
          This needs {permissionPhrase(permission)} at {plant}.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
