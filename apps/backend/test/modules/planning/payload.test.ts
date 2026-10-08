// SPDX-License-Identifier: AGPL-3.0-or-later
import { releaseProductionOrder } from '@northmes/planning-contracts';
import { describe, expect, it } from 'vitest';
import { releasePayload } from '../../../src/modules/planning/commands/release-payload.ts';

const ORDER_ID = '01920000-0000-7000-8000-0000000000c1';
const PLANT_ID = '01920000-0000-7000-8000-0000000000c2';
const ARTICLE_ID = '01920000-0000-7000-8000-0000000000c3';

describe('the validator payload of planning.releaseProductionOrder', () => {
  it('E02-S04 the payload planning builds for an order parses with its MIT schema', () => {
    // The order as planning reads it: quantity is the numeric(18,6) column as decimal text.
    const payload = releasePayload({
      id: ORDER_ID,
      scope_id: PLANT_ID,
      version: 1,
      number: '6501',
      article_id: ARTICLE_ID,
      quantity: '1250.500000',
      status: 'planned',
    });

    expect(releaseProductionOrder.payload.parse(payload)).toEqual({
      productionOrderId: ORDER_ID,
      plantId: PLANT_ID,
      articleId: ARTICLE_ID,
      quantity: 1250.5,
    });
  });
});
