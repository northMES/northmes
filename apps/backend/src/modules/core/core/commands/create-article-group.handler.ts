// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { NotFoundException } from '@nestjs/common';
import { createArticleGroup } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import { noteCreated } from '@northmes/sdk/operations';
import type { z } from 'zod';
import { type ArticleGroupRecord, selectArticleGroups } from '../article-group-record.ts';
import { requestCompany } from './company-scope.ts';
import type { CoreContext } from './context.ts';

type CreateArticleGroupInput = z.output<typeof createArticleGroup.input>;

/**
 * The handler of core.createArticleGroup (ADR 0012). Its scope hook returns the company, where the
 * bus checks core.articleGroup:create. It writes the group at the company's node under the
 * client's id, notes that it created a row, and returns it with version 1, or returns the group a
 * first run with that id created.
 */
export const createArticleGroupHandler = {
  scope: requestCompany,

  async handle(input: CreateArticleGroupInput, context: CoreContext): Promise<ArticleGroupRecord> {
    const { tx } = context;
    const companyId = await requestCompany(input, context);
    // The scope hook found no company, so the bus refused the command before the handler runs.
    if (!companyId) throw new NotFoundException(`Article group ${input.id} was not found`);
    const created = await tx
      .insertInto('core.article_group')
      .values({
        id: input.id,
        scope_id: companyId,
        company_id: companyId,
        code: input.code,
        name: input.name,
        translations: JSON.stringify(input.translations ?? []),
      })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .returning('id')
      .executeTakeFirst();
    if (created) noteCreated();
    const group = await selectArticleGroups(tx).where('id', '=', input.id).executeTakeFirst();
    // The id is taken in a company the principal cannot read.
    if (!group) throw new NotFoundException(`Article group ${input.id} was not found`);
    return group;
  },
};

/** core.createArticleGroup as the bus runs it, which ArticleGroupService.create sends. */
export const CreateArticleGroupCommand = registerCommand(
  createArticleGroup,
  createArticleGroupHandler,
);
