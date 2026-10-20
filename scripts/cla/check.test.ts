// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { checkCla, parseSignatures, signSentence } from './check.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = fileURLToPath(new URL('./check.mjs', import.meta.url));

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

const apiUrl = 'https://api.github.com';
const repository = 'northMES/northmes';
const signedPath = `repos/${repository}/contents/.github/cla/signed.json`;

type Routes = Record<string, string>;

// GitHub's REST API as the check sees it: each route answers the recorded response body, and any
// other path answers 404. The requests list keeps every path the check asked for.
function github(routes: Routes) {
  const requests: string[] = [];
  const fetch = async (url: string, init?: { headers?: Record<string, string> }) => {
    const path = url.slice(`${apiUrl}/`.length);
    requests.push(path);
    expect(init?.headers?.authorization).toBe('Bearer a-read-only-token');
    const body = routes[path];
    return body === undefined
      ? new Response('{"message":"Not Found"}', { status: 404 })
      : new Response(body, { status: 200 });
  };
  return { fetch, requests };
}

// The routes of pull request `number`: the pull request, its commits and signed.json on main.
function pullRequest(number: number, pull: string, commits: string, signed: string): Routes {
  return {
    [`repos/${repository}/pulls/${number}`]: fixture(pull),
    [`repos/${repository}/pulls/${number}/commits?per_page=100&page=1`]: fixture(commits),
    [`${signedPath}?ref=main`]: fixture(signed),
  };
}

async function check(routes: Routes, pullNumber: number) {
  const { fetch, requests } = github(routes);
  const result = await checkCla({
    fetch,
    apiUrl,
    repository,
    token: 'a-read-only-token',
    pullNumber,
  });
  return { ...result, requests };
}

describe('CI / cla', () => {
  it('an unsigned author fails, and the message says how to sign', async () => {
    const result = await check(
      pullRequest(700, 'pull-from-fork.json', 'commits-by-contributor.json', 'signed-on-main.json'),
      700,
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('@a-contributor');
    expect(result.message).toContain(signSentence);
    expect(result.message).toContain('https://github.com/northMES/northmes/blob/main/CLA.md');
    expect(result.message).toContain('CLA-corporate.md');
  });

  it('a signed author passes', async () => {
    const result = await check(
      pullRequest(
        700,
        'pull-from-fork.json',
        'commits-by-contributor.json',
        'signed-with-contributor.json',
      ),
      700,
    );

    expect(result).toMatchObject({ ok: true });
  });

  // The pull request's own copy of signed.json, at its head or its merge commit, lists its author.
  // The check reads signed.json from the default branch only.
  it('a pull request that adds its own author to signed.json still fails', async () => {
    const pull = JSON.parse(fixture('pull-from-fork.json'));
    const ownCopy = fixture('signed-with-contributor.json');
    const result = await check(
      {
        ...pullRequest(
          700,
          'pull-from-fork.json',
          'commits-by-contributor.json',
          'signed-on-main.json',
        ),
        [`${signedPath}?ref=${pull.head.sha}`]: ownCopy,
        [`${signedPath}?ref=${pull.head.ref}`]: ownCopy,
        [`${signedPath}?ref=refs/pull/700/head`]: ownCopy,
        [`${signedPath}?ref=refs/pull/700/merge`]: ownCopy,
        [signedPath]: ownCopy,
      },
      700,
    );

    expect(result.ok).toBe(false);
    expect(result.requests.filter((path) => path.startsWith(signedPath))).toEqual([
      `${signedPath}?ref=main`,
    ]);
  });

  it('a commit without a GitHub account fails, also when its author signed', async () => {
    const result = await check(
      pullRequest(
        700,
        'pull-from-fork.json',
        'commits-with-unlinked-author.json',
        'signed-with-contributor.json',
      ),
      700,
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('6f1c2a9');
    expect(result.message).toContain('no GitHub account');
  });

  it('renovate[bot] passes', async () => {
    const result = await check(
      pullRequest(701, 'pull-renovate.json', 'commits-renovate.json', 'signed-on-main.json'),
      701,
    );

    expect(result).toMatchObject({ ok: true });
  });

  // A commit that someone else pushes onto Renovate's branch is still checked.
  it('a Renovate pull request with an unsigned person among its commit authors fails', async () => {
    const commits = [
      ...JSON.parse(fixture('commits-renovate.json')),
      ...JSON.parse(fixture('commits-by-contributor.json')),
    ];
    const routes = pullRequest(
      701,
      'pull-renovate.json',
      'commits-renovate.json',
      'signed-on-main.json',
    );
    const pull = { ...JSON.parse(fixture('pull-renovate.json')), commits: commits.length };
    routes[`repos/${repository}/pulls/701`] = JSON.stringify(pull);
    routes[`repos/${repository}/pulls/701/commits?per_page=100&page=1`] = JSON.stringify(commits);

    const result = await check(routes, 701);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('@a-contributor');
  });

  it('the release pull request passes', async () => {
    const result = await check(
      pullRequest(702, 'pull-release.json', 'commits-release.json', 'signed-on-main.json'),
      702,
    );

    expect(result).toMatchObject({ ok: true });
  });

  // github-actions[bot] passes only on release-please's branch in this repository.
  it('another pull request by github-actions[bot] fails', async () => {
    const routes = pullRequest(
      702,
      'pull-release.json',
      'commits-release.json',
      'signed-on-main.json',
    );
    const pull = JSON.parse(fixture('pull-release.json'));
    routes[`repos/${repository}/pulls/702`] = JSON.stringify({
      ...pull,
      head: { ...pull.head, ref: 'chore/something-else' },
    });

    const result = await check(routes, 702);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('@github-actions[bot]');
  });

  it('the maintainer passes', async () => {
    const routes = pullRequest(
      700,
      'pull-from-fork.json',
      'commits-by-contributor.json',
      'signed-on-main.json',
    );
    const maintainer = { login: 'Krister-Johansson', id: 24939000, type: 'User' };
    const pull = JSON.parse(fixture('pull-from-fork.json'));
    const commits = JSON.parse(fixture('commits-by-contributor.json'));
    routes[`repos/${repository}/pulls/700`] = JSON.stringify({ ...pull, user: maintainer });
    routes[`repos/${repository}/pulls/700/commits?per_page=100&page=1`] = JSON.stringify(
      commits.map((commit: object) => ({ ...commit, author: maintainer })),
    );

    const result = await check(routes, 700);

    expect(result).toMatchObject({ ok: true });
  });

  // The agent sessions' machine user acts for the maintainer, who holds the copyright to its work
  // (docs/adr/0084).
  it('the northmes-agent machine user passes', async () => {
    const routes = pullRequest(
      700,
      'pull-from-fork.json',
      'commits-by-contributor.json',
      'signed-on-main.json',
    );
    const agent = { login: 'northmes-agent', id: 345317483, type: 'User' };
    const pull = JSON.parse(fixture('pull-from-fork.json'));
    const commits = JSON.parse(fixture('commits-by-contributor.json'));
    routes[`repos/${repository}/pulls/700`] = JSON.stringify({ ...pull, user: agent });
    routes[`repos/${repository}/pulls/700/commits?per_page=100&page=1`] = JSON.stringify(
      commits.map((commit: object) => ({ ...commit, author: agent })),
    );

    const result = await check(routes, 700);

    expect(result).toMatchObject({ ok: true });
  });

  // GitHub lists 100 commits per page and at most 250 commits of a pull request.
  it('reads every page of commits, and fails a pull request with more commits than GitHub lists', async () => {
    const [signed] = JSON.parse(fixture('commits-by-contributor.json'));
    const unsigned = { ...signed, author: null };
    const routes = pullRequest(
      700,
      'pull-from-fork.json',
      'commits-by-contributor.json',
      'signed-with-contributor.json',
    );
    const pull = JSON.parse(fixture('pull-from-fork.json'));
    const commitsPage = (page: number) =>
      `repos/${repository}/pulls/700/commits?per_page=100&page=${page}`;
    routes[`repos/${repository}/pulls/700`] = JSON.stringify({ ...pull, commits: 101 });
    routes[commitsPage(1)] = JSON.stringify(Array(100).fill(signed));
    routes[commitsPage(2)] = JSON.stringify([unsigned]);

    const twoPages = await check(routes, 700);

    expect(twoPages.ok).toBe(false);
    expect(twoPages.message).toContain('no GitHub account');

    routes[`repos/${repository}/pulls/700`] = JSON.stringify({ ...pull, commits: 251 });

    const tooMany = await check(routes, 700);

    expect(tooMany.ok).toBe(false);
    expect(tooMany.message).toContain('250');
  });

  // signed.json holds GitHub user ids, the agreement, its version and the date, and no names.
  it('signed.json in the repository has the documented shape and holds no names', () => {
    const text = readFileSync(`${root}.github/cla/signed.json`, 'utf8');

    expect(() => parseSignatures(text)).not.toThrow();
    for (const signature of JSON.parse(text).signatures) {
      expect(Object.keys(signature).sort()).toEqual(['agreement', 'date', 'id', 'version']);
    }
    expect(() =>
      parseSignatures(
        '{"signatures":[{"id":1,"agreement":"individual","version":"0.1","date":"2026-10-15","name":"A"}]}',
      ),
    ).toThrow();
    expect(() =>
      parseSignatures(
        '{"signatures":[{"id":"a-contributor","agreement":"individual","version":"0.1","date":"2026-10-15"}]}',
      ),
    ).toThrow();
  });

  it('CLA.md holds the sentence the check prints', () => {
    expect(readFileSync(`${root}CLA.md`, 'utf8')).toContain(signSentence);
  });

  it('the entry point reads the pull request number from the environment and fails it with an annotation', async () => {
    const routes = pullRequest(
      700,
      'pull-from-fork.json',
      'commits-by-contributor.json',
      'signed-on-main.json',
    );
    const server = createServer((request, response) => {
      const body = routes[(request.url ?? '').slice(1)];
      response.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/json' });
      response.end(body ?? '{"message":"Not Found"}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const run = promisify(execFile)(process.execPath, [script], {
        env: {
          PATH: process.env.PATH,
          GITHUB_API_URL: `http://127.0.0.1:${port}`,
          GITHUB_REPOSITORY: repository,
          GITHUB_TOKEN: 'a-read-only-token',
          PR_NUMBER: '700',
        },
      });

      await expect(run).rejects.toMatchObject({
        code: 1,
        stdout: expect.stringMatching(/^::error::.*@a-contributor/),
      });
    } finally {
      server.close();
    }
  });
});
