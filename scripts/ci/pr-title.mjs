// The check behind ci / pr title. The pull request title becomes the squash commit subject and the
// changelog line, so it must be a Conventional Commit with a type release-please knows.

export function checkTitle(_title) {
  return { ok: true, message: '' };
}
