// SPDX-License-Identifier: MIT
import { CombinedGraphQLErrors, ServerError } from '@apollo/client';

/**
 * What a failure shows (design shell-306, What decides the page): the link page (400), not found,
 * no access (#304), the session ended (sign-in), the form or dialog that sent the command (409 and
 * 412, never a page), the server error page (500), the restarting state (502 to 504), no
 * connection, the reload dialog (D2 ST3) or the error panel of a render error (D2 ST6).
 */
export type ErrorPage =
  | 'link'
  | 'not-found'
  | 'forbidden'
  | 'session'
  | 'form'
  | 'server'
  | 'restarting'
  | 'no-connection'
  | 'reload'
  | 'render';

/** A failure as the shell reads it: its page, and the code and correlation id support needs. */
export interface ClassifiedError {
  readonly page: ErrorPage;
  /** The errorCode of the DomainError, such as core.internal (plan 05). */
  readonly code?: string;
  /** The id of the server's log line for the failed request. */
  readonly correlationId?: string;
}

/** The page of each GraphQL error code; a code not listed is a server error. */
const pageOfGraphqlCode: Readonly<Record<string, ErrorPage>> = {
  BAD_USER_INPUT: 'link',
  NOT_FOUND: 'not-found',
  FORBIDDEN: 'forbidden',
  UNAUTHENTICATED: 'session',
  CONFLICT: 'form',
  PRECONDITION: 'form',
  GRAPHQL_VALIDATION_FAILED: 'reload',
  UNAVAILABLE: 'restarting',
};

/** The errorCodes that ask for a reload whatever their GraphQL code. */
const reloadCodes = new Set(['core.client_outdated']);

/** The page of an HTTP status that is not 200. */
function pageOfStatus(status: number): ErrorPage {
  switch (status) {
    case 400:
      return 'link';
    case 401:
      return 'session';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 409:
    case 412:
      return 'form';
    case 502:
    case 503:
    case 504:
      return 'restarting';
    default:
      return 'server';
  }
}

/** The code and correlation id of a value, when they are strings. */
function supportOf(code: unknown, correlationId: unknown) {
  return {
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof correlationId === 'string' ? { correlationId } : {}),
  };
}

/** The errorCode and correlation id of a problem body, when the body is JSON that has them. */
function problemOf(bodyText: string) {
  try {
    const body: unknown = JSON.parse(bodyText);
    if (typeof body !== 'object' || body === null) return {};
    const { errorCode, correlationId } = body as Record<string, unknown>;
    return supportOf(errorCode, correlationId);
  } catch {
    return {};
  }
}

/** The messages of a fetch that got no response, in Chromium, Firefox and WebKit. */
const noResponse = /^(Failed to fetch|NetworkError when attempting to fetch resource|Load failed)/;

/** The message of a module import that failed, after a new release removed the old chunks. */
const failedImport = /dynamically imported module|Importing a module script failed/;

/**
 * Sorts a failure into the page or state that design shell-306 draws for it, in the order of its
 * table, What decides the page: a GraphQL error by its code (an errorCode that marks an outdated
 * client asks for a reload), an HTTP answer by its status, a fetch without a response or a timeout
 * as no connection, a failed module import as a reload, and anything else, which came from no
 * request, as a render error. The code and correlation id come from the first GraphQL error's
 * extensions or from the problem body.
 */
export function classifyError(error: unknown): ClassifiedError {
  if (CombinedGraphQLErrors.is(error)) {
    const [first] = error.errors;
    const { code, errorCode, correlationId } = first?.extensions ?? {};
    const support = supportOf(errorCode, correlationId);
    if (typeof errorCode === 'string' && reloadCodes.has(errorCode)) {
      return { page: 'reload', ...support };
    }
    const page = typeof code === 'string' ? pageOfGraphqlCode[code] : undefined;
    return { page: page ?? 'server', ...support };
  }
  if (ServerError.is(error)) {
    return { page: pageOfStatus(error.statusCode), ...problemOf(error.bodyText) };
  }
  if (error instanceof Error) {
    if (failedImport.test(error.message)) return { page: 'reload' };
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return { page: 'no-connection' };
    }
    if (error instanceof TypeError && noResponse.test(error.message)) {
      return { page: 'no-connection' };
    }
  }
  return { page: 'render' };
}
