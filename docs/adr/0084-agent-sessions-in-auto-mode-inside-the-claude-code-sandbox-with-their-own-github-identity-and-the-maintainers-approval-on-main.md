---
status: "proposed"
date: 2026-10-20
decision-makers: Krister Johansson
consulted: Claude Code documentation (sandboxing, permission modes, settings reference) for Claude Code 2.1.304; probes of the settings in headless sessions on the maintainer's machine; a review of the change in a fresh context
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the machine user's name and its token's 90-day expiry; the TLS trust service opened for gh; code owner review on main, so the maintainer's own pull requests need another approver; the Docker socket and local ports as accepted risk A-07; pnpm install inside the sandbox per ADR 0087)"
---

# Agent sessions in auto mode inside the Claude Code sandbox, with their own GitHub identity and the maintainer's approval on main

## Context and problem statement

Claude Code sessions and workflows build most of NorthMES on the maintainer's Mac, often while nobody watches: a session starts other sessions, waits for CodeRabbit and answers review comments on its own. Until this decision they ran in bypass permissions mode, which skips every permission check and, in Claude Code's words, "offers no protection against prompt injection". They act on untrusted input every day: public issues, pull request comments, web pages and npm packages.

Such a session could reach everything the maintainer's account reaches. The gh login in the macOS keychain holds a classic token with the `repo`, `workflow`, `admin:public_key` and `project` scopes; `~/.ssh` holds private keys for GitHub and for other organizations; `~/.npmrc` holds registry tokens; handoff's `.env` holds another classic token; and the private notes of the maintainer sit next to the checkout. The `workflow` scope lets a session push a workflow that reads a repository secret on a same-repository pull request, and `admin:public_key` lets it add an SSH key that outlives the session. Agents also commit as the maintainer, so the maintainer cannot approve their pull requests; the one approval that the `main` ruleset requires comes from CodeRabbit, after a comment the session posts itself (ADR 0065, accepted risk A-06).

The isolation should match the oversight: the less a person watches, the stronger the boundary, and an agent needs both a filesystem and a network boundary. This ADR decides how Claude Code sessions on NorthMES are isolated, which GitHub identity they use, and who approves their pull requests. It covers `.claude/settings.json`, `.github/CODEOWNERS`, the maintainer's own Claude Code settings, the agent's GitHub account, the `main` ruleset and Docker Desktop's file sharing. CI jobs and the Claude Code Action keep the rules of ADR 0050.

## Decision drivers

* Prompt injection is expected, not exceptional: an injected session must not reach the maintainer's other credentials, other repositories, other organizations or his private notes.
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

Chosen option: "Auto mode inside the Claude Code sandbox, with an agent GitHub identity and code owner review on `main`", because it puts an operating system boundary around every shell command, takes the maintainer's credentials and private files out of reach, and moves the last check before `main` to a person, with setup that fits the desktop app the maintainer already uses. A separate user or VM is stronger and stays the next step if the sandbox's residual risks grow.

1. **Permission mode.** Sessions run in auto mode, where a classifier reviews each action and blocks force pushes, downloaded code run with `curl | bash`, secrets sent out and permission grants. `.claude/settings.json` sets `permissions.disableBypassPermissionsMode: "disable"`, so neither the `--dangerously-skip-permissions` flag nor a subagent definition can turn bypass on. Claude Code takes `defaultMode: "auto"` only from user or managed settings, so the maintainer's `~/.claude/settings.json` sets it.
2. **Reads.** `.claude/settings.json` sets `permissions.blockReadsOutsideWorkingDirectories: true`. Claude's file tools then refuse reads outside the session's working directories, and sandboxed commands lose read access to the home folder and the other folders that hold user files, except the working directories, the session's temp directory, the repository's shared `.git` for a worktree, and the parts of `~/.claude` that Claude Code needs. The toolchain under the home folder (Node under `~/.nvm`, pnpm under `~/Library/pnpm`), the Playwright browsers, `~/.docker/config.json`, which Testcontainers reads, and gh's own configuration folder are opened again with `sandbox.filesystem.allowRead` in the maintainer's user settings, because Claude Code ignores a repository's `allowRead` while the block is on. `sandbox.filesystem.denyRead` and `Read(...)` deny rules name the credential paths (`~/.ssh`, `~/.config/gh`, `~/.aws`, `~/.npmrc`, `~/.netrc`, `~/.gnupg`) as well, so they stay closed if the block is ever lifted.
3. **Sandbox.** `.claude/settings.json` turns the sandbox on with `failIfUnavailable: true`, so Claude Code refuses to start without it, and `allowUnsandboxedCommands: false`, so a failed command is never retried outside it. No command is excluded and no write path is added: sandboxed commands write to the working directory and the per-user temp directory only, so a session cannot replace a binary that the maintainer later runs outside the sandbox. The project settings also set `VERCEL_CONFIG_DIR_PATH` to a folder that does not exist, because turbo otherwise reads the Vercel CLI's login file for a remote cache that NorthMES does not use, the sandbox refuses that read, and `pnpm check` fails.
   * Network: the sandbox proxy allows `registry.npmjs.org`, GitHub (`github.com`, `api.github.com`, `codeload.github.com`, `objects.githubusercontent.com`, `raw.githubusercontent.com`, `release-assets.githubusercontent.com`) and the Playwright browser downloads. In auto mode a command can also name hosts of its own, which the classifier may open for that command; `sandbox.network.strictAllowlist: true` refuses those, and every host outside the list. Claude Code takes that lock only from user or managed settings, and while it is on it ignores a repository's `allowedDomains`, so the maintainer's user settings set the lock and the same list. The project settings keep the list as the reviewed source that the user settings copy.
   * Docker: the Docker sockets (`~/.docker/run/docker.sock` and `/var/run/docker.sock`) and local binding are allowed, because Testcontainers starts Postgres through the socket and connects to its mapped port. Local binding also lets sandboxed commands connect to any port on localhost. Rule 6 limits what the socket opens.
   * gh: `enableWeakerNetworkIsolation` lets sandboxed commands reach macOS's TLS trust service, without which gh cannot verify GitHub's certificate. Claude Code's documentation says this opens a potential path to send data out through the trust service. The other way it offers, `gh *` in `excludedCommands`, would run gh, its aliases and its extensions outside the sandbox with full access.
   * Edits: `Edit(...)` deny rules keep the file tools off the shell start-up files, `~/.gitconfig`, `~/.ssh`, `~/Library/LaunchAgents` and every Claude Code settings file, the project's `.claude/settings.json` and `.claude/settings.local.json` included, so a session cannot loosen its own sandbox. Sandboxed commands cannot write those files either, because Claude Code protects them.
4. **GitHub identity.** Sessions push, open pull requests and comment as a machine user, `northmes-agent`, with the write role on `northMES/northmes` only. Its fine-grained token reaches that one repository with Contents, Pull requests and Issues read and write and Metadata read; it has no Workflows, Actions, Administration or Secrets permission, and it expires after 90 days. The token, the git author and committer and the git settings that send pushes over HTTPS through gh's credential helper reach sessions through the `env` of the main checkout's `.claude/settings.local.json`, which worktree sessions of this repository load and no other project does; SSH is outside the sandbox proxy and `~/.ssh` is denied. gh reads its configuration from a folder of its own (`GH_CONFIG_DIR`). The maintainer's own gh logins move out of the macOS keychain to gh's file storage under `~/.config/gh`, which the sandbox denies, and the keychain keeps no GitHub credential that git's keychain helper could hand out: a probe read the keychain's gh token from inside the sandbox, and no read rule covers the keychain. The setup steps are in [docs/agents/agent-isolation.md](../agents/agent-isolation.md).
5. **Approval and merge.** `.github/CODEOWNERS` names `@Krister-Johansson` for every path, and the `main` ruleset requires code owner review, so only the maintainer's approval lets a pull request merge. CodeRabbit still reviews, but its approval no longer satisfies the rule, which ends the 15-minute approval and closes A-06 once the ruleset changes. The ruleset changes before the machine user gets its token, because until then the machine user's approval would count as the one required. Agents do not merge: the maintainer merges, and `Bash(gh pr merge*)` is a deny rule. The deny rule matches the command as written, so `gh api` or a GraphQL mutation still gets past it; the control that holds is the ruleset, under which a merge needs the maintainer's approval and green checks. The ruleset keeps no bypass actors, so a pull request the maintainer writes himself needs another approver; until a second maintainer joins, his changes go through an agent session.
6. **Docker.** Docker Desktop's file sharing is narrowed to folders that hold no credentials and no NorthMES checkout, never the home folder or `/Users`, so a container that a session starts cannot mount `~/.ssh` or a repository. No test bind-mounts a folder. A container still runs with the Docker VM's rights and its own network egress, which bypasses the sandbox proxy: that is accepted risk A-07, together with the local ports and the trust service of rule 3.
7. **What stays outside the sandbox.** The sandbox wraps shell commands only. Claude's Read, Edit, Write and WebFetch tools, hooks and MCP servers follow permission rules and the auto mode classifier instead, which is why rules 2 and 3 repeat the paths as permission rules.
8. **pnpm install.** Replaced by ADR 0087: a session installs inside the sandbox, with pnpm's store and virtual store outside the worktree. No `excludedCommands` entry runs `pnpm install` unsandboxed, because a session can edit `pnpm-workspace.yaml` and the lockfile that such an install would act on.

### Changes to ADR 0039, ADR 0050 and ADR 0065

ADR 0039 and ADR 0050 are accepted, so their text stays as it was. ADR 0065 is proposed and points here for the line below. This ADR replaces the parts in the table and adds the CLA exemption below the table, and the rest of each stands.

| Line | Replaced by |
|---|---|
| ADR 0050, repository settings: "`CODEOWNERS` is `* @Krister-Johansson`; code owner review is not required, because a maintainer cannot approve their own pull request." | `.github/CODEOWNERS` is `* @Krister-Johansson`, and code owner review is required on `main`, because agents act as their own machine user and the maintainer can approve their pull requests |
| ADR 0065: "The `CODEOWNERS` line of ADR 0050 stands: code owner review stays off" | Code owner review is on (rule 5). CodeRabbit's approval no longer satisfies the `main` ruleset, for session and contributor pull requests alike |

ADR 0050's "Auto-merge off" stands: the maintainer merges.

ADR 0039 is accepted, so its text stays as it was. This ADR adds one account to those that pass `CI / cla` without a signature: `northmes-agent`, the machine user of rule 4, because it acts for the maintainer, who holds the copyright to its work. `scripts/cla/check.mjs` names it by GitHub user id next to the maintainer, Renovate and github-actions on the release pull request. The agent's commits pass only on a pull request that the agent or the maintainer opened, because GitHub links a commit to the account whose email it names and the agent's noreply address follows from its public id. Every other commit author of an agent pull request is checked as before.

### Consequences

* Good, because an injected session reaches one repository through a token without workflow or admin rights, instead of every repository, key, token and private file the maintainer can reach.
* Good, because the network allowlist stops sandboxed commands from sending data to arbitrary hosts, and the classifier reviews what the sandbox does not wrap.
* Good, because pushes, pull requests and comments by agents are made with their own credential, so GitHub's records tell the maintainer's work from an agent's, and the maintainer can approve agent pull requests.
* Good, because the maintainer's approval becomes the one required for `main`, which removes the self-approval loop behind A-06.
* Bad, because every pull request waits for the maintainer, and pull requests he writes himself need another approver while he is the only maintainer.
* Bad, because the Docker socket opens a path around the network allowlist, local binding opens every localhost port, the TLS trust service is open to every sandboxed command, and the proxy decides on host names without inspecting TLS (A-07).
* Bad, because the machine user's Contents permission also lets it create `v*` tags and releases until [#738](https://github.com/northMES/northmes/issues/738) restricts them.
* Bad, because `pnpm install` could not run inside a session until the store lock and the store were opened to the sandbox (ADR 0087).
* Bad, because part of the setup lives outside the repository (the maintainer's user settings and local settings, the machine user, the ruleset, Docker Desktop), so it has to be checked by hand ([#737](https://github.com/northMES/northmes/issues/737)).
* Neutral, because `.claude/settings.json` applies to every clone: on a system without the sandbox (Windows outside WSL2) Claude Code does not start in this repository, and on Linux the Docker socket list has no effect, because Claude Code ignores `allowUnixSockets` there.

### Confirmation

* `test/meta/agent-sandbox.test.ts` compares the whole `sandbox` block and the whole `env` block of `.claude/settings.json` with the reviewed ones, so any key that widens either fails; it also fails when bypass mode or the read block is turned off, when the project settings add an allow rule or an additional directory, when a credential path or settings file leaves the deny rules, and when `.github/CODEOWNERS` names anyone but the maintainer.
* The probes: a headless session in a worktree with the project settings runs a script of shell commands and reports each outcome without printing a secret. On 2026-10-20 with Claude Code 2.1.304 they showed `~/.ssh`, `~/.config/gh`, `~/.kube`, handoff's `.env`, the private notes, the main checkout, writes to the home folder and `~/.zshrc`, `example.com` and SSH to GitHub refused; `registry.npmjs.org`, HTTPS to GitHub, a commit in the worktree, the meta tests and `migrate.int.test.ts` with Testcontainers (15 tests) working; `env` from the main checkout's `.claude/settings.local.json` reaching a worktree session; gh reaching the GitHub API only with `enableWeakerNetworkIsolation` and a `GH_CONFIG_DIR` of its own; the keychain's gh token readable; a container able to mount `~/.ssh` while Docker Desktop shares the home folder; and `pnpm install` failing at the store lock. The maintainer runs the checks of the setup page after the setup, after a Claude Code upgrade that changes the sandbox, and in the internal audit before each release (ADR 0076).
* The ruleset check that ADR 0065 plans (`scripts/repo/check-ruleset.mjs`, task E00-S04-T03, [#201](https://github.com/northMES/northmes/issues/201)) asserts `require_code_owner_review: true` as well.
* `scripts/cla/check.test.ts`: "the northmes-agent machine user passes", "a northmes-agent pull request with an unsigned person among its commit authors fails" and "a commit attributed to northmes-agent fails on another person's pull request".

Inspection steps, not checks: `gh api user --jq .login` in a session prints the machine user, `gh pr view <number> --json author` prints it for an agent pull request, and the other checks at the end of [docs/agents/agent-isolation.md](../agents/agent-isolation.md) show the user settings in force.

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
* Bad, because the Docker socket, the keychain and the tools outside the sandbox each need their own measure (rules 4, 6 and 7).
* Bad, because it needs setup outside the repository.

### Bypass mode inside a separate macOS user or a Linux VM that the desktop app reaches as an SSH target

* Good, because the boundary is an account or a virtual machine: the maintainer's keychain, keys and files are not there at all, and Docker runs inside it with nothing of the host to mount.
* Good, because bypass mode inside it would cost little.
* Bad, because it needs a second machine image to maintain, its own Node, pnpm, Docker and Claude Code installs, and an SSH setup for the desktop app.
* Bad, because the maintainer's worktrees, notes and the private instructions would live apart from his own checkout.

## More information

* Masking the token with `sandbox.credentials.envVars` was considered: the sandbox would substitute it only on its way to GitHub. It needs the proxy to terminate TLS, which Claude Code marks experimental, so the token stays a plain environment variable inside the sandbox, limited by its permissions instead.
* Related ADRs: [0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md) (the CLA and `CI / cla`), [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) (rulesets, CODEOWNERS and what agents may do on GitHub), [0065](0065-coderabbit-check-run-and-a-required-approval-on-main.md) (the required approval and CodeRabbit), [0076](0076-secure-development-lifecycle-with-a-security-note-per-change-a-controls-index-and-an-internal-audit-each-release.md) (the threat model and the internal audit), [0077](0077-visual-regression-snapshots-with-argos-from-the-playwright-specs.md) (the Argos token that an agent pull request's e2e job reads).
* Security documents: the development workstation zone and conduit C8 in the [threat model](../security/threat-model.md), A-07 in the [risk register](../security/risks.md), the machine user in the [project credentials](../security/project-credentials.md).
* Claude Code documentation: sandboxing (https://code.claude.com/docs/en/sandboxing), permission modes (https://code.claude.com/docs/en/permission-modes), settings reference (https://code.claude.com/docs/en/settings-reference).
* Revisit when the sandbox covers the keychain or inspects TLS, when Docker can run without the host socket, when pnpm's store lock works in the sandbox, when a second maintainer joins, or when a session escapes the boundary.
