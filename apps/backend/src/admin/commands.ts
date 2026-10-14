// SPDX-License-Identifier: AGPL-3.0-or-later
import { username } from '@northmes/core-contracts';
import { z } from 'zod';
import type { AdminCommand } from './admin-command.ts';
import { reasonFlag } from './admin-command.ts';

/** A company's name, as core.company holds it. */
const companyName = z
  .string('missing, give the company name')
  .trim()
  .min(1, 'missing, give the company name')
  .max(120, 'can be at most 120 characters');

/** A person's name, which others see. */
const personName = z
  .string()
  .trim()
  .min(1, 'must not be empty')
  .max(120, 'can be at most 120 characters');

const email = z.email('must be an email address, such as name@example.com');

/** The lines that show a temporary password once, and what the user must do with it. */
function passwordLines(password: string | undefined): string[] {
  if (!password) return [];
  return [
    `Temporary password: ${password}`,
    'Hand it over in person. It is shown only now, and must be changed at the first sign-in.',
  ];
}

/** northmes company create (ADR 0066). */
export const companyCreate: AdminCommand<{
  id?: string | undefined;
  name: string;
  'admin-username': string;
  'admin-email': string;
  'admin-name'?: string | undefined;
  reason: string;
}> = {
  usage:
    'northmes company create --name <text> --admin-username <username> --admin-email <address> [--admin-name <text>] [--id <uuidv7>] --reason <text>',
  flags: ['id', 'name', 'admin-username', 'admin-email', 'admin-name', 'reason'],
  input: z.object({
    id: z.uuidv7('must be a uuidv7').optional(),
    name: companyName,
    'admin-username': username,
    'admin-email': email,
    'admin-name': personName.optional(),
    reason: reasonFlag,
  }),
  async run(service, input) {
    const created = await service.createCompany({
      ...(input.id ? { id: input.id } : {}),
      name: input.name,
      adminUsername: input['admin-username'],
      adminEmail: input['admin-email'],
      ...(input['admin-name'] ? { adminName: input['admin-name'] } : {}),
    });
    const { companyId, name, adminUserId, adminUsername, replayed, temporaryPassword } = created;
    return {
      json: created,
      text: [
        `Company ${name} (${companyId}) ${replayed ? 'was created by an earlier run' : 'created'}`,
        `Company admin ${adminUsername} (${adminUserId})`,
        ...passwordLines(temporaryPassword),
      ],
    };
  },
};

/** northmes company add-admin (ADR 0066, M-58). */
export const companyAddAdmin: AdminCommand<{
  company: string;
  username: string;
  email?: string | undefined;
  name?: string | undefined;
  reason: string;
}> = {
  usage:
    'northmes company add-admin --company <id> --username <username> [--email <address>] [--name <text>] --reason <text>',
  flags: ['company', 'username', 'email', 'name', 'reason'],
  input: z.object({
    company: z.uuid('missing, give the company id'),
    username,
    email: email.optional(),
    name: personName.optional(),
    reason: reasonFlag,
  }),
  async run(service, input) {
    const added = await service.addCompanyAdmin({
      companyId: input.company,
      username: input.username,
      ...(input.email ? { email: input.email } : {}),
      ...(input.name ? { name: input.name } : {}),
    });
    const { companyId, userId, alreadyAdmin, temporaryPassword } = added;
    return {
      json: added,
      text: [
        alreadyAdmin
          ? `${added.username} (${userId}) is a Company admin of ${companyId} already`
          : `${added.username} (${userId}) is a Company admin of ${companyId}`,
        ...passwordLines(temporaryPassword),
      ],
    };
  },
};

/** northmes company list (ADR 0066). It writes nothing. */
export const companyList: AdminCommand<Record<string, never>> = {
  usage: 'northmes company list',
  flags: [],
  input: z.object({}),
  async run(service) {
    const companies = await service.listCompanies();
    return {
      json: companies,
      text:
        companies.length === 0
          ? ['No companies yet. Create one with northmes company create.']
          : companies.map(
              ({ id, name, plants, admins }) =>
                `${id}  ${name}  plants: ${plants}  admins: ${admins.join(', ') || 'none'}`,
            ),
    };
  },
};

/** northmes admin reset-password (ADR 0011). */
export const adminResetPassword: AdminCommand<{ username: string; reason: string }> = {
  usage: 'northmes admin reset-password --username <username> --reason <text>',
  flags: ['username', 'reason'],
  input: z.object({ username, reason: reasonFlag }),
  async run(service, input) {
    const reset = await service.resetPassword(input.username);
    return {
      json: reset,
      text: [
        `Password of ${reset.username} (${reset.userId}) reset`,
        ...passwordLines(reset.temporaryPassword),
      ],
    };
  },
};
