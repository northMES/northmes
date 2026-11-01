// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { describe, expect, it } from 'vitest';
import { outputLines, pullRequestOutputs, readPullRequest } from './event-pull-request.mjs';

const pull = {
  number: 958,
  title: 'docs(adr): one Users page',
  body: '## What changes\n\nOne page.\n',
  user: { login: 'northmes-agent' },
  head: { ref: 'docs/adr-0091-one-users-page', repo: { fork: false } },
  base: { sha: '8e4e97c1e0d6a1f0f4c3b2a19d8e7f6a5b4c3d2e' },
};

describe('#985 PR / pull request writes the fields the pull request checks read', () => {
  it('#985 the outputs carry the number, title, body, author, head ref, fork flag and base sha', () => {
    expect(pullRequestOutputs(pull)).toEqual({
      number: '958',
      title: 'docs(adr): one Users page',
      body: '## What changes\n\nOne page.\n',
      author: 'northmes-agent',
      head_ref: 'docs/adr-0091-one-users-page',
      from_fork: 'false',
      base_sha: '8e4e97c1e0d6a1f0f4c3b2a19d8e7f6a5b4c3d2e',
    });
  });

  it('#985 an empty body and a deleted fork repository read as an empty body from a fork', () => {
    expect(pullRequestOutputs({ ...pull, body: null, head: { ref: 'x', repo: null } })).toMatchObject(
      { body: '', from_fork: 'true' },
    );
  });

  it('#985 a one-line value is name=value and a value with line breaks is a heredoc with a random delimiter', () => {
    expect(outputLines({ number: '958', body: 'one\ntwo', title: 't' }, () => 'abc')).toBe(
      'number=958\nbody<<EOF_abc\none\ntwo\nEOF_abc\ntitle=t\n',
    );
    const [first, second] = [
      outputLines({ body: 'a\nb' }),
      outputLines({ body: 'a\nb' }),
    ];
    expect(first).not.toBe(second);
    expect(first).toMatch(/^body<<EOF_[0-9a-f]{32}\na\nb\nEOF_[0-9a-f]{32}\n$/);
  });

  it('#985 reads the pull request through the REST API with the token and the api version', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const outputs = await readPullRequest({
      fetch: (async (url: string, init: { headers: Record<string, string> }) => {
        calls.push({ url, headers: init.headers });
        return new Response(JSON.stringify(pull), { status: 200 });
      }) as unknown as typeof fetch,
      apiUrl: 'https://api.example',
      repository: 'northMES/northmes',
      token: 'secret',
      pullNumber: 958,
    });

    expect(outputs.number).toBe('958');
    expect(calls).toEqual([
      {
        url: 'https://api.example/repos/northMES/northmes/pulls/958',
        headers: {
          accept: 'application/vnd.github+json',
          authorization: 'Bearer secret',
          'x-github-api-version': '2022-11-28',
        },
      },
    ]);
  });

  it('#985 a refused request fails with the status, so the checks never run on a missing pull request', async () => {
    await expect(
      readPullRequest({
        fetch: (async () => new Response('', { status: 404 })) as unknown as typeof fetch,
        apiUrl: 'https://api.example',
        repository: 'northMES/northmes',
        token: '',
        pullNumber: 1,
      }),
    ).rejects.toThrow('GitHub answered 404 to GET /repos/northMES/northmes/pulls/1');
  });
});
