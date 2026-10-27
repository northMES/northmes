// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { planningLinks } from '@northmes/planning-contracts';
import { describe, expect, it } from 'vitest';

describe('planningLinks', () => {
  it("E02-S05 planningLinks.board builds the href of a plant's planning board", () => {
    expect(planningLinks.board({ plant: 'plant-a' }).href).toBe('/plant-a/planning/board');
  });

  it("#728 planningLinks.customerOrders.customerOrder builds the href of a customer order's page", () => {
    expect(
      planningLinks.customerOrders.customerOrder({ plant: 'plant-a', customerOrderId: '40211' })
        .href,
    ).toBe('/plant-a/planning/customer-orders/40211');
  });

  it("planningLinks.release builds the href of a plant's list of orders to release", () => {
    expect(planningLinks.release({ plant: 'plant-a' }).href).toBe('/plant-a/planning/release');
  });
});
