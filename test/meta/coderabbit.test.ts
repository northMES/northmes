// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface CodeRabbitConfig {
  reviews?: { request_changes_workflow?: boolean; allow_author_approval?: boolean };
}

const root = fileURLToPath(new URL('../../', import.meta.url));

const config = parse(readFileSync(`${root}.coderabbit.yaml`, 'utf8')) as CodeRabbitConfig;

describe('.coderabbit.yaml', () => {
  // The main ruleset requires code owner review, so the maintainer's approval is the one that lets a
  // pull request merge and CodeRabbit's approval counts for nothing. With the request changes
  // workflow on, CodeRabbit's request for changes would still block the merge until someone posts
  // @coderabbitai approve (docs/adr/0065, docs/adr/0084).
  it('ADR0065 CodeRabbit posts its reviews as comments, without requesting changes or approving', () => {
    expect(config.reviews?.request_changes_workflow).toBe(false);
  });

  // Agents open pull requests as northmes-agent, so the author is the agent. With author approval
  // on, the agent could resolve every CodeRabbit thread with one comment and empty the rule that
  // review threads are resolved before a merge; the maintainer can still use the commands.
  it('ADR0084 the author of a pull request cannot resolve or approve CodeRabbit threads by command', () => {
    expect(config.reviews?.allow_author_approval).toBe(false);
  });
});
