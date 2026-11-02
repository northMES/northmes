// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { MockLink } from '@apollo/client/testing';
import { GraphQLError } from 'graphql';
import { CoreEquipment } from '../../../src/modules/core/equipment.graphql.ts';
import { CoreEquipmentGroup } from '../../../src/modules/core/equipment-group.graphql.ts';
import { CoreEquipmentGroups } from '../../../src/modules/core/equipment-groups.graphql.ts';
import { CoreEquipmentList } from '../../../src/modules/core/equipment-list.graphql.ts';
import { lastChanged } from './core-app.tsx';

/** A fictional id made from a code and a kind digit, so each row's id is stable across tests. */
function idOf(code: string, kind: string): string {
  const digits = [...code].map((char) => char.charCodeAt(0).toString(16)).join('');
  return `019a0000-0000-700${kind}-8000-${digits.padStart(12, '0').slice(-12)}`;
}

export type Group = ReturnType<typeof group>;

/**
 * A fictional equipment group with an id made from its code, at the plant unless scope says the
 * company, active unless archivedAt says otherwise. Its codes are those of the fixture G1.
 */
export function group(
  code: string,
  name: string,
  {
    scope = 'plant',
    color = 'palette-1',
    colorFrom = 'set',
    version = 1,
    archivedAt = null,
  }: {
    scope?: 'company' | 'plant';
    color?: string;
    colorFrom?: 'erp' | 'set' | 'palette';
    version?: number;
    archivedAt?: string | null;
  } = {},
) {
  return {
    __typename: 'EquipmentGroup' as const,
    id: idOf(code, '0'),
    code,
    name,
    color,
    colorFrom,
    scope,
    version,
    archivedAt,
    updatedAt: lastChanged,
  };
}

export const asm = group('ASM', 'Assembly', { color: 'palette-8' });
export const heat = group('HEAT', 'Heat treatment', { scope: 'company', colorFrom: 'palette' });
export const mach = group('MACH', 'Machining', { color: 'palette-3', colorFrom: 'erp' });

export type MachineNode = ReturnType<typeof machine>;

/**
 * A fictional machine of the plant with an id made from its code, in the group `of`, plannable
 * unless isPlannable says otherwise, with the group's color unless color names its own, active
 * unless archivedAt says otherwise.
 */
export function machine(
  code: string,
  name: string,
  of: Group,
  {
    isPlannable = true,
    color = null,
    version = 1,
    archivedAt = null,
  }: {
    isPlannable?: boolean;
    color?: string | null;
    version?: number;
    archivedAt?: string | null;
  } = {},
) {
  return {
    __typename: 'Equipment' as const,
    id: idOf(code, '1'),
    code,
    name,
    groupId: of.id,
    group: {
      __typename: 'EquipmentGroup' as const,
      id: of.id,
      code: of.code,
      name: of.name,
      color: of.color,
      scope: of.scope,
      archivedAt: of.archivedAt,
    },
    isPlannable,
    isOee: false,
    color,
    version,
    archivedAt,
    updatedAt: lastChanged,
  };
}

/** The machines of the fixture G1 at Plant A, with G1's codes, names, groups and flags. */
export const asm1 = machine('ASM1', 'Assembly bench', asm, { isPlannable: false });
export const cnc1 = machine('CNC1', 'CNC 1', mach);
export const cnc2 = machine('CNC2', 'CNC 2', mach);
export const lathe1 = machine('LATHE1', 'Lathe 1', mach, { isPlannable: false });
export const lathe2 = machine('LATHE2', 'Lathe 2', mach, { isPlannable: false });
export const mill1 = machine('MILL1', 'Mill 1', mach);
export const g1Machines = [asm1, cnc1, cnc2, lathe1, lathe2, mill1];

/** A connection page of `nodes`, with the cursor of the next page when there is one. */
function connection(typename: string, nodes: readonly { __typename: string }[], next?: string) {
  return {
    __typename: `${typename}Connection`,
    totalCount: nodes.length,
    pageInfo: { __typename: 'PageInfo', hasNextPage: next !== undefined, endCursor: next ?? null },
    edges: nodes.map((node) => ({ __typename: `${typename}Edge`, node })),
  };
}

/**
 * coreEquipmentGroups, with or without the archived ones, answered with these groups: the first
 * page, or with `after` and `next` the page after that cursor and the cursor of the page after it.
 */
export function groupsQuery(
  groups: readonly Group[],
  includeArchived = false,
  { after, next }: { after?: string; next?: string } = {},
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreEquipmentGroups,
      variables: after === undefined ? { includeArchived } : { includeArchived, after },
    },
    result: { data: { coreEquipmentGroups: connection('EquipmentGroup', groups, next) } },
  };
}

/** coreEquipmentGroup for the group's id, answered with it, or null for an unknown id. */
export function groupQuery(found: Group, answer: Group | null = found): MockLink.MockedResponse {
  return {
    request: { query: CoreEquipmentGroup, variables: { id: found.id } },
    result: { data: { coreEquipmentGroup: answer } },
  };
}

/**
 * coreEquipmentList, with or without the archived machines, answered with these machines: the
 * first page, or with `after` and `next` the page after that cursor and the cursor after it.
 */
export function machinesQuery(
  machines: readonly MachineNode[] = g1Machines,
  includeArchived = false,
  { after, next }: { after?: string; next?: string } = {},
): MockLink.MockedResponse {
  return {
    request: {
      query: CoreEquipmentList,
      variables: after === undefined ? { includeArchived } : { includeArchived, after },
    },
    result: { data: { coreEquipmentList: connection('Equipment', machines, next) } },
  };
}

/** coreEquipment for the machine's id, answered with it, or null for an unknown id. */
export function machineQuery(
  found: MachineNode,
  answer: MachineNode | null = found,
): MockLink.MockedResponse {
  return {
    request: { query: CoreEquipment, variables: { id: found.id } },
    result: { data: { coreEquipment: answer } },
  };
}

/** A query of `query` refused with FORBIDDEN, as the API answers a user without the permission. */
export function forbidden(request: MockLink.MockedResponse['request']): MockLink.MockedResponse {
  return {
    request,
    result: {
      errors: [
        new GraphQLError('Forbidden', {
          extensions: { code: 'FORBIDDEN', errorCode: 'core.forbidden' },
        }),
      ],
    },
  };
}
