// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from '../lib/cn.ts';

/** The D1 Input look: a 36 px control on the card surface with an --input border. */
export const inputClassName = cn(
  'h-(--nm-control-height) w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground',
  'placeholder:text-muted-foreground hover:border-foreground focus-visible:border-foreground',
  'disabled:bg-muted disabled:opacity-50',
  // Invalid: a --destructive border plus a 1 px inset, kept beside the focus ring's inner band.
  'data-invalid:border-destructive data-invalid:shadow-[inset_0_0_0_1px_var(--destructive)]',
  'data-invalid:focus-visible:shadow-[0_0_0_2px_var(--focus-ring),inset_0_0_0_1px_var(--destructive)]',
);

/**
 * The id of the input that edits the form field `name` (a schema path joined with dots), so the
 * error summary can link to it.
 */
export function fieldId(name: string): string {
  return `field-${name}`;
}
