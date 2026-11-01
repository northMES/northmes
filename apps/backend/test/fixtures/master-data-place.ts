// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { givenAssignment, givenCompany, queryAsCore, signIn } from '@northmes/backend/testing';
import { type GqlClient, gqlClient, type MasterDataPlace, type TestApp } from '@northmes/testing';

/**
 * A company with plants A and B, their admins, its admin at plant A and in company settings, a
 * reader who holds only `readPermission` at plant A, and another company: the place of the
 * master-data kit's contract suite (ADR 0022).
 */
export async function givenMasterDataPlace(
  testApp: TestApp | undefined,
  ownerUrl: string,
  readPermission: string,
): Promise<MasterDataPlace> {
  if (!testApp) throw new Error('the test app did not start');
  const url = await testApp.app.getUrl();

  /**
   * A client of a fresh user who holds the default role `key` at `scopeId`, at plant `slug`, or in
   * company settings without a slug.
   */
  async function holderOf(
    company: string,
    key: string,
    scopeId: string,
    slug?: string,
  ): Promise<GqlClient> {
    if (!testApp) throw new Error('the test app did not start');
    const user = await signIn(testApp.app, ownerUrl, []);
    const [role] = await queryAsCore<{ id: string }>(
      ownerUrl,
      'select id from core.role where company_id = $1 and key = $2',
      [company, key],
    );
    if (!role) throw new Error(`the company has no role ${key}`);
    await givenAssignment(ownerUrl, { userId: user.userId, roleId: role.id, scopeId });
    const headers: Record<string, string> = { authorization: user.authorization };
    if (slug !== undefined) headers['x-northmes-plant'] = slug;
    return gqlClient(url, { headers });
  }

  const { company, plants, slugs } = await givenCompany(ownerUrl, { plants: 2 });
  const other = await givenCompany(ownerUrl);
  const [plantA = '', plantB = ''] = plants;
  const [slugA = '', slugB = ''] = slugs;
  const reader = await signIn(testApp.app, ownerUrl, [
    { scopeId: plantA, permissions: [readPermission] },
  ]);
  return {
    company,
    otherCompany: other.company,
    plantA,
    plantB,
    companyAdmin: await holderOf(company, 'core-company-admin', company, slugA),
    plantAdminA: await holderOf(company, 'core-plant-admin', plantA, slugA),
    plantAdminB: await holderOf(company, 'core-plant-admin', plantB, slugB),
    readerA: gqlClient(url, {
      headers: { authorization: reader.authorization, 'x-northmes-plant': slugA },
    }),
    companySettings: await holderOf(company, 'core-company-admin', company),
  };
}
