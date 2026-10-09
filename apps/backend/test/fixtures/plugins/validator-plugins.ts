// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixture plugins with command validators on the in-repo modules' commands. The in-repo modules
// carry no manifest, so the host learns which commands accept validators from their contracts.
import { Module } from '@nestjs/common';
import { createArticle } from '@northmes/core-contracts';
import { releaseProductionOrder } from '@northmes/planning-contracts';
import { defineModule } from '@northmes/sdk';
import { CommandValidator } from '@northmes/sdk/commands';
import { z } from 'zod';

export const ReleaseCap = CommandValidator(releaseProductionOrder, {
  name: 'release-cap',
  async check() {
    return { verdict: 'pass' };
  },
});

@Module({ providers: [ReleaseCap] })
export class ReleaseCapModule {}

/** Validates planning.releaseProductionOrder, whose contract is validatable. */
export const releaseCap = defineModule({
  id: 'release-cap',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['planning'],
  server: async () => ({ default: ReleaseCapModule }),
});

// core.createArticle's contract is not validatable. A plugin's copy that says otherwise is the
// plugin's mistake, which boot must refuse.
const createArticleCopy = {
  ...createArticle,
  validatable: true as const,
  payload: z.object({ code: z.string() }),
};

export const ArticleGate = CommandValidator(createArticleCopy, {
  name: 'article-gate',
  async check() {
    return { verdict: 'pass' };
  },
});

@Module({ providers: [ArticleGate] })
export class ArticleGateModule {}

/** Validates core.createArticle, whose contract is not validatable. */
export const articleGate = defineModule({
  id: 'article-gate',
  version: '0.0.0',
  northmes: '>=0.0.0-0 <0.1.0-0',
  dependsOn: ['core'],
  server: async () => ({ default: ArticleGateModule }),
});
