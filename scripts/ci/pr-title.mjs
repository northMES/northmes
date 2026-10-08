// The check behind CI / pr title. The pull request title becomes the squash commit subject and the
// changelog line, so it must be a Conventional Commit with one of the types that release-please
// sorts into the changelog or hides from it (docs/plan/13-delivery-and-github.md).

import { errorAnnotation } from './annotation.mjs';

const types = [
  'feat',
  'fix',
  'security',
  'perf',
  'revert',
  'docs',
  'test',
  'ci',
  'chore',
  'refactor',
  'build',
];

const conventionalCommit = new RegExp(`^(?:${types.join('|')})(?:\\([^()\\s]+\\))?!?: \\S`);

export function checkTitle(title) {
  if (conventionalCommit.test(title)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message: `The pull request title ${JSON.stringify(title)} is not a Conventional Commit. Write it as type(scope): outcome or type: outcome, with ! before the colon for a breaking change and one of the types ${types.join(', ')}.`,
  };
}

// The job passes the title through the environment, never inside the run script, so a title cannot
// inject shell code.
if (import.meta.main) {
  const { ok, message } = checkTitle(process.env.PR_TITLE ?? '');
  if (!ok) {
    console.log(errorAnnotation(message));
    process.exitCode = 1;
  }
}
