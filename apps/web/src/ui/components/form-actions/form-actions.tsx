// SPDX-License-Identifier: AGPL-3.0-or-later
import { Link } from '@tanstack/react-router';
import { Button, buttonVariants } from '../../primitives/button.tsx';

export interface FormActionsProps {
  /** The submit button's text, such as Save article or Create role. */
  readonly saveLabel: string;
  /** The save is running: the submit button is busy. */
  readonly saving: boolean;
  /** Where Cancel leads: the list for a new record, the record's page for an edit. */
  readonly cancelHref: string;
  /** The form has changes that are not saved, which the bar says beside its buttons. */
  readonly dirty?: boolean;
}

/**
 * The Save bar of a form page (design ui-222, DE7 and NA20; core-304, NO15): sticky at the bottom
 * of the page, with the submit button, Cancel as a link, and "Changes not saved" while the form has
 * changes. The page's scroll-padding-bottom keeps a focused field clear of it (WCAG 2.4.11).
 */
export function FormActions({ saveLabel, saving, cancelHref, dirty = false }: FormActionsProps) {
  return (
    <div
      data-slot="form-actions"
      className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-border bg-background px-4 py-3 md:-mx-7 md:px-7"
    >
      <Button type="submit" loading={saving}>
        {saveLabel}
      </Button>
      <Link to={cancelHref} className={buttonVariants({ variant: 'outline' })}>
        Cancel
      </Link>
      {dirty && <p className="text-sm text-muted-foreground">Changes not saved</p>}
    </div>
  );
}
