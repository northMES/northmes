# Agent isolation setup

Claude Code sessions on NorthMES run inside the Claude Code sandbox, in auto mode or, when nobody watches, in bypass mode ([ADR 0087](../adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-inside-the-sandbox.md)), and act on GitHub as their own machine user ([ADR 0084](../adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md)). `.claude/settings.json` holds the part every clone shares. This page lists the part that lives on the maintainer's machine and in GitHub, tracked in [#737](https://github.com/northMES/northmes/issues/737). Apply it in this order. The project settings deny `~/.ssh` and `~/.config/gh`, so a session that runs with them cannot push until steps 2 to 4 are done.

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

In `~/.claude/settings.json`, which applies to every project, set auto mode, list the hosts sandboxed commands may reach, open the folders they need, deny the commands that would swap or print a GitHub token, and add the `SessionStart` hook of section 6. Lock the list with `strictAllowlist`: without it, auto mode lets a command name hosts of its own, and bypass mode allows every host. With it, Claude Code refuses every host outside the list and ignores the repository's `allowedDomains`, so the list here covers the repository's hosts too. The lock and the list apply to every project that uses this configuration folder. The write grants are for pnpm: its lock folders in `/tmp` (a `*` in a sandbox path stays within one folder, so each pattern comes twice), and `/private/tmp/claude-501` for the store, the virtual stores and the `gh` cache (use your own uid). Do not grant writes to `~/Library/Caches/ms-playwright`: your own Playwright runs those browsers outside the sandbox, so sessions only read them. Use the paths of your own Node and pnpm installs. Remove `skipDangerousModePermissionPrompt` if it is there.

```json
{
  "permissions": {
    "defaultMode": "auto",
    "deny": ["Bash(gh auth login*)", "Bash(gh auth switch*)", "Bash(gh auth token*)", "Bash(security *)"]
  },
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
        "results-receiver.actions.githubusercontent.com",
        "cdn.playwright.dev",
        "playwright.download.prss.microsoft.com"
      ]
    },
    "filesystem": {
      "allowWrite": [
        "/tmp/pnpm-*",
        "/tmp/pnpm-*/*",
        "/private/tmp/pnpm-*",
        "/private/tmp/pnpm-*/*",
        "/private/tmp/claude-501"
      ],
      "allowRead": [
        "~/.nvm",
        "~/Library/pnpm",
        "~/Library/Caches/ms-playwright",
        "~/.docker/config.json",
        "~/.config/gh-agent",
        "/tmp/pnpm-*",
        "/tmp/pnpm-*/*",
        "/private/tmp/pnpm-*",
        "/private/tmp/pnpm-*/*"
      ]
    }
  },
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "~/.claude/hooks/northmes-worktree-env.sh" }] }]
  }
}
```

Auto mode is the default. Start a session that runs while nobody watches in bypass mode, with `--dangerously-skip-permissions` or the Code tab's mode picker ([ADR 0087](../adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-inside-the-sandbox.md)): the sandbox and the deny rules hold in both modes, and bypass mode only drops the classifier and its prompts. Auto mode blocks a merge that no person approved, so add an `autoMode.allow` entry for `pnpm agent:auto-merge`. When auto mode stops a session on another action it should allow, add an `autoMode.allow` or `autoMode.environment` entry; Claude Code reads `autoMode` from user and managed settings only.

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

A session installs its worktree's dependencies itself, inside the sandbox, with `pnpm install --frozen-lockfile` ([ADR 0087](../adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-inside-the-sandbox.md)). The sandbox refuses every write to a `.claude` or `.vscode` folder in the working directory, and some packages ship one, so the packages must not land in the worktree. The `SessionStart` hook `~/.claude/hooks/northmes-worktree-env.sh` therefore writes three variables to `CLAUDE_ENV_FILE`, which Claude Code loads before each Bash command, when the session's folder (the hook input's `cwd`) is a folder directly under .claude/worktrees in this repository:

```sh
export pnpm_config_store_dir=/private/tmp/claude-501/pnpm-store
export pnpm_config_virtual_store_dir=/private/tmp/claude-501/pnpm-vstore/<worktree folder>
export XDG_CACHE_HOME=/private/tmp/claude-501/xdg-cache
```

Use real paths: `/tmp` is a symlink, and pnpm refuses it for the hoist folder. `node_modules` in the worktree then holds only links into the virtual store. `XDG_CACHE_HOME` lets `gh run view --log-failed` cache run logs without opening your own `~/.cache/gh`; do not set it in the user-wide `env` block, because hooks and MCP servers outside the sandbox would then read a cache that sessions write. The hook also prints a warning when the worktree's local settings file (.claude/settings.local.json) does not set the machine user's token. A session in the main checkout gets no variables and must not install: a sandboxed install there removes part of your `node_modules` and then fails.

## Checking it

Start a session in a worktree and ask it to run these commands and report each outcome:

- `ls ~/.ssh`, `ls ~/.config/gh` and `ls ~/Project` are refused with "Operation not permitted".
- `security find-generic-password -s gh:github.com` and `security find-internet-password -s github.com` find nothing.
- `curl -sS -o /dev/null -w '%{http_code}' https://example.com/` is refused by the proxy, also when the session names `example.com` as a host for the command.
- `gh api user --jq .login` prints `northmes-agent`.
- `git push --dry-run origin HEAD` reaches GitHub over HTTPS.
- `docker run --rm -v "$HOME:/h:ro" alpine ls /h`, from your own terminal, fails with a file sharing error, because Docker Desktop does not share the folder.
- `pnpm exec vitest run --project integration apps/backend/test/migrate.int.test.ts` passes.
- In a new worktree, `echo "$pnpm_config_virtual_store_dir"` names its folder under `/private/tmp/claude-501/pnpm-vstore`, `pnpm install --frozen-lockfile` finishes, `readlink node_modules/typescript` points into that folder, and `pnpm check` passes.
- `gh run view <id> --log-failed` prints a failed run's log, and `ls ~/.ssh` is refused, because `sandbox.filesystem.denyRead` names the credential paths (ADR 0084 rule 2).
