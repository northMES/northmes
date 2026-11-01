// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { z } from 'zod';
import { defineCommandContract, timestamp, version } from './define-command-contract.ts';
import { defineListDeclaration, defineListQueryContract } from './define-list-query-contract.ts';
import { defineOperations } from './define-operations.ts';
import { defineQueryContract } from './define-query-contract.ts';
import { translations } from './localized-text.ts';
import { outsideText } from './outside-text.ts';

/** Any Zod object schema, whatever its unknown-key mode. */
type ObjectSchema = z.ZodObject<z.core.$ZodShape, z.core.$ZodObjectConfig>;

/** Where a register's row sits (ADR 0007): at the company's node, or at one plant's. */
export type MasterDataScope = 'company' | 'plant';

/** The scopes a register allows: company and plant, or plant only. */
export type MasterDataScopes = readonly ['company', 'plant'] | readonly ['plant'];

/** The message of a text over its limit: the field, the allowed range and the length typed. */
function tooLong(label: string, max: number) {
  return (issue: { readonly input?: unknown }) =>
    `${label} can be 1 to ${max} characters. It has ${String(issue.input).length}.`;
}

/**
 * The fields every register shares, which create and update take and a form validates: the code,
 * unique per scope without case (ADR 0009), the name, both trimmed and required, and the
 * translations of the name (ADR 0053), which an update that leaves them out keeps.
 */
const kitFields = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter a code.')
    .max(32, { error: tooLong('Code', 32) })
    .describe('The code, unique among the rows the scope sees, at most 32 characters.'),
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name.')
    .max(200, { error: tooLong('Name', 200) })
    .describe('The name, at most 200 characters.'),
  translations: translations
    .describe('The translations of the name. An update that leaves them out keeps them.')
    .optional(),
});

/** The scope a create writes at, and that a row of a company and plant register answers. */
export const scopeLevel = z
  .enum(['company', 'plant'])
  .describe(
    "Where the row sits: at the company, which every plant of it sees, or at the request's plant.",
  );

/** The company of a create sent from company settings, which names no plant (ADR 0066). */
const settingsCompanyId = z
  .uuid()
  .describe(
    "The company of a command sent from company settings, which names no plant. At a plant it may be left out, or must be the plant's company.",
  )
  .optional();

/** The input and output names that the kit gives a register, which its own fields cannot take. */
const kitNames = [
  'id',
  'expectedVersion',
  'code',
  'name',
  'translations',
  'scope',
  'companyId',
  'version',
  'archivedAt',
  'updatedAt',
];

export interface MasterDataOptions<
  Own extends ObjectSchema,
  Output extends z.core.$ZodShape,
  Scopes extends MasterDataScopes,
> {
  /** The module's GraphQL name, such as core: the prefix of every contract name. */
  readonly module: string;
  /** The entity in PascalCase, such as EquipmentGroup: coreCreateEquipmentGroup, and so on. */
  readonly entity: string;
  /** The REST resource, such as equipment-groups (ADR 0073). */
  readonly resource: string;
  /** The entity's plural in PascalCase, Entity with an s unless given: coreEquipmentGroups. */
  readonly plural?: string;
  /** The entity in words for descriptions, such as equipment group. */
  readonly label: string;
  /** The label's plural, the label with an s unless given. */
  readonly pluralLabel?: string;
  /** The label's indefinite article, a unless given. */
  readonly article?: 'a' | 'an';
  /** The permission resource, such as core.equipmentGroup, with the actions read, create, update and archive. */
  readonly permission: string;
  readonly scopes: Scopes;
  /** The register's own fields, which create and update take next to the kit's. */
  readonly fields: Own;
  /** The register's own output fields, which every surface answers next to the kit's. */
  readonly output: Output;
}

/** The fields create and update take: the kit's and the register's own. */
type FieldsOf<Own extends ObjectSchema> = z.ZodObject<typeof kitFields.shape & Own['shape']>;

/** What a create of a company and plant register takes besides its fields. */
type CreateShape<Scopes extends MasterDataScopes> = Scopes extends readonly ['plant']
  ? Record<never, never>
  : { scope: typeof scopeLevel; companyId: typeof settingsCompanyId };

/** What a row answers besides its own output fields: the kit's, and its scope if it allows both. */
type NodeShape<Scopes extends MasterDataScopes> = {
  id: z.ZodUUID;
  code: ReturnType<typeof outsideText>;
  name: ReturnType<typeof outsideText>;
  translations: z.ZodReadonly<
    z.ZodArray<
      z.ZodObject<{
        field: z.ZodString;
        locale: z.ZodString;
        text: ReturnType<typeof outsideText>;
      }>
    >
  >;
  version: typeof version;
  archivedAt: z.ZodNullable<typeof timestamp>;
  updatedAt: typeof timestamp;
} & (Scopes extends readonly ['plant'] ? Record<never, never> : { scope: typeof scopeLevel });

/** The entity in kebab case, such as equipment-group for EquipmentGroup. */
function kebab(entity: string): string {
  return entity.replace(/[A-Z]/g, (letter, index: number) =>
    index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`,
  );
}

/**
 * Declares a register (ADR 0022): an entity with a code, a name, a few fields of its own and no
 * state beyond archive, at the company or a plant (ADR 0007). It yields the fields a form
 * validates, the commands create, update, archive and restore, the output schema, the list and
 * get queries, and the operations block that the backend binds (ADR 0073). An own field that takes
 * a name of the kit's throws.
 */
export function defineMasterData<
  Own extends ObjectSchema,
  const Output extends z.core.$ZodShape,
  const Scopes extends MasterDataScopes,
>(options: MasterDataOptions<Own, Output, Scopes>) {
  const { module, entity, resource, label, permission, scopes } = options;
  const plural = options.plural ?? `${entity}s`;
  const pluralLabel = options.pluralLabel ?? `${label}s`;
  const register = `${module}.${entity}`;
  for (const field of [...Object.keys(options.fields.shape), ...Object.keys(options.output)]) {
    if (kitNames.includes(field)) {
      throw new Error(`Register ${register}: field ${field} is the kit's own`);
    }
  }
  const atCompany = scopes.includes('company' as never);
  const a = `${options.article ?? 'a'} ${label}`;
  const where = atCompany ? "at the company or at the request's plant" : "at the request's plant";

  const fields = kitFields.extend(options.fields.shape) as FieldsOf<Own>;
  const createShape = (
    atCompany ? { scope: scopeLevel, companyId: settingsCompanyId } : {}
  ) as CreateShape<Scopes>;

  const create = defineCommandContract({
    name: `${module}.create${entity}`,
    description: `Creates ${a} ${where}. Needs ${permission}:create there; a code that another ${label} the scope sees uses is refused with core.code_taken.`,
    target: 'new',
    fields: fields.extend(createShape),
    permission: `${permission}:create`,
  });
  const update = defineCommandContract({
    name: `${module}.update${entity}`,
    description: `Changes ${a}: its code, its name and the other fields the input sends. Needs ${permission}:update where it sits; an archived ${label} is refused with core.archived.`,
    target: 'existing',
    fields,
    permission: `${permission}:update`,
  });
  const archive = defineCommandContract({
    name: `${module}.archive${entity}`,
    description: `Archives ${a}: lists hide it, and it keeps its code. Needs ${permission}:archive where it sits; an archived ${label} is refused with core.archived.`,
    target: 'existing',
    fields: z.object({}),
    permission: `${permission}:archive`,
  });
  const restore = defineCommandContract({
    name: `${module}.restore${entity}`,
    description: `Restores an archived ${label}. Needs ${permission}:archive where it sits; one that is not archived is refused with core.not_archived.`,
    target: 'existing',
    fields: z.object({}),
    permission: `${permission}:archive`,
  });

  const nodeShape = {
    id: z.uuid(),
    code: outsideText(),
    name: outsideText(),
    translations: z
      .array(z.object({ field: z.string(), locale: z.string(), text: outsideText() }))
      .readonly(),
    version,
    archivedAt: timestamp.nullable(),
    updatedAt: timestamp,
    ...(atCompany ? { scope: scopeLevel } : {}),
  } as NodeShape<Scopes>;
  const node = z
    .object({ ...nodeShape, ...options.output })
    .meta({ id: `${module[0]?.toUpperCase()}${module.slice(1)}${entity}` });

  const list = defineListDeclaration({
    name: entity,
    node,
    sortFields: {
      code: { column: 'code', type: 'text' },
      name: { column: 'name', type: 'text' },
      updatedAt: { column: 'updated_at', type: 'timestamptz' },
    },
    defaultOrderBy: ['code'],
    search: ['code', 'name'],
    archivable: true,
  });
  const find = defineListQueryContract({
    name: `${module}.find${plural}`,
    list,
    permission: `${permission}:read`,
  });
  const get = defineQueryContract({
    name: `${module}.get${entity}`,
    input: z.object({ id: z.uuid() }),
    output: node,
    permission: `${permission}:read`,
  });

  const command = kebab(entity);
  const operations = defineOperations({
    module,
    resource,
    scope: atCompany ? 'companyOrPlant' : 'plant',
    operations: {
      find: {
        contract: find,
        rest: { method: 'GET', path: resource, status: 200, maxPageSize: 100 },
        tool: false,
      },
      get: {
        contract: get,
        rest: { method: 'GET', path: `${resource}/{id}`, status: 200 },
        tool: false,
      },
      create: {
        contract: create,
        output: node,
        rest: { method: 'POST', path: `commands/create-${command}`, status: 201 },
        tool: false,
      },
      update: {
        contract: update,
        output: node,
        rest: { method: 'POST', path: `commands/update-${command}`, status: 200 },
        tool: false,
      },
      archive: {
        contract: archive,
        output: node,
        rest: { method: 'POST', path: `commands/archive-${command}`, status: 200 },
        tool: false,
      },
      restore: {
        contract: restore,
        output: node,
        rest: { method: 'POST', path: `commands/restore-${command}`, status: 200 },
        tool: false,
      },
    },
  });

  return {
    module,
    entity,
    plural,
    label,
    pluralLabel,
    permission,
    scopes,
    fields,
    create,
    update,
    archive,
    restore,
    node,
    list,
    find,
    get,
    operations,
  };
}

/** What defineMasterData returns: a register's definition, which the server factory reads. */
export type MasterDataDefinition = ReturnType<typeof defineMasterData>;
