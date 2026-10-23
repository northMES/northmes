---
status: "proposed"
date: 2026-10-22
decision-makers: Krister Johansson
consulted: Claude Code documentation (permission modes, settings reference, hooks, CLAUDE_ENV_FILE); pnpm's install inputs and its store, virtual store and lock folders; two code reviews of an install hook outside the sandbox; probes of a sandboxed install in a new worktree on the maintainer's machine (2026-10-21 to 2026-10-23, pnpm 12.11.2)
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (bypass mode instead of auto mode for unattended sessions, as accepted risk A-09; the environment hook in the maintainer's user settings, which points pnpm's store and virtual store outside the worktree; one shared store for all sessions, as accepted risk A-10)"
---

# Unattended agent sessions in bypass mode inside the sandbox, with installs inside the sandbox

## Context and problem statement

ADR 0084 put agent sessions in auto mode inside the Claude Code sandbox and kept bypass permissions mode off. ADR 0086 lets a low pull request merge without the maintainer. Two things still stop a session that runs for hours while nobody watches: auto mode stops on actions its classifier holds back and waits for a person, and `pnpm install` fails inside the sandbox ([#739](https://github.com/northMES/northmes/issues/739)), so a worktree that needs an install waits for the maintainer's terminal.

This ADR decides the permission mode of unattended sessions and how a worktree gets its dependencies without the maintainer. It covers `.claude/settings.json`, the maintainer's `~/.claude/settings.json` and the hook it names.

## Decision drivers

* A session should run from the issue to a merged low pull request without a person answering a prompt.
* The operating system boundary of ADR 0084 (filesystem, network, the machine user's token) has to hold in every mode.
* Code that a branch adds must never run outside the sandbox.

## Considered options

* Keep auto mode and add `autoMode.allow` entries as sessions stop
* Bypass mode inside the sandbox, with deny rules for the file tools
* Run `pnpm install` unsandboxed through `sandbox.excludedCommands`
* Install outside the sandbox from a hook, only when every install input equals main
* Install inside the sandbox, with pnpm's store and virtual store outside the worktree

## Decision outcome

Chosen options: "Bypass mode inside the sandbox" and "Install inside the sandbox", because the boundary that matters is the sandbox and the token, which hold in bypass mode, and an install that runs inside the sandbox runs no branch code with the maintainer's rights, whatever the branch changes.

1. **Bypass mode.** `.claude/settings.json` no longer sets `permissions.disableBypassPermissionsMode`, so a session can start with `--dangerously-skip-permissions` or the Code tab's bypass mode. The sandbox stays on with `allowUnsandboxedCommands: false`, so every shell command still runs inside it. The deny rules of ADR 0084 rule 3 keep the file tools off the credential paths, the shell start-up files and every Claude Code settings file, and they apply in bypass mode. Auto mode stays the default in the maintainer's user settings, with an `autoMode.allow` entry for `pnpm agent:auto-merge`, so a session the maintainer watches keeps the classifier.
2. **Installs inside the sandbox.** A session runs `pnpm install --frozen-lockfile` itself, inside the sandbox. Three limits of the sandbox stopped a normal install: pnpm's shared store in `~/Library/pnpm` was read-only, pnpm opens its lock folders in `/tmp` whatever `TMPDIR` says, and the sandbox refuses every write to a `.claude` or `.vscode` folder inside the working directory, which some packages ship (dockerode, docker-modem, @nestjs/config, @nestjs/swagger). The maintainer's user settings therefore allow writes to `/tmp/pnpm-*` (with `/private/tmp/pnpm-*` and one level below each, because a `*` in a sandbox path stays within one folder) and to `/private/tmp/claude-501`, and a `SessionStart` hook in them, `~/.claude/hooks/northmes-worktree-env.sh`, writes three variables to the file Claude Code loads before each Bash command, for a folder directly under `.claude/worktrees/` only:
   * `pnpm_config_store_dir=/private/tmp/claude-<uid>/pnpm-store`
   * `pnpm_config_virtual_store_dir=/private/tmp/claude-<uid>/pnpm-vstore/<worktree>`
   * `XDG_CACHE_HOME=/private/tmp/claude-<uid>/xdg-cache`, so `gh run view --log-failed` can cache run logs without the maintainer's own `~/.cache/gh`.

   The paths are real ones, because `/tmp` is a symlink and pnpm refuses it for the hoist folder. With the store and the virtual store outside the worktree, `node_modules` holds only links, so the install never writes a protected folder. The hook takes the worktree from the hook input's `cwd`, because a Claude Desktop worktree session can set `CLAUDE_PROJECT_DIR` to the main checkout. It reads nothing else from the worktree except whether `.claude/settings.local.json` sets the machine user's token, and runs nothing there. A session in the main checkout gets no variables and does not install: its `node_modules` is the maintainer's, and a sandboxed install there fails halfway.

### Changes to ADR 0084

ADR 0084 is proposed and points here. This ADR replaces these parts, and the rest stands.

| Line | Replaced by |
|---|---|
| Rule 1: `.claude/settings.json` sets `disableBypassPermissionsMode: "disable"` | Bypass mode is allowed; the sandbox and the deny rules are the boundary in every mode |
| Rule 3: no write path is added outside the working directory and the per-user temp directory | The maintainer's user settings add write grants for pnpm: `/tmp/pnpm-*` and `/private/tmp/pnpm-*` (with one level below each) for its lock folders, and `/private/tmp/claude-501` for the shared store, the virtual stores and the `gh` cache. No grant reaches a folder that holds code the maintainer runs outside the sandbox |
| Rule 8: the maintainer runs `pnpm install` for a worktree | The session runs it inside the sandbox, with the store and virtual store outside the worktree |

### Consequences

* Good, because an unattended session no longer stops on a prompt, and every worktree, a branch that changes a dependency included, gets its install without the maintainer.
* Good, because no install runs outside the sandbox, so a branch's lockfile, workspace settings or lifecycle scripts never run with the maintainer's rights.
* Bad, because every session shares one writable store and virtual store root in `/private/tmp/claude-501`, so one session can change packages that another session, or the maintainer running a worktree's scripts from a terminal, will run, and sessions can create or replace the `/tmp/pnpm-*` lock folders the maintainer's own pnpm uses (accepted risk A-10).
* Bad, because in bypass mode Claude's Read, Edit, Write and WebFetch tools, MCP servers and hooks are checked only by the deny rules, without the classifier (accepted risk A-09).
* Bad, because the hook and the write grants live in the maintainer's user settings, outside the repository, so they are checked by hand like the rest of ADR 0084's setup.

### Confirmation

`test/meta/agent-sandbox.test.ts` checks that bypass mode is allowed, and that the sandbox block, the deny rules and the env block stay the reviewed ones. The setup page's checks in [docs/agents/agent-isolation.md](../agents/agent-isolation.md) cover the install: in a new worktree the three variables are set, `pnpm install --frozen-lockfile` finishes inside the sandbox, `node_modules/typescript` links into the virtual store, and `pnpm check` passes. On 2026-10-23 a probe in a new worktree did exactly that: the install took 4.7 seconds and `pnpm check` passed 2309 tests.

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

* Good, because the install inputs equal `main`, and scripts and the pnpmfile are off.
* Bad, because a session can write the shared `.git` (refs, objects, the worktree's index and HEAD), leave untracked files such as `.pnpmfile.mjs` or `.npmrc`, fake index stat data and race the hook, and two code reviews broke every version of it, so it still let branch code reach a run outside the sandbox.
* Bad, because a branch that changes a dependency still waits for the maintainer.

### Install inside the sandbox, with the store and virtual store outside the worktree

* Good, because no install runs outside the sandbox, for any branch.
* Good, because a branch that changes a dependency installs too.
* Bad, because the sessions share one writable store, and a hook in the maintainer's user settings has to set the paths for each worktree.
* Bad, because `enableGlobalVirtualStore`, which would need no per-worktree path, breaks the typecheck (packages do not find `@types/react`), so each worktree keeps its own virtual store.

## More information

Related ADRs: [0084](0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md) (the sandbox and the machine user), [0086](0086-risk-tiered-review-and-merge-of-agent-pull-requests.md) (risk tiers and auto-merge). Revisit when pnpm's lock folders follow `TMPDIR` or a setting (reported upstream), when the global virtual store works with the typecheck, or when a session is seen using a file tool or an MCP server against the deny rules.
