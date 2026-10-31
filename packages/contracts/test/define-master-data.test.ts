// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineMasterData, isListQueryContract } from '@northmes/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const ID = '01920000-0000-7000-8000-000000000001';

/** A register of the fixture module tools at company or plant scope, with one own field. */
function gauges(own: Record<string, z.ZodType> = { size: z.int().min(1).optional() }) {
  return defineMasterData({
    module: 'tools',
    entity: 'Gauge',
    resource: 'gauges',
    label: 'gauge',
    permission: 'tools.gauge',
    scopes: ['company', 'plant'],
    fields: z.object(own),
    output: { size: z.int().nullable() },
  });
}

/** The gauge register, built once, since its output schema registers the component ToolsGauge. */
const gauge = gauges();

/** A register of the fixture module tools at plant scope only. */
const fixtures = defineMasterData({
  module: 'tools',
  entity: 'Fixture',
  resource: 'fixtures',
  label: 'fixture',
  permission: 'tools.fixture',
  scopes: ['plant'],
  fields: z.object({}),
  output: {},
});

describe('defineMasterData', () => {
  it("#66 names a register's commands and queries after its module and entity, each with the permission of its action", () => {
    const { create, update, archive, restore, find, get } = gauge;

    expect(
      [create, update, archive, restore, find, get].map(({ name, permission }) => [
        name,
        permission,
      ]),
    ).toEqual([
      ['tools.createGauge', 'tools.gauge:create'],
      ['tools.updateGauge', 'tools.gauge:update'],
      ['tools.archiveGauge', 'tools.gauge:archive'],
      ['tools.restoreGauge', 'tools.gauge:archive'],
      ['tools.findGauges', 'tools.gauge:read'],
      ['tools.getGauge', 'tools.gauge:read'],
    ]);
  });

  it('#66 a create takes the trimmed code and name, the own fields, the client id and the scope to write at', () => {
    const { create } = gauge;

    const input = create.input.parse({
      id: ID,
      code: ' G-1 ',
      name: ' Gauge ',
      size: 3,
      scope: 'plant',
    });

    expect(input).toEqual({ id: ID, code: 'G-1', name: 'Gauge', size: 3, scope: 'plant' });
    expect(create.input.safeParse({ id: ID, code: 'G-1', name: 'Gauge' }).success).toBe(false);
  });

  it('#66 refuses an empty code and a code over 32 characters with the message the form shows', () => {
    const { fields } = gauge;

    const empty = fields.safeParse({ code: ' ', name: 'Gauge' });
    const long = fields.safeParse({ code: 'G'.repeat(33), name: 'Gauge' });

    expect(empty.error?.issues[0]?.message).toBe('Enter a code.');
    expect(long.error?.issues[0]?.message).toBe('Code can be 1 to 32 characters. It has 33.');
  });

  it('#66 a plant-only register has no scope input, and its operations run at a plant', () => {
    const shape = Object.keys(fixtures.create.input.shape).sort();

    expect(shape).toEqual(['code', 'id', 'name', 'translations']);
    expect(fixtures.operations.scope).toBe('plant');
    expect(gauge.operations.scope).toBe('companyOrPlant');
  });

  it('#66 an update names the row by id and version, and takes no scope, since a row stays where it was made', () => {
    const { update } = gauge;

    expect(Object.keys(update.input.shape).sort()).toEqual([
      'code',
      'expectedVersion',
      'id',
      'name',
      'size',
      'translations',
    ]);
  });

  it("#66 the output answers the kit's fields, the scope level and the own fields, as the component <Module><Entity>", () => {
    const { node } = gauge;
    const answer = node.parse({
      id: ID,
      code: 'G-1',
      name: 'Gauge',
      translations: [],
      version: 1,
      archivedAt: null,
      updatedAt: '2026-10-31T12:00:00Z',
      scope: 'company',
      size: null,
    });

    expect(answer).toMatchObject({ code: 'G-1', scope: 'company', size: null });
    expect(z.globalRegistry.get(node)?.id).toBe('ToolsGauge');
  });

  it('#66 lists by code with search over code and name, archived rows hidden, as find answers it', () => {
    const { list, find } = gauge;

    expect(list).toMatchObject({
      name: 'Gauge',
      defaultOrderBy: ['code'],
      search: ['code', 'name'],
      archivable: true,
    });
    expect(Object.keys(list.sortFields).sort()).toEqual(['code', 'name', 'updatedAt']);
    expect(isListQueryContract(find)).toBe(true);
  });

  it('#66 declares the REST family under the resource, and no agent tool', () => {
    const { operations } = gauge;

    expect(
      Object.fromEntries(
        Object.entries(operations.operations).map(([key, { rest, tool }]) => [
          key,
          rest && `${rest.method} ${rest.path} ${rest.status} ${tool}`,
        ]),
      ),
    ).toEqual({
      find: 'GET gauges 200 false',
      get: 'GET gauges/{id} 200 false',
      create: 'POST commands/create-gauge 201 false',
      update: 'POST commands/update-gauge 200 false',
      archive: 'POST commands/archive-gauge 200 false',
      restore: 'POST commands/restore-gauge 200 false',
    });
  });

  it.each(['code', 'name', 'scope', 'id', 'companyId'])(
    "#66 throws on an own field named %s, which is the kit's",
    (field) => {
      expect(() => gauges({ [field]: z.string() })).toThrow(
        `Register tools.Gauge: field ${field} is the kit's own`,
      );
    },
  );
});
