// Connect a graphql-ws subscriber, SIGTERM the server, report the close code the client saw.
import { spawn } from "node:child_process";
import WebSocket from "ws";
const [main, cfg, port] = process.argv.slice(2);
const child = spawn(process.execPath, [main], { env: { ...process.env, NORTHMES_CONFIG: cfg, PORT: port }, stdio: ["ignore", "pipe", "pipe"] });
let out = "";
child.stdout.on("data", (d) => { out += d; if (out.includes("phases=") && !globalThis.started) { globalThis.started = true; go(); } });
function go() {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/graphql`, "graphql-transport-ws", { headers: { cookie: "northmes_session=sid-alice" } });
  ws.on("open", () => ws.send(JSON.stringify({ type: "connection_init" })));
  ws.on("message", (m) => {
    const msg = JSON.parse(String(m));
    if (msg.type === "connection_ack") {
      ws.send(JSON.stringify({ id: "1", type: "subscribe", payload: { query: 'subscription { planningBoardChanged(plantId: "P1") { kind } }' } }));
      setTimeout(() => { globalThis.t = performance.now(); child.kill("SIGTERM"); }, 300);
    }
  });
  ws.on("close", (code, reason) => console.log(`client close code=${code} reason="${reason}" after ${Math.round(performance.now() - globalThis.t)} ms`));
}
setTimeout(() => { console.log("TIMEOUT: server still running 6000 ms after SIGTERM"); child.kill("SIGKILL"); process.exit(0); }, 8000);
child.stderr.on("data", (d) => process.stdout.write("[srv] " + d));
child.stdout.on("data", (d) => { if (String(d).includes("[dbg]")) process.stdout.write("[srv] " + d); });
child.on("exit", (code, sig) => { console.log(`server exit code=${code} signal=${sig} after ${Math.round(performance.now() - globalThis.t)} ms`); setTimeout(() => process.exit(0), 200); });
