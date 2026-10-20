---
status: "proposed"
date: 2026-10-20
decision-makers: Krister Johansson
consulted: Claude Code documentation (sandboxing, permission modes, settings reference) for Claude Code 2.1.304; a probe of the settings in a headless session on the maintainer's machine
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the machine user's name and its token's 90-day expiry; the TLS trust service opened for gh; code owner review on main, so the maintainer's own pull requests need another approver; the Docker socket as accepted risk A-07; pnpm install at worktree setup until pnpm's store lock works in the sandbox)"
---

# Agent sessions in auto mode inside the Claude Code sandbox, with their own GitHub identity and the maintainer's approval on main

## Context and problem statement

Claude Code sessions and workflows build most of NorthMES on the maintainer's Mac, often while nobody watches: a session starts other sessions, waits for CodeRabbit and answers review comments on its own. Until this decision they ran in bypass permissions mode, which skips every permission check and, in Claude Code's words, "offers no protection against prompt injection". They act on untrusted input every day: public issues, pull request comments, web pages and npm packages.

Such a session could reach everything the maintainer's account reaches. The gh login in the macOS keychain holds a classic token with the `repo`, `workflow`, `admin:public_key` and `project` scopes, `~/.ssh` holds private keys for GitHub and for other organizations, and `~/.npmrc` holds registry tokens. The `workflow` scope lets a session push a workflow that reads a repository secret on a same-repository pull request, and `admin:public_key` lets it add an SSH key that outlives the session. Agents also commit as the maintainer, so the maintainer cannot approve their pull requests; the one approval that the `main` ruleset requires comes from CodeRabbit, after a comment the session posts itself (ADR 0065, accepted risk A-06).

The isolation should match the oversight: the less a person watches, the stronger the boundary, and an agent needs both a filesystem and a network boundary. This ADR decides how Claude Code sessions on NorthMES are isolated, which GitHub identity they use, and who approves their pull requests. It covers `.claude/settings.json`, the maintainer's own Claude Code settings, the agent's GitHub account, the `main` ruleset and Docker Desktop's file sharing. CI jobs and the Claude Code Action keep the rules of ADR 0050.

## Decision drivers

* Prompt injection is expected, not exceptional: an injected session must not reach the maintainer's other credentials, other repositories or other organizations.
* Unattended runs are the norm, so the control has to hold without a person answering prompts.
* `pnpm check` must keep working inside the boundary, including Testcontainers with Docker.
* A change to `main` needs a human reviewer outside the session, as the review practices of IEC 62443-4-1 and the source code access controls of ISO 27001 expect.
* The setup has to be checkable by an auditor from the repository, with the parts that live outside it written down.

## Considered options

* Keep bypass permissions mode and accept the risk
* Auto mode alone
* Auto mode inside the Claude Code sandbox, with an agent GitHub identity and code owner review on `main`
* Bypass mode inside a separate macOS user or a Linux VM that the desktop app reaches as an SSH target

## Decision outcome

Chosen option: "Auto mode inside the Claude Code sandbox, with an agent GitHub identity and code owner review on `main`", because it puts an operating system boundary around every shell command, takes the maintainer's credentials out of reach, and moves the last check before `main` to a person, with setup that fits the desktop app the maintainer already uses. A separate user or VM is stronger and stays the next step if the sandbox's residual risks grow.

1. **Permission mode.** Sessions run in auto mode, where a classifier reviews each action and blocks force pushes, downloaded code run with `curl | bash`, secrets sent out and permission grants. `.claude/settings.json` sets `permissions.disableBypassPermissionsMode: "disable"`, so neither the `--dangerously-skip-permissions` flag nor a subagent definition can turn bypass on. Claude Code takes `defaultMode: "auto"` only from user settings, so the maintainer's `~/.claude/settings.json` sets it.
2. **Sandbox.** `.claude/settings.json` turns the sandbox on with `failIfUnavailable: true`, so Claude Code refuses to start without it, and `allowUnsandboxedCommands: false`, so a failed command is never retried outside it. No command is excluded.
   * Writes: the session's working directory and the per-user temp directory (Claude Code's defaults), plus the pnpm store and cache and the Playwright browser cache.
   * Reads: everything except `~/.ssh`, `~/.config/gh`, `~/.aws`, `~/.npmrc`, `~/.netrc` and `~/.gnupg`. The same paths are `Read(...)` deny rules for the file tools, and `Edit(...)` deny rules keep the file tools off the shell start-up files, `~/.gitconfig`, `~/.ssh` and `~/.claude/settings.json`.
   * Network: the sandbox proxy allows `registry.npmjs.org`, GitHub (`github.com`, `api.github.com`, `codeload.github.com`, `objects.githubusercontent.com`, `raw.githubusercontent.com`, `release-assets.githubusercontent.com`) and the Playwright browser downloads. Any other host is refused.
   * Docker: the Docker sockets (`~/.docker/run/docker.sock` and `/var/run/docker.sock`) and local binding are allowed, because Testcontainers starts Postgres through the socket and connects to its mapped port. Rule 5 limits what that opens.
   * gh: `enableWeakerNetworkIsolation` lets sandboxed commands reach macOS's TLS trust service, without which gh cannot verify GitHub's certificate. Claude Code's documentation says this opens a potential path to send data out through the trust service. The other way it offers, `gh *` in `excludedCommands`, would run gh, its aliases and its extensions outside the sandbox with full access.
3. **GitHub identity.** Sessions push, open pull requests and comment as a machine user, `northmes-agent`, with the write role on `northMES/northmes` only. Its fine-grained token reaches that one repository with Contents, Pull requests and Issues read and write and Metadata read; it has no Workflows, Actions, Administration or Secrets permission, and it expires after 90 days. The token reaches sessions as `GH_TOKEN` from the `env` of the maintainer's `~/.claude/settings.json`, gh reads its configuration from a directory of its own (`GH_CONFIG_DIR`), and git pushes over HTTPS through gh's credential helper, because SSH is outside the sandbox proxy and `~/.ssh` is denied. The maintainer's own gh logins move out of the macOS keychain to gh's file storage under `~/.config/gh`, which the sandbox denies, and the keychain keeps no GitHub credential that git's keychain helper could hand out: the probe below read the keychain's gh token from inside the sandbox, and `denyRead` does not cover the keychain. The setup steps are in [docs/agents/agent-isolation.md](../agents/agent-isolation.md).
4. **Approval and merge.** The `main` ruleset requires code owner review, and `CODEOWNERS` already names `@Krister-Johansson` for every path, so only the maintainer's approval lets a pull request merge. CodeRabbit still reviews, but its approval no longer satisfies the rule, which ends the 15-minute approval of ADR 0065 and closes A-06 once the ruleset changes. Agents never merge: `Bash(gh pr merge*)` is a deny rule, and the maintainer merges or turns on auto-merge for a pull request he has approved. The ruleset keeps no bypass actors, so a pull request the maintainer writes himself needs another approver; until a second maintainer joins, his changes go through an agent session.
5. **Docker.** Docker Desktop's file sharing is narrowed to folders that hold no credentials and no NorthMES checkout, never the home folder or `/Users`, so a container that a session starts cannot mount `~/.ssh` or write into a repository's `.git/hooks`. No test bind-mounts a folder. A container still runs with the Docker VM's rights and its own network egress, which bypasses the sandbox proxy: that is accepted risk A-07.
6. **What stays outside the sandbox.** The sandbox wraps shell commands only. Claude's Read, Edit, Write and WebFetch tools, hooks and MCP servers follow permission rules and the auto mode classifier instead, which is why rule 2 repeats the credential paths as deny rules.
7. **pnpm install.** pnpm 12.11.2 fails inside the macOS sandbox when it opens its store operation lock, also with a store in the temp directory, so the lock is not a path the sandbox can allow. Until that is solved, `pnpm install` runs when a worktree is set up, outside the session, and a session that needs a new install asks the maintainer. No `excludedCommands` entry runs it unsandboxed, because a session can edit `pnpm-workspace.yaml` and the lockfile that such an install would act on.

### Consequences

* Good, because an injected session reaches one repository through a token without workflow or admin rights, instead of every repository, key and organization the maintainer can reach.
* Good, because the network allowlist stops sandboxed commands from sending data to arbitrary hosts, and the classifier reviews what the sandbox does not wrap.
* Good, because commits, pull requests and comments by agents carry their own identity, so the history tells the maintainer's work from an agent's, and the maintainer can approve agent pull requests.
* Good, because the maintainer's approval becomes the one required for `main`, which removes the self-approval loop behind A-06.
* Bad, because every agent pull request waits for the maintainer, and pull requests he writes himself need another approver while he is the only maintainer.
* Bad, because the Docker socket opens a path around the network allowlist (A-07), and the proxy decides on host names without inspecting TLS, so a command could reach other services on an allowed host such as `github.com`.
* Bad, because the TLS trust service that gh needs is open to every sandboxed command.
* Bad, because `pnpm install` cannot run inside a session until pnpm's store lock works in the sandbox.
* Bad, because part of the setup lives outside the repository (the maintainer's user settings, the machine user, the ruleset, Docker Desktop), so it has to be checked by hand.
* Neutral, because `.claude/settings.json` applies to every clone: a contributor on a system without the sandbox (Windows outside WSL2) cannot start Claude Code in this repository.

### Confirmation

* `test/meta/agent-sandbox.test.ts` fails when `.claude/settings.json` turns the sandbox off, allows an unsandboxed command, drops a credential path, widens the write paths, the network allowlist or the Unix sockets, weakens isolation beyond the trust service, re-enables bypass mode or drops the deny rule on `gh pr merge`.
* The probe: a headless session in a worktree with the project settings runs a script of shell commands and reports each outcome without printing a secret. On 2026-10-20 with Claude Code 2.1.304 it showed `~/.ssh`, `~/.config/gh`, writes to the home folder and `~/.zshrc`, `example.com` and SSH to GitHub refused; `registry.npmjs.org`, HTTPS to GitHub, a commit in the worktree and `migrate.int.test.ts` with Testcontainers (15 tests) working; the keychain's gh token readable; a container able to mount `~/.ssh` while Docker Desktop shares the home folder; `pnpm install` failing at the store lock; and gh failing TLS verification until `enableWeakerNetworkIsolation` was on, after which it reached the GitHub API with a token from `GH_TOKEN` and a `GH_CONFIG_DIR` of its own. The maintainer runs it again after the setup in rule 3 and rule 5, after a Claude Code upgrade that changes the sandbox, and in the internal audit before each release (ADR 0076).
* `scripts/repo/check-ruleset.mjs` asserts `require_code_owner_review: true` once the ruleset changes.
* Inspection: `gh api repos/northmes/northmes/pulls/<number>/commits --jq '.[].author.login'` prints the machine user for an agent pull request, and `gh api user --jq .login` in a session prints it too.

## Pros and cons of the options

### Keep bypass permissions mode and accept the risk

* Good, because sessions never stop on a prompt or a sandbox refusal.
* Bad, because one injected instruction runs with every credential on the machine, in this and other organizations.
* Bad, because no control an auditor could check stands between an untrusted issue and a push.

### Auto mode alone

* Good, because it is one setting, and the classifier blocks the obvious harmful actions.
* Bad, because a classifier is not a boundary: Claude Code's documentation says it "does not guarantee safety", and nothing stops a command it allows from reading `~/.ssh` or reaching any host.
* Bad, because by default it allows pushes to any branch of the repository, the default branch included.

### Auto mode inside the Claude Code sandbox, with an agent GitHub identity and code owner review on `main`

* Good, because the operating system enforces the filesystem and network limits on every shell command, whatever the classifier decides.
* Good, because the token a session holds reaches one repository and cannot change workflows or the account.
* Good, because it runs in the desktop app on the maintainer's machine with Docker as it is.
* Bad, because the Docker socket, the keychain and the tools outside the sandbox each need their own measure (rules 3, 5 and 6).
* Bad, because it needs setup outside the repository.

### Bypass mode inside a separate macOS user or a Linux VM that the desktop app reaches as an SSH target

* Good, because the boundary is an account or a virtual machine: the maintainer's keychain, keys and files are not there at all, and Docker runs inside it with nothing of the host to mount.
* Good, because bypass mode inside it would cost little.
* Bad, because it needs a second machine image to maintain, its own Node, pnpm, Docker and Claude Code installs, and an SSH setup for the desktop app.
* Bad, because the maintainer's worktrees, notes and the private instructions would live apart from his own checkout.

## More information

* Related ADRs: [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) (rulesets, CODEOWNERS and what agents may do on GitHub; code owner review was off because the maintainer could not approve his own agents' pull requests, which this ADR changes), [0065](0065-coderabbit-check-run-and-a-required-approval-on-main.md) (the required approval and CodeRabbit), [0076](0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md) (the threat model and the internal audit).
* Security documents: the agent sessions zone and conduit C8 in the [threat model](../security/threat-model.md), A-07 in the [risk register](../security/risks.md), the machine user in the [project credentials](../security/project-credentials.md).
* Claude Code documentation: sandboxing (https://code.claude.com/docs/en/sandboxing), permission modes (https://code.claude.com/docs/en/permission-modes), settings reference (https://code.claude.com/docs/en/settings-reference).
* Revisit when the sandbox covers the keychain or inspects TLS, when Docker can run without the host socket, when pnpm's store lock works in the sandbox, when a second maintainer joins, or when a session escapes the boundary.
