import { hostFactory } from '@northmes/backend/testing';
import { createTestApp, type TestApp, useTestDatabase } from '@northmes/testing';
import { createNorthmesClient } from '@northmes/web-sdk';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAuthSession } from '../../apps/web/src/auth/auth-session.ts';
import { CoreArticles } from '../../apps/web/src/modules/core/screens/articles/articles.graphql.ts';
import { devAdmin, seed, seedPlants } from './seed.mjs';

/** A Storage in memory, as sessionStorage is for one tab. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

// The web's own auth session and Apollo client against the server with the dev seed: what pnpm dev
// runs, without a browser.
describe("the web's sign-in against the API", () => {
  const db = useTestDatabase();
  let testApp: TestApp;
  let url: string;

  beforeAll(async () => {
    await seed({ appUrl: db.appUrl, ownerUrl: db.ownerUrl });
    testApp = await createTestApp({ modules: ['core', 'planning'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  /** The web's session and the seed plant's Apollo client, signed in through the session. */
  function openWeb(storage = memoryStorage()) {
    const session = createAuthSession({ apiUrl: url, storage });
    const onUnauthenticated = vi.fn();
    const client = createNorthmesClient({
      plant: seedPlants[0]?.slug ?? '',
      apiUrl: url,
      auth: { token: () => session.token(), onUnauthenticated },
    });
    const searchArticles = (search: string) =>
      client.query({
        query: CoreArticles,
        variables: { first: 5, search },
        fetchPolicy: 'network-only',
        errorPolicy: 'all',
      });
    return { session, onUnauthenticated, searchArticles };
  }

  it("E05-S05 the dev admin signs in through the web's session and reads the seed plant's articles", async () => {
    const { session, onUnauthenticated, searchArticles } = openWeb();

    const signedIn = await session.signIn(devAdmin.username, devAdmin.password);
    const answer = await searchArticles('BR-140');

    expect(signedIn).toEqual({ ok: true });
    expect(session.user()).toEqual({ name: devAdmin.name, username: devAdmin.username });
    expect(answer.error).toBeUndefined();
    expect(answer.data?.coreArticles.edges.map(({ node }) => [node.code, node.name])).toEqual([
      ['BR-140', 'Wall bracket'],
    ]);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('E05-S05 a wrong password is wrong credentials, and the API refuses the client without a session', async () => {
    const { session, onUnauthenticated, searchArticles } = openWeb();

    const signedIn = await session.signIn(devAdmin.username, `${devAdmin.password}x`);
    const answer = await searchArticles('BR-140');

    expect(signedIn).toEqual({ ok: false, reason: 'wrong-credentials' });
    expect(answer.data?.coreArticles).toBeUndefined();
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it('E05-S05 sign-out ends the session at the API: its session token mints no JWT, and the API refuses the client', async () => {
    const storage = memoryStorage();
    const { session, onUnauthenticated, searchArticles } = openWeb(storage);
    await session.signIn(devAdmin.username, devAdmin.password);
    const { token: sessionToken } = JSON.parse(storage.getItem('northmes.session') ?? '{}') as {
      token?: string;
    };

    await session.signOut();
    const minted = await fetch(`${url}/api/auth/token`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const answer = await searchArticles('BR-140');

    expect(sessionToken).toEqual(expect.any(String));
    expect(minted.status).toBe(401);
    expect(await session.token()).toBeUndefined();
    expect(answer.data?.coreArticles).toBeUndefined();
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });
});
