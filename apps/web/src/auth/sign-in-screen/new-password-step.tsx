// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ErrorSummary, type SummaryError } from '../../ui/components/error-summary/index.ts';
import { fieldId } from '../../ui/lib/field-id.ts';
import { Button } from '../../ui/primitives/button.tsx';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../ui/primitives/field.tsx';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../../ui/primitives/input-group.tsx';
import type { AuthSession, NewPasswordResult } from '../auth-session.ts';

export interface NewPasswordStepProps {
  /** The session the new password is saved to. */
  readonly session: Pick<AuthSession, 'setNewPassword'>;
  /** The account's username, which the step shows. */
  readonly username: string;
  /** The email the user signed in with, which a password manager saves the new password for. */
  readonly email: string;
  /** The temporary password the user signed in with, kept in memory for the API's check only. */
  readonly temporaryPassword: string;
  /** Called once the new password is saved. */
  readonly onSaved: () => void;
  /** Called by Sign out, which leaves without saving. */
  readonly onSignOut: () => void;
}

/** The name of New password, which the summary links to. */
const fieldName = 'new-password';

/** The minimum length of a password, Better Auth's default (D2, S2). */
const minimumLength = 8;

/** What the last submit came to: a problem with the field, or a refusal the field cannot fix. */
type Problem =
  | { readonly kind: 'field'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string };

/** The problem of a new password the page checks before it asks the API, or undefined. */
function fieldProblem(password: string, temporaryPassword: string): string | undefined {
  if (password === '') return 'Enter a new password.';
  if (password.length < minimumLength) return 'Use at least 8 characters.';
  if (password === temporaryPassword) return 'Choose a password other than the temporary one.';
  return undefined;
}

/** The problem of a refusal from the API. */
function refusalProblem(result: Exclude<NewPasswordResult, { ok: true }>): Problem {
  switch (result.reason) {
    case 'too-short':
      return { kind: 'field', message: 'Use at least 8 characters.' };
    case 'unchanged':
      return { kind: 'field', message: 'Choose a password other than the temporary one.' };
    case 'wrong-current':
      return {
        kind: 'failed',
        message: 'Sign out, then sign in again with the temporary password.',
      };
    default:
      return { kind: 'failed', message: 'Check your connection, then try again.' };
  }
}

/** The summary's heading and entries for a problem. */
function summaryOf(problem: Problem): { heading: string; errors: SummaryError[] } {
  if (problem.kind === 'field') {
    // The summary link is the field's error without its period.
    return {
      heading: 'Fix 1 field to continue',
      errors: [{ name: fieldName, message: problem.message.replace(/\.$/, '') }],
    };
  }
  return {
    heading: 'NorthMES could not save the password',
    errors: [{ message: problem.message }],
  };
}

/**
 * The new password step of the sign-in page (D2, SI16 to SI18; issue #416): after a sign-in with a
 * temporary password, the user chooses their own before anything else. The account's username
 * shows, and the email they signed in with sits in a hidden username field, read-only and out of
 * the tab order, so a password manager saves the new password for the right account. New password
 * has focus, with Show password, which keeps focus on the toggle, and the hint "Use at least 8
 * characters." Save and continue checks the length and that the password differs from the
 * temporary one, then sends both to the API; a problem moves focus to the summary, and the field
 * is masked again after each submit. Sign out leaves without saving.
 */
export function NewPasswordStep({
  session,
  username,
  email,
  temporaryPassword,
  onSaved,
  onSignOut,
}: NewPasswordStepProps) {
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [problem, setProblem] = useState<Problem | undefined>(undefined);
  const [submits, setSubmits] = useState(0);
  const busy = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  const inputId = fieldId(fieldName);
  const hintId = useId();
  const errorId = `${inputId}-error`;

  useEffect(() => {
    document.title = 'Set a new password · NorthMES';
    field.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setShown(false);
    const failWith = (next: Problem) => {
      setProblem(next);
      setSubmits((count) => count + 1);
    };
    const checked = fieldProblem(password, temporaryPassword);
    if (checked !== undefined) {
      failWith({ kind: 'field', message: checked });
      return;
    }
    busy.current = true;
    const result = await session.setNewPassword(temporaryPassword, password).finally(() => {
      busy.current = false;
    });
    if (result.ok) {
      onSaved();
      return;
    }
    failWith(refusalProblem(result));
  }

  const summary = problem === undefined ? undefined : summaryOf(problem);
  const fieldError = problem?.kind === 'field' ? problem.message : undefined;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm">
        You signed in with a temporary password. Choose a new password to continue.
      </p>
      {summary !== undefined && (
        <ErrorSummary heading={summary.heading} errors={summary.errors} focusKey={submits} />
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold">Username</p>
          <p className="text-sm font-medium">{username}</p>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={email}
            readOnly
            tabIndex={-1}
            aria-hidden
            className="sr-only"
          />
        </div>
        <Field data-invalid={fieldError !== undefined || undefined}>
          <FieldLabel htmlFor={inputId} className="block text-xs font-semibold text-foreground">
            New password
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              ref={field}
              id={inputId}
              name={fieldName}
              type={shown ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={fieldError !== undefined || undefined}
              aria-describedby={fieldError === undefined ? hintId : `${errorId} ${hintId}`}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                className="size-7"
                aria-label="Show password"
                aria-pressed={shown}
                onClick={() => setShown((value) => !value)}
              >
                {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {fieldError !== undefined && (
            <FieldError id={errorId} role="none" className="flex items-start gap-1 text-xs">
              <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              {fieldError}
            </FieldError>
          )}
          <FieldDescription id={hintId} className="text-xs">
            Use at least 8 characters.
          </FieldDescription>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Save and continue</Button>
          <Button type="button" variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </form>
    </div>
  );
}
