// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { DomainErrorFilter } from '@northmes/sdk/errors';
import { given, gqlClient, useTestDatabase } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import type { InRepoModule } from '../../src/modules.ts';
import { dispatch } from '../fixtures/commands/dispatch.ts';
import { dispatcher } from '../fixtures/commands/dispatcher.ts';
import { BROKEN_CHECK_ERROR, brokenRules } from '../fixtures/commands/failing-validators.ts';
import { auditRules, releaseLimits } from '../fixtures/commands/validators.ts';
import { alpha } from '../fixtures/graphql/alpha.ts';
import { faulty, UNKNOWN_ERROR_TEXT } from '../fixtures/graphql/faulty.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';

const JOB_ID = '01920000-0000-7000-8000-0000000000a1';

describe('the exception filter', () => {
  // The command bus opens a transaction for every command, so the server needs a database.
  const db = useTestDatabase();
  const env = useServerEnv({ database: db });
  let app: INestApplication | undefined;

  // ConfigModule writes the validated environment into process.env, as it does in the server. The
  // stubs remove these keys for each test, and unstubAllEnvs takes them out again afterwards.
  beforeEach(() => {
    for (const key of serverEnvKeys) vi.stubEnv(key, undefined);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.unstubAllEnvs();
  });

  /** Boots the server with the fixture modules in place of the in-repo ones. */
  async function bootFixtures(...modules: readonly InRepoModule[]): Promise<INestApplication> {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    app = await boot({ env, modules, exit: vi.fn(), log });
    if (!app) throw new Error(`boot exited: ${log.error.mock.calls.join('\n')}`);
    return app;
  }

  it('E02-S04 the exception filter is registered once as APP_FILTER', async () => {
    const booted = await bootFixtures(alpha);

    // Where an instance of the filter is provided: the module and the provider's token.
    const registrations = [...booted.get(ModulesContainer).values()].flatMap((module) =>
      [...module.providers.values()]
        .filter(({ instance }) => instance instanceof DomainErrorFilter)
        .map(({ token }) => ({ module: module.metatype.name, token: String(token) })),
    );

    // Nest gives each APP_FILTER provider a token of its own that starts with APP_FILTER.
    expect(registrations).toEqual([
      { module: 'AppModule', token: expect.stringMatching(/^APP_FILTER\b/) },
    ]);
  });

  // Every path outside the server segments is an SPA path that the shell answers (ADR 0064), so
  // the missing route is under /api/.
  it("E02-S04 a request to a server path that does not exist still gets Nest's 404", async () => {
    const booted = await bootFixtures(alpha);

    const response = await fetch(new URL('/api/v1/no-such-route', await booted.getUrl()), {
      signal: AbortSignal.timeout(2000),
    });

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 404,
      body: { statusCode: 404, message: 'Not Found' },
    });
  });

  it('E02-S04 a veto reaches the client with code, errorCode core.command_rejected and details.rejectedBy', async () => {
    const booted = await bootFixtures(dispatch, dispatcher, releaseLimits, auditRules);
    const client = gqlClient(await booted.getUrl(), {
      headers: { 'x-northmes-plant': given.plant() },
    });

    const answer = await client.send(
      `mutation ($input: DispatchReleaseJobInput!) {
        dispatchReleaseJob(input: $input) { id status }
      }`,
      { input: { id: JOB_ID, expectedVersion: 1 } },
    );

    // Both modules veto. release-limits boots first, so its veto is the one the client gets.
    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [
        {
          message: 'Quantity 1500 is above the release limit of 1000',
          path: ['dispatchReleaseJob'],
          extensions: {
            code: 'PRECONDITION',
            errorCode: 'core.command_rejected',
            details: { rejectedBy: 'release-limits' },
          },
        },
      ],
    });
  });

  it('E02-S04 a throwing validator reaches the client as Unexpected error.', async () => {
    const booted = await bootFixtures(dispatch, dispatcher, brokenRules);
    const client = gqlClient(await booted.getUrl(), {
      headers: { 'x-northmes-plant': given.plant() },
    });

    const answer = await client.send(
      `mutation ($input: DispatchReleaseJobInput!) {
        dispatchReleaseJob(input: $input) { id status }
      }`,
      { input: { id: JOB_ID, expectedVersion: 1 } },
    );

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [{ message: 'Unexpected error.', path: ['dispatchReleaseJob'] }],
    });
    expect(JSON.stringify(answer)).not.toContain(BROKEN_CHECK_ERROR);
  });

  it.each([
    [400, 'BAD_USER_INPUT'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [412, 'PRECONDITION'],
    [503, 'UNAVAILABLE'],
  ])(
    'a DomainError with status %i reaches the client as %s with its errorCode, message and details',
    async (status, code) => {
      const booted = await bootFixtures(faulty);
      const client = gqlClient(await booted.getUrl());

      const answer = await client.send(
        'query ($status: Int!) { faultyDomainError(status: $status) }',
        {
          status,
        },
      );

      expect(answer).toMatchObject({
        status: 200,
        data: null,
        errors: [
          {
            message: `Refused with status ${status}`,
            path: ['faultyDomainError'],
            extensions: { code, errorCode: 'faulty.refused', details: { status } },
          },
        ],
      });
    },
  );

  it.each([
    ['faultyNotFound', 'Thing t-9 was not found', 'NOT_FOUND'],
    ['faultyForbidden', 'Forbidden', 'FORBIDDEN'],
  ])(
    "Nest's exception thrown in %s reaches the client as %s, %s and no errorCode",
    async (field, message, code) => {
      const booted = await bootFixtures(faulty);
      const client = gqlClient(await booted.getUrl());

      const answer = await client.send(`{ ${field} }`);

      expect(answer).toMatchObject({
        status: 200,
        data: null,
        errors: [{ message, path: [field], extensions: { code } }],
      });
      expect(answer.errors?.[0]?.extensions).not.toHaveProperty('errorCode');
    },
  );

  it("a DomainError's fieldErrors reach the client in extensions.fieldErrors, in the shape of a Zod failure's", async () => {
    const booted = await bootFixtures(faulty);
    const client = gqlClient(await booted.getUrl());

    const answer = await client.send('{ faultyFieldErrors }');

    expect(answer).toMatchObject({
      errors: [
        {
          message: 'The code is already taken.',
          extensions: {
            code: 'CONFLICT',
            errorCode: 'faulty.code_taken',
            fieldErrors: [
              { path: ['code'], message: 'The code is already taken.', code: 'faulty.code_taken' },
            ],
          },
        },
      ],
    });
  });

  it.each([
    ['faultyUnknown', 'a plain Error'],
    ['faultyServerError', 'an HttpException of a status without a GraphQL code'],
  ])('%s, which throws %s, reaches the client masked as Unexpected error.', async (field) => {
    const booted = await bootFixtures(faulty);
    const client = gqlClient(await booted.getUrl());

    const answer = await client.send(`{ ${field} }`);

    expect(answer).toMatchObject({
      status: 200,
      data: null,
      errors: [{ message: 'Unexpected error.', path: [field] }],
    });
    expect(JSON.stringify(answer)).not.toContain(UNKNOWN_ERROR_TEXT);
  });
});
