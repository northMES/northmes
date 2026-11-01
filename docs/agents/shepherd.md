# Scheduling the pull request shepherd

After a session ends, its pull request still needs a rebase when `main` moves, a re-run when a check fails on timing, answers to CodeRabbit's threads, and a review request when its head changes. The `pr-shepherd` skill (`.claude/skills/pr-shepherd/SKILL.md`) does these in one pass, reading `pnpm agent:shepherd` (`scripts/agents/shepherd.mjs`) for what each open pull request waits on. This page says how the maintainer runs that pass on a schedule, as an unattended session in bypass mode inside the sandbox ([ADR 0087](../adr/0087-unattended-agent-sessions-in-bypass-mode-inside-the-sandbox-with-installs-inside-the-sandbox.md)), with the machine user's token ([ADR 0084](../adr/0084-agent-sessions-in-auto-mode-inside-the-claude-code-sandbox-with-their-own-github-identity-and-the-maintainers-approval-on-main.md)).

## The worktree

The pass runs in a worktree of its own, .claude/worktrees/shepherd, for two reasons from [agent isolation](agent-isolation.md) section 6: the session start hook sets pnpm's store paths only for a folder directly under .claude/worktrees, and the sandbox refuses every write to a `.claude` folder inside the working directory, so a session in the main checkout could neither install nor make worktrees there. The worktree loads the main checkout's local settings file with the token, as every worktree of this repository does. Make it once, from the main checkout:

```sh
git worktree add .claude/worktrees/shepherd origin/main
```

The shepherd checks each branch it tends out in that worktree with `git checkout -B <branch> origin/<branch>` and puts it back on `origin/main` when done. The scheduled command resets it to `origin/main` before every pass too, so a pass that stopped halfway cannot leave an unreviewed branch's `CLAUDE.md` and scripts for the next session to load. Nothing else uses the worktree.

## The command

Run the pass once by hand first, from the worktree, and read its output. The first run with `--dangerously-skip-permissions` asks for a confirmation in the terminal, which a launchd run cannot answer, so the by-hand run comes first. A pass with nothing to do ends within a minute; a pass with a rebase and a CodeRabbit round takes longer, and `--max-turns` ends a pass that runs away.

```sh
cd ~/Project/NorthMES/.claude/worktrees/shepherd && git fetch -q origin && git checkout -q -B shepherd origin/main && claude -p "Use the pr-shepherd skill: make one pass over the open pull requests northmes-agent opened." --dangerously-skip-permissions --max-turns 150
```

## The schedule

launchd runs the command every 30 minutes and starts no second pass while one runs. Save this as `~/Library/LaunchAgents/dev.northmes.shepherd.plist`, with your own home folder, then `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.northmes.shepherd.plist`. The user settings of agent isolation step 4 apply, because launchd runs the command as you; `PATH` names the folders of your Node, pnpm and claude installs, because launchd reads no shell profile. The log goes under `~/Library/Logs`, which a reboot keeps and a sandboxed session cannot write.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>dev.northmes.shepherd</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>cd ~/Project/NorthMES/.claude/worktrees/shepherd && git fetch -q origin && git checkout -q -B shepherd origin/main && claude -p "Use the pr-shepherd skill: make one pass over the open pull requests northmes-agent opened." --dangerously-skip-permissions --max-turns 150</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/Users/you/.nvm/versions/node/v26.0.0/bin:/Users/you/Library/pnpm:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key>
  <integer>1800</integer>
  <key>StandardOutPath</key>
  <string>/Users/you/Library/Logs/northmes-shepherd.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/you/Library/Logs/northmes-shepherd.err</string>
</dict>
</plist>
```

`launchctl bootout gui/$(id -u)/dev.northmes.shepherd` stops the schedule, for example while you work on a branch the shepherd would rebase under you. The log is the pass's last lines: one per pull request, what it did and what the pull request still waits on. A line that names the maintainer is the one to read: a workflow file to push, a disputed thread, a request for changes the branch needs a session for, an Argos difference, or an approval.

## What it does not do

The shepherd approves nothing and changes neither the Tier line nor the Validation impact of a pull request (ADR 0086). It merges nothing by hand; auto-merge, turned on with the project script, merges. It leaves a thread a person opened, a pull request northmes-agent did not open, and a failure the change itself causes, for which it opens an issue that names the pull request and the failing test.
