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

  it('#768 planningLinks builds the hrefs of New production order, from a customer order line, and New customer order', () => {
    expect(planningLinks.orders.new({ plant: 'plant-a' }).href).toBe(
      '/plant-a/planning/orders/new',
    );
    expect(planningLinks.orders.new({ plant: 'plant-a' }, { line: '40211-2' }).href).toBe(
      '/plant-a/planning/orders/new?line=40211-2',
    );
    expect(planningLinks.customerOrders.new({ plant: 'plant-a' }).href).toBe(
      '/plant-a/planning/customer-orders/new',
    );
  });

  it('#729 planningLinks.stock builds the hrefs of the Stock page and the stock of one article', () => {
    expect(planningLinks.stock({ plant: 'plant-a' }).href).toBe('/plant-a/planning/stock');
    expect(planningLinks.stock.article({ plant: 'plant-a', articleId: '30-2011' }).href).toBe(
      '/plant-a/planning/stock/30-2011',
    );
  });

  it("#876 planningLinks' settings section builds the hrefs of a plant's planning rules and board fields under the plant's settings", () => {
    expect(planningLinks.settings.rules({ plant: 'plant-a' }).href).toBe(
      '/plant-a/settings/planning',
    );
    expect(planningLinks.settings.boardFields({ plant: 'plant-a' }).href).toBe(
      '/plant-a/settings/planning/board-fields',
    );
  });

  it("planningLinks.release builds the href of a plant's list of orders to release", () => {
    expect(planningLinks.release({ plant: 'plant-a' }).href).toBe('/plant-a/planning/release');
  });
});
