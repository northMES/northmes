# Agent isolation setup

Claude Code sessions on NorthMES run in auto mode inside the Claude Code sandbox and act on GitHub as their own machine user ([ADR 0084](../adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md)). `.claude/settings.json` holds the part every clone shares. This page lists the part that lives on the maintainer's machine and in GitHub, tracked in [#737](https://github.com/northMES/northmes/issues/737). Apply it in this order. The project settings deny `~/.ssh` and `~/.config/gh`, so a session that runs with them cannot push until steps 2 to 4 are done.

## 1. Code owner review on `main`

In the `main` branch ruleset, turn on "Require review from Code Owners". `.github/CODEOWNERS` names `@Krister-Johansson` for every path, so only the maintainer's approval lets a pull request merge. Do this before step 2: until then, an approval from the machine user would count as the one the ruleset requires.

## 2. The machine user and its token

1. Create the GitHub account `northmes-agent` with two-factor sign-in, and give it the write role on `northMES/northmes` only.
2. As `northmes-agent`, create a fine-grained token with resource owner `northMES`, repository `northMES/northmes` only, an expiry of 90 days, and these repository permissions: Contents, Pull requests and Issues read and write; Metadata read. Leave every other permission at no access, Workflows, Actions, Administration and Secrets included.
3. Record the expiry. A new token replaces the old one before it expires, and a token is revoked at once after a suspected leak ([project credentials](../security/project-credentials.md)).

## 3. Your own GitHub credentials out of the keychain

A sandboxed command can read the macOS keychain, so no GitHub credential stays there.

1. For each gh account, `gh auth logout` and then `gh auth login --insecure-storage`, which keeps the token in gh's hosts file under `~/.config/gh`. The sandbox denies that folder. Any process outside the sandbox can still read the file, as it could read the keychain entry before.
2. In Keychain Access, delete the internet passwords for `github.com`, if any. Your git pushes go over SSH; if you push over HTTPS outside a session, git's keychain helper stores a new one, so delete it again or turn the helper off for `github.com`.

## 4. Claude Code settings

In `~/.claude/settings.json`, which applies to every project, set auto mode, lock the network allowlist and open the folders that sandboxed commands need to read. Without the lock, auto mode lets a command name hosts of its own, which the classifier may open; with it, Claude Code refuses every host outside the list and ignores the repository's `allowedDomains`, so the list here repeats the one in `.claude/settings.json`. The lock and the list apply to every project, so add the hosts your other projects need. Use the paths of your own Node and pnpm installs. Remove `skipDangerousModePermissionPrompt` if it is there.

```json
{
  "permissions": { "defaultMode": "auto" },
  "sandbox": {
    "network": {
      "strictAllowlist": true,
      "allowedDomains": [
        "registry.npmjs.org",
        "github.com",
        "api.github.com",
        "codeload.github.com",
        "objects.githubusercontent.com",
        "raw.githubusercontent.com",
        "release-assets.githubusercontent.com",
        "cdn.playwright.dev",
        "playwright.download.prss.microsoft.com"
      ]
    },
    "filesystem": {
      "allowRead": [
        "~/.nvm",
        "~/Library/pnpm",
        "~/Library/Caches/ms-playwright",
        "~/.docker/config.json",
        "~/.config/gh-agent"
      ]
    }
  }
}
```

In the main checkout's local settings file, .claude/settings.local.json, which `.gitignore` keeps out of git and only this repository's sessions load, worktree sessions included, put the machine user's token and identity. Use the token from step 2, your home folder in `GH_CONFIG_DIR`, and the machine user's noreply address from its GitHub email settings.

```json
{
  "env": {
    "GH_TOKEN": "<northmes-agent token>",
    "GH_CONFIG_DIR": "/Users/<you>/.config/gh-agent",
    "GIT_AUTHOR_NAME": "northmes-agent",
    "GIT_AUTHOR_EMAIL": "<id>+northmes-agent@users.noreply.github.com",
    "GIT_COMMITTER_NAME": "northmes-agent",
    "GIT_COMMITTER_EMAIL": "<id>+northmes-agent@users.noreply.github.com",
    "GIT_CONFIG_COUNT": "4",
    "GIT_CONFIG_KEY_0": "url.https://github.com/.insteadOf",
    "GIT_CONFIG_VALUE_0": "git@github.com:",
    "GIT_CONFIG_KEY_1": "url.https://github.com/.insteadOf",
    "GIT_CONFIG_VALUE_1": "ssh://git@github.com/",
    "GIT_CONFIG_KEY_2": "credential.helper",
    "GIT_CONFIG_VALUE_2": "",
    "GIT_CONFIG_KEY_3": "credential.https://github.com.helper",
    "GIT_CONFIG_VALUE_3": "!gh auth git-credential"
  }
}
```

Create the empty folder that `GH_CONFIG_DIR` names. Claude Code takes `defaultMode` and a working `allowRead` only from user settings, and the token belongs to this machine, so none of this goes into the repository.

## 5. Docker Desktop file sharing

In Docker Desktop, Settings, Resources, File sharing, remove `/Users` and share only folders that hold no credentials and no NorthMES checkout. NorthMES's tests mount no folder, so they need no entry.

## 6. Worktree setup

`pnpm install` fails inside the sandbox ([#739](https://github.com/northMES/northmes/issues/739)), so a new worktree gets its dependencies before the session starts: run `pnpm install --frozen-lockfile` in it from your own terminal.

## Checking it

Start a session in a worktree and ask it to run these commands and report each outcome:

- `ls ~/.ssh`, `ls ~/.config/gh` and `ls ~/Project` are refused with "Operation not permitted".
- `security find-generic-password -s gh:github.com` and `security find-internet-password -s github.com` find nothing.
- `curl -sS -o /dev/null -w '%{http_code}' https://example.com/` is refused by the proxy, also when the session names `example.com` as a host for the command.
- `gh api user --jq .login` prints `northmes-agent`.
- `git push --dry-run origin HEAD` reaches GitHub over HTTPS.
- `docker run --rm -v "$HOME:/h:ro" alpine ls /h`, from your own terminal, fails with a file sharing error, because Docker Desktop does not share the folder.
- `pnpm exec vitest run --project integration apps/backend/test/migrate.int.test.ts` passes.
