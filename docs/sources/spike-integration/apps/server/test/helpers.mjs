import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const here = new URL("..", import.meta.url).pathname;
export const fixture = (id) => join(here, "test/fixtures", id);
export const MODULES = ["@northmes/module-core", "@northmes/module-planning"];

export function configWith(plugins, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "nm-cfg-"));
  const file = join(dir, "northmes.config.json");
  writeFileSync(file, JSON.stringify({ northmes: "0.1.0", modules: MODULES, plugins, ...extra }));
  return file;
}

/** Boots `node dist/main.js` as its own process and returns exit code and output. */
export function bootProcess(configFile, env = {}) {
  const r = spawnSync(process.execPath, [join(here, "dist/main.js")], {
    env: { ...process.env, NORTHMES_CONFIG: configFile, PORT: "0", EXIT_AFTER_BOOT: "1", ...env },
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
}

export const gqlClient = (port, sid = "sid-alice") => (query, variables) =>
  fetch(`http://127.0.0.1:${port}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `northmes_session=${sid}` },
    body: JSON.stringify({ query, variables }),
  }).then((r) => r.json());

import { spawn } from "node:child_process";
let nextPort = 4600 + Math.floor(Math.random() * 300);
/** Starts the real `all` process and resolves once it listens. */
export function startServer(configFile, env = {}) {
  const port = nextPort++;
  const child = spawn(process.execPath, [join(here, "dist/main.js")], {
    env: { ...process.env, NORTHMES_CONFIG: configFile, PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  return new Promise((resolve, reject) => {
    const onData = (d) => {
      out += d;
      if (out.includes("phases=")) resolve({ port, child, out: () => out, stop: () => new Promise((r) => { child.once("exit", r); child.kill("SIGTERM"); }) });
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => reject(new Error(`exited ${code}: ${out}`)));
  });
}
