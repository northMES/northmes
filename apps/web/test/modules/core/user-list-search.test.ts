// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import {
  placeFilterOf,
  userListSearch,
  userListVariables,
  usersAtPlace,
} from '../../../src/modules/core/user-list-search.ts';

const company = { id: 'acme' };
const plants = [
  { id: 'a', slug: 'plant-a' },
  { id: 'b', slug: 'plant-b' },
];
const atPlant = { inCompany: false, plant: 'plant-a', company, plants };
const inCompany = { ...atPlant, inCompany: true };

describe('the Place filter of the users list', () => {
  it('ADR0092 defaults to the plant at a plant and to anywhere in company settings', () => {
    expect(placeFilterOf({}, atPlant)).toEqual({ place: 'plant', placeId: 'a', pending: false });
    expect(placeFilterOf({}, inCompany)).toEqual({
      place: 'anywhere',
      placeId: undefined,
      pending: false,
    });
  });

  it("ADR0092 reads the company, the URL's plant, and in company settings another plant by its slug", () => {
    expect(placeFilterOf({ place: 'company' }, atPlant).placeId).toBe('acme');
    expect(placeFilterOf({ place: 'plant' }, inCompany).placeId).toBe('a');
    expect(placeFilterOf({ place: 'plant-b' }, inCompany)).toEqual({
      place: 'plant-b',
      placeId: 'b',
      pending: false,
    });
  });

  it('ADR0092 falls back to the default for another plant at a plant and for a slug that names no plant', () => {
    expect(placeFilterOf({ place: 'plant-b' }, atPlant).place).toBe('plant');
    expect(placeFilterOf({ place: 'plant-z' }, inCompany).place).toBe('anywhere');
  });

  it('ADR0092 waits for the places before it reads a place by its id', () => {
    expect(placeFilterOf({}, { ...atPlant, company: undefined, plants: [] }).pending).toBe(true);
    expect(placeFilterOf({ place: 'plant-b' }, { ...inCompany, plants: [] }).pending).toBe(true);
  });

  it("ADR0092 keeps the page's default place out of the URL and the placeId in coreUsers' variables", () => {
    const view = userListSearch({ place: 'company', q: 'sara' });
    expect(usersAtPlace(view, 'plant', 'plant')).toEqual({ q: 'sara' });
    expect(usersAtPlace(view, 'anywhere', 'plant')).toEqual({ q: 'sara', place: 'anywhere' });
    expect(userListSearch({ place: 'Not a slug!' })).toEqual({});
    expect(userListVariables(view, 'acme')).toEqual({ first: 25, search: 'sara', placeId: 'acme' });
  });
});
