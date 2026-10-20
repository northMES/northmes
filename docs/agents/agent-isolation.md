# Agent isolation setup

Claude Code sessions on NorthMES run in auto mode inside the Claude Code sandbox and act on GitHub as their own machine user ([ADR 0084](../adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md)). `.claude/settings.json` holds the part every clone shares. This page lists the part that lives on the maintainer's machine and in GitHub, in the order to apply it: the project settings deny `~/.ssh` and `~/.config/gh`, so a session cannot push until steps 1 to 3 are done.

## 1. The machine user and its token

1. Create the GitHub account `northmes-agent` with two-factor sign-in, and give it the write role on `northMES/northmes` only.
2. As `northmes-agent`, create a fine-grained token with resource owner `northMES`, repository `northMES/northmes` only, an expiry of 90 days, and these repository permissions: Contents, Pull requests and Issues read and write; Metadata read. Leave every other permission at no access, Workflows, Actions, Administration and Secrets included.
3. Record the expiry in your calendar. A new token replaces the old one before it expires, and a token is revoked at once after a suspected leak ([project credentials](../security/project-credentials.md)).

## 2. Your own GitHub credentials out of the keychain

A sandboxed command can read the macOS keychain, so no GitHub credential stays there.

1. For each gh account, `gh auth logout` and then `gh auth login --insecure-storage`, which keeps the token in `~/.config/gh/hosts.yml`. The sandbox denies that folder.
2. In Keychain Access, delete the internet passwords for `github.com` that `git-credential-osxkeychain` stored, if any.

## 3. Your Claude Code user settings

Add this to `~/.claude/settings.json`, with the token from step 1, your home folder in `GH_CONFIG_DIR`, and the machine user's noreply address from its GitHub email settings. Remove `skipDangerousModePermissionPrompt` if it is there.

```json
{
  "permissions": { "defaultMode": "auto" },
  "env": {
    "GH_TOKEN": "<northmes-agent token>",
    "GH_CONFIG_DIR": "/Users/<you>/.config/gh-agent",
    "GIT_AUTHOR_NAME": "northmes-agent",
    "GIT_AUTHOR_EMAIL": "<id>+northmes-agent@users.noreply.github.com",
    "GIT_COMMITTER_NAME": "northmes-agent",
    "GIT_COMMITTER_EMAIL": "<id>+northmes-agent@users.noreply.github.com",
    "GIT_CONFIG_COUNT": "3",
    "GIT_CONFIG_KEY_0": "url.https://github.com/.insteadOf",
    "GIT_CONFIG_VALUE_0": "git@github.com:",
    "GIT_CONFIG_KEY_1": "credential.helper",
    "GIT_CONFIG_VALUE_1": "",
    "GIT_CONFIG_KEY_2": "credential.https://github.com.helper",
    "GIT_CONFIG_VALUE_2": "!gh auth git-credential"
  }
}
```

Create the empty folder that `GH_CONFIG_DIR` names. Claude Code takes `defaultMode: "auto"` only from user settings, and the token belongs to this machine, so neither goes into the repository.

## 4. Docker Desktop file sharing

In Docker Desktop, Settings, Resources, File sharing, remove `/Users` and share only folders that hold no credentials and no NorthMES checkout. NorthMES's tests mount no folder, so they need no entry.

## 5. The `main` ruleset

In the `main` branch ruleset, turn on "Require review from Code Owners". `CODEOWNERS` names `@Krister-Johansson` for every path, so only the maintainer's approval lets a pull request merge.

## 6. Worktree setup

`pnpm install` fails inside the sandbox (ADR 0084 rule 7), so a new worktree gets its dependencies before the session starts: run `pnpm install --frozen-lockfile` in it from your own terminal.

## Checking it

Start a session in a worktree and ask it to run these commands and report each outcome:

- `ls ~/.ssh` and `ls ~/.config/gh` are refused.
- `security find-generic-password -s gh:github.com` finds nothing.
- `curl -sS -o /dev/null -w '%{http_code}' https://example.com/` is refused by the proxy.
- `gh api user --jq .login` prints `northmes-agent`.
- `docker run --rm -v "$HOME:/h:ro" alpine ls /h` fails because Docker Desktop does not share the folder.
- `pnpm exec vitest run --project integration apps/backend/test/migrate.int.test.ts` passes.
