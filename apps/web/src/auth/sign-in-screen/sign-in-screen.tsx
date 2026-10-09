// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleCheck } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ErrorSummary, type SummaryError } from '../../ui/components/error-summary/index.ts';
import { SkipLink } from '../../ui/components/skip-link/index.ts';
import { TextField } from '../../ui/components/text-field/index.ts';
import { announce } from '../../ui/lib/announce.ts';
import { Alert, AlertTitle } from '../../ui/primitives/alert.tsx';
import { Button } from '../../ui/primitives/button.tsx';
import { Card, CardContent, CardHeader } from '../../ui/primitives/card.tsx';
import type { AuthSession, SignInResult } from '../auth-session.ts';

export interface SignInScreenProps {
  /** The session the form signs in to. */
  readonly session: Pick<AuthSession, 'signIn'>;
  /** Shows "You are signed out" and moves focus to the h1, after Sign out (SI19). */
  readonly signedOut?: boolean;
  /** Called once the user is signed in. */
  readonly onSignedIn: () => void;
}

/** The id of main, which the skip link moves focus to. */
const mainId = 'main';

/** A sign-in that the API refused. */
type Refusal = Exclude<SignInResult, { ok: true }>;

/** What the last submit came to: the fields' errors or the API's refusal. */
type Problem =
  | { readonly kind: 'fields'; readonly login?: string; readonly password?: string }
  | { readonly kind: 'refused'; readonly refusal: Refusal };

/** The summary's heading and entries for a problem (the D2 sign-in copy list). */
function summaryOf(problem: Problem): { heading: string; errors: SummaryError[] } {
  switch (problem.kind) {
    case 'fields': {
      const errors: SummaryError[] = [
        ...(problem.login === undefined
          ? []
          : [{ name: 'username', message: 'Enter your username or email' }]),
        ...(problem.password === undefined
          ? []
          : [{ name: 'password', message: 'Enter your password' }]),
      ];
      const fields = errors.length === 1 ? '1 field' : `${errors.length} fields`;
      return { heading: `Fix ${fields} to sign in`, errors };
    }
    case 'refused':
      return refusalSummary(problem.refusal);
  }
}

/** The summary of a refusal: why, and what to do next. */
function refusalSummary(refusal: Refusal): { heading: string; errors: SummaryError[] } {
  switch (refusal.reason) {
    case 'wrong-credentials':
      return {
        heading: 'The username or password is wrong',
        errors: [
          { message: 'Passwords are case-sensitive.' },
          { name: 'password', message: 'Enter your password again' },
        ],
      };
    case 'rate-limited': {
      const seconds = refusal.retryAfterSeconds;
      const wait = seconds === 1 ? '1 second' : `${seconds} seconds`;
      return {
        heading: 'Too many sign-in attempts',
        errors: [{ message: `Wait ${wait}, then sign in again.` }],
      };
    }
    case 'blocked':
      return {
        heading: 'This account is blocked',
        errors: [{ message: 'Ask a plant admin if you still need access.' }],
      };
    default:
      return {
        heading: 'NorthMES could not sign you in',
        errors: [{ message: 'Check your connection, then sign in again.' }],
      };
  }
}

/**
 * The sign-in page (D2, SI1 to SI9 and SI19): outside the planner shell, a card with the h1, the
 * error summary, Username or email, Password and Sign in. Enter in a field submits. A submit with
 * empty fields or a refusal from the API moves focus to the summary; a wrong password keeps the
 * username and clears the password. After Sign out, focus goes to the h1 and the polite region
 * says "You are signed out." once.
 */
export function SignInScreen({ session, signedOut = false, onSignedIn }: SignInScreenProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<Problem | undefined>(undefined);
  const [submits, setSubmits] = useState(0);
  const [passwordWrong, setPasswordWrong] = useState(false);
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const announced = useRef(false);

  useEffect(() => {
    document.title = 'Sign in · NorthMES';
  }, []);

  useEffect(() => {
    if (!signedOut || announced.current) return;
    announced.current = true;
    heading.current?.focus();
    announce('You are signed out.');
  }, [signedOut]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    // The summary takes focus when submits changes, so it changes together with the problem: a
    // screen reader then reads the new error, not the one before it.
    const failWith = (next: Problem) => {
      setProblem(next);
      setSubmits((count) => count + 1);
    };
    const empty = {
      ...(login.trim() === '' ? { login: 'Enter your username or email.' } : {}),
      ...(password === '' ? { password: 'Enter your password.' } : {}),
    };
    if (Object.keys(empty).length > 0) {
      failWith({ kind: 'fields', ...empty });
      return;
    }
    busy.current = true;
    const result = await session.signIn(login.trim(), password).finally(() => {
      busy.current = false;
    });
    if (result.ok) {
      onSignedIn();
      return;
    }
    failWith({ kind: 'refused', refusal: result });
    if (result.reason === 'wrong-credentials') {
      setPassword('');
      setPasswordWrong(true);
    }
  }

  const summary = problem === undefined ? undefined : summaryOf(problem);
  const fieldErrors = problem?.kind === 'fields' ? problem : undefined;
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SkipLink targetId={mainId} />
      <header className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
        >
          N
        </span>
        <span className="font-semibold">NorthMES</span>
      </header>
      <main
        id={mainId}
        tabIndex={-1}
        className="flex flex-1 justify-center px-4 py-8 sm:py-24 focus-visible:outline-offset-[-4px]"
      >
        <Card className="h-fit w-full max-w-104 gap-6 py-8 max-sm:bg-transparent max-sm:py-0 max-sm:ring-0">
          <CardHeader className="px-8 max-sm:px-0">
            <h1
              ref={heading}
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-[2.125rem]"
            >
              Sign in to NorthMES
            </h1>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-8 max-sm:px-0">
            {signedOut && problem === undefined && (
              // The polite region says it once, so the box has no live role: role none replaces the
              // role alert of shadcn's Alert.
              <Alert role="none" className="border-success bg-success-subtle text-foreground">
                <CircleCheck aria-hidden className="text-success" />
                <AlertTitle>You are signed out</AlertTitle>
              </Alert>
            )}
            {summary !== undefined && (
              <ErrorSummary heading={summary.heading} errors={summary.errors} focusKey={submits} />
            )}
            <form noValidate onSubmit={submit} className="flex flex-col gap-5">
              <TextField
                label="Username or email"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                error={fieldErrors?.login}
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordWrong(false);
                }}
                error={
                  passwordWrong
                    ? 'Enter your password again. Passwords are case-sensitive.'
                    : fieldErrors?.password
                }
              />
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
            <p className="text-sm text-muted-foreground">
              Forgot your password? Ask a plant admin to reset it.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
