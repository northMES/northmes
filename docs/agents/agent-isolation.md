# Agent isolation setup

Claude Code sessions on NorthMES run inside the Claude Code sandbox, in auto mode or, when nobody watches, in bypass mode ([ADR 0087](../adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-from-mains-manifests.md)), and act on GitHub as their own machine user ([ADR 0084](../adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md)). `.claude/settings.json` holds the part every clone shares. This page lists the part that lives on the maintainer's machine and in GitHub, tracked in [#737](https://github.com/northMES/northmes/issues/737). Apply it in this order. The project settings deny `~/.ssh` and `~/.config/gh`, so a session that runs with them cannot push until steps 2 to 4 are done.

## 1. Code owner review on `main`

In the `main` branch ruleset, turn on "Require review from Code Owners", set the required approvals to 0, and require the `risk gate` status check from the GitHub Actions app ([ADR 0086](../adr/0086-risk-tiered-review-and-merge-of-agent-pull-requests.md)). The risk gate fails a high pull request, one that touches a risk path included, until the maintainer approves its head commit. With 0 required approvals GitHub does not enforce code owner review, so `.github/CODEOWNERS`, which names `@Krister-Johansson` for the patterns of `.github/risk-paths`, only requests his review there. Turn on auto-merge in the repository settings. Do the code owner step before step 2: until then, an approval from the machine user would count as one the ruleset requires.

## 2. The machine user and its token

1. Create the GitHub account `northmes-agent` with two-factor sign-in, and give it the write role on `northMES/northmes` only.
2. As `northmes-agent`, create a fine-grained token with resource owner `northMES`, repository `northMES/northmes` only, an expiry of 90 days, and these repository permissions: Contents, Pull requests and Issues read and write; Metadata read. Leave every other permission at no access, Workflows, Actions, Administration and Secrets included.
3. Record the expiry. A new token replaces the old one before it expires, and a token is revoked at once after a suspected leak ([project credentials](../security/project-credentials.md)).

## 3. Your own GitHub credentials out of the keychain

A sandboxed command can read the macOS keychain, so no GitHub credential stays there.

1. For each gh account, `gh auth logout` and then `gh auth login --insecure-storage`, which keeps the token in gh's hosts file under `~/.config/gh`. The sandbox denies that folder. Any process outside the sandbox can still read the file, as it could read the keychain entry before.
2. In Keychain Access, delete the internet passwords for `github.com`, if any. Your git pushes go over SSH; if you push over HTTPS outside a session, git's keychain helper stores a new one, so delete it again or turn the helper off for `github.com`.

## 4. Claude Code settings

In `~/.claude/settings.json`, which applies to every project, set auto mode, lock the network allowlist and open the folders that sandboxed commands need to read. Without the lock, auto mode lets a command name hosts of its own, which the classifier may open; with it, Claude Code refuses every host outside the list and ignores the repository's `allowedDomains`, so the list here repeats the one in `.claude/settings.json`. The lock and the list apply to every project that uses this configuration folder, so keep the list to these hosts: a host added here opens for NorthMES sessions too. Run a project that needs other hosts with its own configuration folder, for example `CLAUDE_CONFIG_DIR=~/.claude-other claude`, which has its own user settings. Use the paths of your own Node and pnpm installs. Remove `skipDangerousModePermissionPrompt` if it is there.

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

Auto mode is the default. Start a session that runs while nobody watches in bypass mode, with `--dangerously-skip-permissions` or the Code tab's mode picker ([ADR 0087](../adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-from-mains-manifests.md)): the sandbox and the deny rules hold in both modes, and bypass mode only drops the classifier and its prompts. Auto mode blocks a merge that no person approved, so add an `autoMode.allow` entry for `pnpm agent:auto-merge`. When auto mode stops a session on another action it should allow, add an `autoMode.allow` or `autoMode.environment` entry; Claude Code reads `autoMode` from user and managed settings only.

```json
{
  "autoMode": {
    "allow": [
      "$defaults",
      "In the northMES/northmes repository, running `pnpm agent:auto-merge <pull request number>` on a pull request the session opened, which turns on GitHub auto-merge. GitHub's ruleset, not the script, decides whether the pull request can merge: it requires the risk gate and, on a risk path, the maintainer's approval (ADR 0086)."
    ]
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

`pnpm install` fails inside the sandbox ([#739](https://github.com/northMES/northmes/issues/739)), so a hook in `~/.claude/settings.json` installs outside it ([ADR 0087](../adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-from-mains-manifests.md)). It runs `~/.claude/hooks/northmes-worktree-install.sh` on `SessionStart` (matcher `startup`) and on `PostToolUse` (matcher `Bash`), with a timeout of 600 seconds. For a Claude Code worktree of this repository (the folders under .claude/worktrees), after a session starts or a Bash call that runs git, the script hashes every file that decides what an install runs: each `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `.pnpmfile.*` and `patches/`. A package.yaml or package.json5 counts too, because pnpm reads them in place of a `package.json`. When they changed since the last install, it compares the set with main's from `https://api.github.com/repos/northMES/northmes/git/trees/main?recursive=1`, and only when both sets hold the same paths with the same content does it run `pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile` and record the hashes in `node_modules/.northmes-install-manifest`. It computes the blob ids itself and runs no git in the worktree, because a session can change the worktree's refs and `.git/config`. It stops when the worktree holds a symlink outside `node_modules` or a `node_modules` that is a symlink. With scripts and the pnpmfile off, a file a session swaps between the check and the install runs no code: the install only fetches and links packages. A refused set is recorded in `node_modules/.northmes-install-refused`, so the hook calls the API again only when the set changes. A worktree whose branch changes one of those files gets no install: run `pnpm install --frozen-lockfile` in it from your own terminal after you have read the change.

## Checking it

Start a session in a worktree and ask it to run these commands and report each outcome:

- `ls ~/.ssh`, `ls ~/.config/gh` and `ls ~/Project` are refused with "Operation not permitted".
- `security find-generic-password -s gh:github.com` and `security find-internet-password -s github.com` find nothing.
- `curl -sS -o /dev/null -w '%{http_code}' https://example.com/` is refused by the proxy, also when the session names `example.com` as a host for the command.
- `gh api user --jq .login` prints `northmes-agent`.
- `git push --dry-run origin HEAD` reaches GitHub over HTTPS.
- `docker run --rm -v "$HOME:/h:ro" alpine ls /h`, from your own terminal, fails with a file sharing error, because Docker Desktop does not share the folder.
- `pnpm exec vitest run --project integration apps/backend/test/migrate.int.test.ts` passes.
- In a new worktree at `main`, `node_modules/.northmes-install-manifest` exists after the session starts. After `echo '{}' > .pnpmfile.cjs`, `rm node_modules/.northmes-install-manifest` and a `git status`, the file stays missing, because the worktree no longer equals `main`. The same holds for a symlink to a `package.json`, and for a package.yaml in place of one.
