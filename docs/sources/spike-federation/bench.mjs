import 'reflect-metadata';
import { execute, parse } from 'graphql';
const mode = process.env.SUBGRAPH_MODE ?? 'inproc';
process.env.SPIKE_PLUGINS = 'hello';
process.env.SPIKE_ORDERS = process.env.SPIKE_ORDERS ?? '23'; process.env.SPIKE_NO_UNKNOWN = '1'; // 2 + 23 = 25 rows at P1
const port = Number(process.env.PORT ?? 4110);
const { bootstrap } = await import('./dist/src/main.js');
const { SubgraphRegistry, signPrincipal } = await import('./dist/src/sdk/subgraph.js');
const { resolvePrincipal } = await import('./dist/src/gateway/sessions.js');
const app = await bootstrap(port);
const principal = resolvePrincipal('northmes_session=sid-alice');
const Q_PLAN = '{ planningProductionOrders { edges { node { number article { id } } } } }';
const Q_CROSS = '{ planningProductionOrders { edges { node { number article { id name openOrderCount } } } } }';
const Q_CROSS3 = '{ planningProductionOrders { edges { node { number article { id name openOrderCount helloGreeting } } } } }';
const url = `http://127.0.0.1:${port}`;
const post = (path, q, headers) => fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ query: q }) }).then(r => r.json());
const gw = (q) => post('/graphql', q, { cookie: 'northmes_session=sid-alice' });
const scenarios = [];
if (mode === 'inproc') {
  const schema = app.get(SubgraphRegistry).get('planning').schema;
  const doc = parse(Q_PLAN);
  scenarios.push(['planning subgraph, in-process execute (no HTTP)', () => execute({ schema, document: doc, contextValue: { principal, requestId: 'b', loaders: new Map(), subgraph: 'planning' } })]);
} else {
  scenarios.push(['planning subgraph, direct HTTP (Apollo)', () => post('/subgraphs/planning', Q_PLAN, { 'x-northmes-principal': signPrincipal(principal, 'b') })]);
}
scenarios.push(['gateway, planning only', () => gw(Q_PLAN)]);
scenarios.push(['gateway, planning + core + planning (_entities)', () => gw(Q_CROSS)]);
scenarios.push(['gateway, planning + core + planning + hello (@requires)', () => gw(Q_CROSS3)]);
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
async function measure(fn, n) {
  const t = [];
  for (let i = 0; i < n; i++) { const s = process.hrtime.bigint(); const r = await fn(); if (r.errors) throw new Error(JSON.stringify(r.errors)); t.push(Number(process.hrtime.bigint() - s) / 1e6); }
  t.sort((a, b) => a - b); return t;
}
async function throughput(fn, conc, ms) {
  let count = 0; const end = Date.now() + ms;
  await Promise.all(Array.from({ length: conc }, async () => { while (Date.now() < end) { await fn(); count++; } }));
  return count / (ms / 1000);
}
const rows = [];
for (const [name, fn] of scenarios) {
  await measure(fn, 300); // warm up
  const t = await measure(fn, 2000);
  const rps = await throughput(fn, 16, 3000);
  rows.push({ mode, scenario: name, p50_ms: pct(t, 0.5).toFixed(2), p95_ms: pct(t, 0.95).toFixed(2), p99_ms: pct(t, 0.99).toFixed(2), rps_c16: Math.round(rps) });
}
console.table(rows);
console.log(JSON.stringify(rows));
await app.close();
