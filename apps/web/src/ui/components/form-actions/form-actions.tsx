// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Link } from '@tanstack/react-router';
import { Button, buttonVariants } from '../../primitives/button.tsx';

export interface FormActionsProps {
  /** The submit button's text, such as Save article or Create role. */
  readonly saveLabel: string;
  /** The save is running: the submit button is busy. */
  readonly saving: boolean;
  /** The form has changes that are not saved, which the bar says beside its buttons. */
  readonly dirty?: boolean;
  /** A line after the buttons on what Save does, such as a settings page's effect. */
  readonly note?: string;
}

/**
 * Cancel leads to a page (the list for a new record, the record's page for an edit), or resets a
 * form that stays on its page, such as a settings page.
 */
export type FormActionsCancel =
  | { readonly cancelHref: string; readonly onCancel?: never }
  | { readonly onCancel: () => void; readonly cancelHref?: never };

/**
 * The Save bar of a form page (design ui-222, DE7 and NA20; core-304, NO15): sticky at the bottom
 * of the page, with the submit button, Cancel (a link, or a button that resets a form that stays on
 * its page), "Changes not saved" while the form has changes, and an optional note. The page's
 * scroll-padding-bottom keeps a focused field clear of it (WCAG 2.4.11).
 */
export function FormActions({
  saveLabel,
  saving,
  cancelHref,
  onCancel,
  dirty = false,
  note,
}: FormActionsProps & FormActionsCancel) {
  return (
    <div
      data-slot="form-actions"
      className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-border bg-background px-4 py-3 md:-mx-7 md:px-7"
    >
      <Button type="submit" loading={saving}>
        {saveLabel}
      </Button>
      {cancelHref === undefined ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      ) : (
        <Link to={cancelHref} className={buttonVariants({ variant: 'outline' })}>
          Cancel
        </Link>
      )}
      {dirty && <p className="text-sm text-muted-foreground">Changes not saved</p>}
      {note !== undefined && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
