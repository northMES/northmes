---
status: "proposed"
date: 2026-10-22
decision-makers: Krister Johansson
consulted: Claude Code documentation (permission modes, settings reference, hooks); pnpm's install inputs (lockfile, workspace settings, .npmrc, .pnpmfile, patches, lifecycle scripts); probes of the install hook on the maintainer's machine
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (bypass mode instead of auto mode for unattended sessions, as accepted risk A-09; the install hook in the maintainer's user settings, which installs outside the sandbox only when every install input equals main)"
---

# Unattended agent sessions in bypass mode inside the sandbox, with installs from main's manifests

## Context and problem statement

ADR 0084 put agent sessions in auto mode inside the Claude Code sandbox and kept bypass permissions mode off. ADR 0086 lets a low pull request merge without the maintainer. Two things still stop a session that runs for hours while nobody watches: auto mode stops on actions its classifier holds back and waits for a person, and `pnpm install` fails inside the sandbox ([#739](https://github.com/northMES/northmes/issues/739)), so a worktree that needs an install waits for the maintainer's terminal.

This ADR decides the permission mode of unattended sessions and how a worktree gets its dependencies without the maintainer. It covers `.claude/settings.json`, the maintainer's `~/.claude/settings.json` and the install hook it names.

## Decision drivers

* A session should run from the issue to a merged low pull request without a person answering a prompt.
* The operating system boundary of ADR 0084 (filesystem, network, the machine user's token) has to hold in every mode.
* Code that a branch adds must never run outside the sandbox.

## Considered options

* Keep auto mode and add `autoMode.allow` entries as sessions stop
* Bypass mode inside the sandbox, with deny rules for the file tools
* Run `pnpm install` unsandboxed through `sandbox.excludedCommands`
* Install outside the sandbox from a hook, only when every install input equals main

## Decision outcome

Chosen options: "Bypass mode inside the sandbox" and "Install from a hook when every install input equals main", because the boundary that matters is the sandbox and the token, which hold in bypass mode, and an install whose inputs all come from `main` runs only code the maintainer already accepted.

1. **Bypass mode.** `.claude/settings.json` no longer sets `permissions.disableBypassPermissionsMode`, so a session can start with `--dangerously-skip-permissions` or the Code tab's bypass mode. The sandbox stays on with `allowUnsandboxedCommands: false`, so every shell command still runs inside it. The deny rules of ADR 0084 rule 3 keep the file tools off the credential paths, the shell start-up files and every Claude Code settings file, and they apply in bypass mode. Auto mode stays the default in the maintainer's user settings, with an `autoMode.allow` entry for `pnpm agent:auto-merge`, so a session the maintainer watches keeps the classifier.
2. **The install hook.** The maintainer's `~/.claude/settings.json` runs `~/.claude/hooks/northmes-worktree-install.sh` at session start and after each Bash call that runs git. For a worktree under `.claude/worktrees/`, it hashes every file that decides what an install runs (each `package.json`, `package.yaml`, `package.json5`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `.pnpmfile.*` and `patches/`), and when they changed since the last install, it compares the set with main's from the GitHub API. When both sets hold the same paths with the same content, it runs `pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile` outside the sandbox. A branch that adds, removes or changes any of them gets no install, and its install waits for the maintainer, as ADR 0084 rule 8 says. The hook takes main's side from the GitHub API, not from the worktree's git refs or config, and it does not run git in the worktree. It stops when the worktree holds a symlink outside `node_modules` or a `node_modules` that is a symlink. Because lifecycle scripts and the pnpmfile are off, a file swapped between the check and the install runs no code outside the sandbox: the install only fetches and links packages into the worktree. No workspace package on `main` has an install script and `allowBuilds` allows no build, so the flags change nothing for an install from `main`.

### Changes to ADR 0084

ADR 0084 is proposed and points here. This ADR replaces these parts, and the rest stands.

| Line | Replaced by |
|---|---|
| Rule 1: `.claude/settings.json` sets `disableBypassPermissionsMode: "disable"` | Bypass mode is allowed; the sandbox and the deny rules are the boundary in every mode |
| Rule 8: the maintainer runs `pnpm install` for a worktree | The install hook runs it when every install input equals `main`; a branch that changes one waits for the maintainer |

### Consequences

* Good, because an unattended session no longer stops on a prompt, and a worktree that merges `main` gets its install without the maintainer.
* Good, because a dependency change still reaches no machine outside the sandbox before the maintainer approves it: dependency files are risk paths (ADR 0086), and the hook installs only what `main` holds.
* Bad, because in bypass mode Claude's Read, Edit, Write and WebFetch tools, MCP servers and hooks are checked only by the deny rules, without the classifier (accepted risk A-09).
* Bad, because the hook lives in the maintainer's user settings, outside the repository, so it is checked by hand like the rest of ADR 0084's setup.

### Confirmation

`test/meta/agent-sandbox.test.ts` checks that bypass mode is allowed, and that the sandbox block, the deny rules and the env block stay the reviewed ones. The setup page's checks in [docs/agents/agent-isolation.md](../agents/agent-isolation.md) cover the install hook: a worktree at `main` installs, and one with a new `.pnpmfile.cjs`, a symlinked manifest, a `package.yaml` in place of a `package.json` or a symlinked `node_modules` does not.

## Pros and cons of the options

### Keep auto mode and add `autoMode.allow` entries

* Good, because the classifier keeps reviewing the file tools and MCP servers.
* Bad, because each new kind of action stops a session until the maintainer adds an entry.

### Bypass mode inside the sandbox

* Good, because no prompt waits for a person.
* Good, because the sandbox, the deny rules and the machine user's token hold in every mode.
* Bad, because the classifier no longer reviews what the sandbox does not wrap.

### Run `pnpm install` unsandboxed through `sandbox.excludedCommands`

* Good, because it works for every branch.
* Bad, because a branch's lockfile, workspace settings and lifecycle scripts would run with the maintainer's full rights, which ADR 0084 rule 8 already ruled out.

### Install from a hook when every install input equals main

* Good, because no code from the branch runs outside the sandbox: the inputs equal `main`, and scripts and the pnpmfile are off.
* Bad, because a branch that changes a dependency still waits for the maintainer.

## More information

Related ADRs: [0084](0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md) (the sandbox and the machine user), [0086](0086-risk-tiered-review-and-merge-of-agent-pull-requests.md) (risk tiers and auto-merge). Revisit when pnpm installs inside the sandbox (#739), or when a session is seen using a file tool or an MCP server against the deny rules.
