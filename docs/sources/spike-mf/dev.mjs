#!/usr/bin/env node
// One command for the whole stack in dev: the Nest app, the shell dev server, and one Vite
// dev server per module that has a web remote. Ports come from the module list, never by hand.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const modules = ["planning", "quality"].filter((id) => existsSync(`modules/${id}/web/vite.config.ts`));
const remotes = modules.map((id, i) => ({ id, port: 5174 + i }));
const children = [];
const t0 = Date.now();

function run(label, cwd, cmd, args, env = {}, ready) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  const onData = (buf) => {
    const text = buf.toString();
    for (const line of text.split("\n").filter(Boolean)) console.log(`[${label}] ${line}`);
    if (ready && ready.test(text)) console.log(`[dev] ${label} ready after ${Date.now() - t0} ms`);
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
}

run("server", "apps/server", "node", ["--watch", "dist/main.js"], {
  PORT: "3310", DEV_REMOTES: "1", NORTHMES_DEV_REMOTES: JSON.stringify(remotes),
}, /Listening/);
for (const r of remotes) {
  run(r.id, `modules/${r.id}/web`, "pnpm", ["exec", "vite"], { NORTHMES_DEV_PORT: String(r.port), REMOTE_CSS: r.id === "planning" ? "none" : "" }, /ready in/);
}
run("shell", "apps/shell", "pnpm", ["exec", "vite"], { SHELL_CSS: "scan-modules" }, /ready in/);

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { for (const c of children) c.kill("SIGTERM"); process.exit(0); });
