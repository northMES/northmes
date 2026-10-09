// SPDX-License-Identifier: AGPL-3.0-or-later
import { ErrorSummary, ErrorSummaryAction, type SummaryError } from '../error-summary/index.ts';

export interface ConflictSummaryProps {
  /** The record in plain words, such as article or role, which the heading and the text name. */
  readonly noun: string;
  /** Other errors of the save, listed above the text. */
  readonly errors: readonly SummaryError[];
  /** Reads the saved record and fills the form with it. */
  readonly onReload: () => Promise<void>;
}

/**
 * The error summary of a save refused because the record changed meanwhile (design ui-222, DE19;
 * ADR 0017): it takes focus, says that the entries are kept, and offers Reload, busy while it runs.
 */
export function ConflictSummary({ noun, errors, onReload }: ConflictSummaryProps) {
  return (
    <ErrorSummary heading={`This ${noun} changed while you edited it`} errors={errors}>
      <p>
        Someone saved this {noun} after you opened it. Your entries are kept. Reload the {noun} to
        see the saved values, then make your change again.
      </p>
      <ErrorSummaryAction label={`Reload ${noun}`} onAction={onReload} />
    </ErrorSummary>
  );
}
