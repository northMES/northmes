// The check behind ci / pr title. The pull request title becomes the squash commit subject and the
// changelog line, so it must be a Conventional Commit with a type release-please knows.

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

const conventionalCommit = new RegExp(`^(?:${types.join('|')})\\([^()\\s]+\\): \\S`);

export function checkTitle(title) {
  if (conventionalCommit.test(title)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message: `The pull request title ${JSON.stringify(title)} is not a Conventional Commit. Write it as type(scope): outcome, with one of the types ${types.join(', ')}.`,
  };
}
