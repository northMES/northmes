// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import type { BootError } from '../../src/boot/boot-error.ts';
import { discoverConsumers } from '../../src/events/discover-consumers.ts';
import { misnamed, TallyCreated, TallyUpdated, tally } from '../fixtures/events/consumers.ts';

describe('discoverConsumers', () => {
  it("E05-S09 finds each module's consumers, also through a Nest module it imports, and names each one's queue <module id>.<name>", () => {
    expect(discoverConsumers([tally])).toEqual([
      {
        module: 'article-tally',
        queue: 'article-tally.tally-updated',
        consumer: TallyUpdated.consumer,
      },
      {
        module: 'article-tally',
        queue: 'article-tally.tally-created',
        consumer: TallyCreated.consumer,
      },
    ]);
  });

  it('E05-S09 refuses a consumer whose name is not kebab-case and two consumers of one module with one name', () => {
    const problems = (() => {
      try {
        discoverConsumers([misnamed]);
        return [];
      } catch (error) {
        return (error as BootError).problems;
      }
    })();

    expect(problems).toEqual([
      'Module misnamed has two consumers named tally-created; give each consumer a name of its own',
      'Consumer "Tally Created" of module misnamed must have a kebab-case name, such as article-log',
    ]);
  });
});
