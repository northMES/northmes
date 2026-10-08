// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { fieldId } from './field.ts';

/** One entry of the summary: a message, and the form field it belongs to when there is one. */
export interface SummaryError {
  /** The field's name, a schema path joined with dots; without one the entry is plain text. */
  readonly name?: string;
  /** The id of the field's input when it is not fieldId(name), such as a TextField with its own id. */
  readonly fieldId?: string;
  readonly message: string;
}

export interface ErrorSummaryProps {
  /** The heading that names the group, such as "Fix 2 fields to save the article". */
  readonly heading: string;
  readonly errors: readonly SummaryError[];
  /**
   * A value that changes with each submit, such as react-hook-form's submitCount: the summary takes
   * focus when it appears and again whenever this value changes while it shows errors.
   */
  readonly focusKey?: unknown;
  /**
   * Text and actions under the list, such as the text of a version conflict and Reload article.
   * With them, the summary shows also without errors.
   */
  readonly children?: ReactNode;
}

/**
 * The error summary at the top of a form (plan 06, Forms; WCAG 3.3.1): a group named by its
 * heading that takes focus after a failed submit, with each message as a link that moves focus to
 * its field. It renders nothing without errors and children.
 */
export function ErrorSummary({ heading, errors, focusKey, children }: ErrorSummaryProps) {
  const summary = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const showing = errors.length > 0 || children !== undefined;

  useEffect(() => {
    if (showing) summary.current?.focus();
  }, [showing, focusKey]);

  if (!showing) return null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: the design names the summary a group of links; a fieldset groups form controls.
    <div
      ref={summary}
      role="group"
      aria-labelledby={headingId}
      tabIndex={-1}
      className="rounded-lg border border-destructive bg-destructive-subtle p-4 text-sm text-destructive"
    >
      <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold">
        <CircleAlert aria-hidden className="size-4 shrink-0" />
        {heading}
      </h2>
      {errors.length > 0 && (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-10">
          {errors.map(({ name, fieldId: id, message }) => (
            <li key={`${name ?? ''}:${message}`}>
              {name === undefined ? (
                message
              ) : (
                <a
                  href={`#${id ?? fieldId(name)}`}
                  className="underline underline-offset-2 hover:no-underline"
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(id ?? fieldId(name))?.focus();
                  }}
                >
                  {message}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {children !== undefined && (
        <div className="mt-2 flex flex-col items-start gap-3 text-foreground">{children}</div>
      )}
    </div>
  );
}
