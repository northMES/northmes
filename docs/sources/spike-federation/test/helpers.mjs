import "reflect-metadata";
import WebSocket from "ws";
import { createClient } from "graphql-ws";

let nextPort = 4300 + Math.floor(Math.random() * 500);
export const freePort = () => nextPort++;

export async function boot(env = {}) {
  Object.assign(process.env, env);
  const port = freePort();
  const { bootstrap } = await import("../dist/src/main.js");
  const app = await bootstrap(port);
  const gql = (query, { sid, plant, variables, path = "/graphql", headers = {} } = {}) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(sid ? { cookie: `northmes_session=${sid}` } : {}),
        ...(plant ? { "x-northmes-plant": plant } : {}),
        ...headers,
      },
      body: JSON.stringify({ query, variables }),
    }).then((r) => r.json());
  return { app, port, gql };
}

export function wsClient(port, sid) {
  class CookieWS extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, sid ? { headers: { cookie: `northmes_session=${sid}` } } : {});
    }
  }
  return createClient({ url: `ws://127.0.0.1:${port}/graphql`, webSocketImpl: CookieWS, lazy: false, retryAttempts: 0 });
}

export function collect(client, query, n, ms = 3000) {
  const events = [];
  let resolve;
  const done = new Promise((r) => (resolve = r));
  const timer = setTimeout(() => resolve(), ms);
  client.subscribe({ query }, {
    next: (v) => { events.push(v); if (events.length >= n) { clearTimeout(timer); resolve(); } },
    error: (e) => { events.push({ transportError: String(e?.message ?? e) }); clearTimeout(timer); resolve(); },
    complete: () => {},
  });
  return { events, done };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
