// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import 'reflect-metadata';
import type { ModuleRef } from '@nestjs/core';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { OpenApiController } from '../../src/http/public-api/openapi.controller.ts';
import { PublicApiCredentials } from '../../src/http/public-api/public-api-credentials.ts';

/** A credential guard whose store is down. */
class FailingCredentials extends PublicApiCredentials {
  async resolve(): Promise<never> {
    throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
  }
}

/** The parts of an Express response the controller writes, recorded. */
function recordingResponse() {
  const sent: { status?: number; type?: string; body?: string } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return response;
    },
    type(value: string) {
      sent.type = value;
      return response;
    },
    end(body: string) {
      sent.body = body;
      return response;
    },
  };
  return { sent, response: response as unknown as Response };
}

describe('OpenApiController', () => {
  it('ADR0073-W4 a credential guard that fails answers 500 core.internal as a problem, not 401, and names no internals', async () => {
    const moduleRef = {
      get() {
        throw new Error('no PrincipalResolver');
      },
    } as unknown as ModuleRef;
    const controller = new OpenApiController([], new FailingCredentials(), moduleRef);
    const { sent, response } = recordingResponse();

    await controller.document(
      { headers: { authorization: 'Bearer nms_int_x' } } as unknown as Request,
      response,
    );

    expect(sent.status).toBe(500);
    expect(sent.type).toMatch(/^application\/problem\+json/);
    const body = JSON.parse(sent.body ?? '{}') as Record<string, unknown>;
    expect(body).toMatchObject({ status: 500, code: 'core.internal' });
    expect(body.correlationId).toEqual(expect.any(String));
    expect(sent.body).not.toContain('ECONNREFUSED');
  });
});
