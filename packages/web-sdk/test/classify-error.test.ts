// SPDX-License-Identifier: MIT
import { CombinedGraphQLErrors, ServerError } from '@apollo/client';
import { describe, expect, it } from 'vitest';
import { classifyError } from '../src/index.ts';

/** A GraphQL answer with one error of this code, errorCode and correlation id. */
function graphqlError(code: string, errorCode?: string, correlationId?: string) {
  return new CombinedGraphQLErrors({
    data: null,
    errors: [
      {
        message: 'Refused',
        extensions: {
          code,
          ...(errorCode === undefined ? {} : { errorCode }),
          ...(correlationId === undefined ? {} : { correlationId }),
        },
      },
    ],
  });
}

/** An HTTP answer with this status and body. */
function httpError(status: number, body = '') {
  return new ServerError('Refused', { response: new Response(body, { status }), bodyText: body });
}

describe('classifyError', () => {
  it('E04-S07 a server error is the server error page with its code and correlation id (SE1)', () => {
    expect(
      classifyError(graphqlError('INTERNAL_SERVER_ERROR', 'core.internal', '0199c4e2-7b1d')),
    ).toEqual({ page: 'server', code: 'core.internal', correlationId: '0199c4e2-7b1d' });
    expect(classifyError(httpError(500))).toEqual({ page: 'server' });
    expect(classifyError(httpError(418))).toEqual({ page: 'server' });
  });

  it('E04-S07 an HTTP answer carries its code and correlation id in its problem body', () => {
    const body = JSON.stringify({ errorCode: 'core.internal', correlationId: '0199c4e2-7b1d' });
    expect(classifyError(httpError(500, body))).toEqual({
      page: 'server',
      code: 'core.internal',
      correlationId: '0199c4e2-7b1d',
    });
  });

  it('E04-S07 an invalid request is a link the page cannot use, a missing record is not found, and a refused read is forbidden', () => {
    expect(classifyError(graphqlError('BAD_USER_INPUT', 'core.list.invalid_cursor'))).toEqual({
      page: 'link',
      code: 'core.list.invalid_cursor',
    });
    expect(classifyError(httpError(400)).page).toBe('link');
    expect(classifyError(graphqlError('NOT_FOUND')).page).toBe('not-found');
    expect(classifyError(httpError(404)).page).toBe('not-found');
    expect(classifyError(graphqlError('FORBIDDEN', 'core.plant_forbidden')).page).toBe('forbidden');
    expect(classifyError(httpError(403)).page).toBe('forbidden');
  });

  it('E04-S07 a 401 or UNAUTHENTICATED ends the session (SO1)', () => {
    expect(classifyError(graphqlError('UNAUTHENTICATED')).page).toBe('session');
    expect(classifyError(httpError(401)).page).toBe('session');
  });

  it('E04-S07 a conflict or a failed precondition belongs to the form that sent the command, never to a page', () => {
    expect(classifyError(graphqlError('CONFLICT', 'core.version_conflict')).page).toBe('form');
    expect(classifyError(graphqlError('PRECONDITION', 'core.last_admin')).page).toBe('form');
    expect(classifyError(httpError(409)).page).toBe('form');
    expect(classifyError(httpError(412)).page).toBe('form');
  });

  it('E04-S07 502, 503 and 504 mean NorthMES is restarting, and no answer means no connection', () => {
    for (const status of [502, 503, 504]) {
      expect(classifyError(httpError(status)).page).toBe('restarting');
    }
    expect(classifyError(new TypeError('Failed to fetch')).page).toBe('no-connection');
    expect(
      classifyError(new TypeError('NetworkError when attempting to fetch resource.')).page,
    ).toBe('no-connection');
    expect(classifyError(new DOMException('The operation timed out.', 'TimeoutError')).page).toBe(
      'no-connection',
    );
  });

  it('E04-S07 an outdated client or a failed module import asks for a reload', () => {
    expect(classifyError(graphqlError('GRAPHQL_VALIDATION_FAILED')).page).toBe('reload');
    expect(classifyError(graphqlError('BAD_REQUEST', 'core.client_outdated')).page).toBe('reload');
    expect(
      classifyError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))
        .page,
    ).toBe('reload');
  });

  it('E04-S07 an error that came from no request is a render error (D2 ST6)', () => {
    expect(classifyError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toEqual(
      { page: 'render' },
    );
    expect(classifyError('thrown text')).toEqual({ page: 'render' });
  });
});
