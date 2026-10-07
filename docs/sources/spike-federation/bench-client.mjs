// Client-only benchmark: run in its own process against a server started separately.
const { signPrincipal } = await import('./dist/src/sdk/subgraph.js');
const { resolvePrincipal } = await import('./dist/src/gateway/sessions.js');
const base = process.env.TARGET; const label = process.env.LABEL;
const Q = {
  plan: '{ planningProductionOrders { edges { node { number article { id } } } } }',
  cross: '{ planningProductionOrders { edges { node { number article { id name openOrderCount } } } } }',
  cross3: '{ planningProductionOrders { edges { node { number article { id name openOrderCount helloGreeting } } } } }',
};
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const post = (path, q, headers) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ query: q }) }).then(r => r.json());
async function measure(fn, n) { const t = []; for (let i = 0; i < n; i++) { const s = process.hrtime.bigint(); const r = await fn(); if (r.errors) throw new Error(JSON.stringify(r.errors)); t.push(Number(process.hrtime.bigint() - s) / 1e6); } t.sort((a, b) => a - b); return t; }
async function throughput(fn, conc, ms) { let c = 0; const end = Date.now() + ms; await Promise.all(Array.from({ length: conc }, async () => { while (Date.now() < end) { await fn(); c++; } })); return c / (ms / 1000); }
const scen = [];
if (process.env.DIRECT === '1') scen.push(['planning subgraph direct (Apollo HTTP)', () => post('/subgraphs/planning', Q.plan, { 'x-northmes-principal': signPrincipal(resolvePrincipal('northmes_session=sid-alice'), 'b') })]);
scen.push(['gateway: planning only', () => post('/graphql', Q.plan, { cookie: 'northmes_session=sid-alice' })]);
scen.push(['gateway: planning + core + planning', () => post('/graphql', Q.cross, { cookie: 'northmes_session=sid-alice' })]);
scen.push(['gateway: + hello @requires', () => post('/graphql', Q.cross3, { cookie: 'northmes_session=sid-alice' })]);
const rows = [];
for (const [name, fn] of scen) { await measure(fn, 300); const t = await measure(fn, 2000); const rps = await throughput(fn, 16, 3000); rows.push({ setup: label, scenario: name, p50: +pct(t, .5).toFixed(2), p95: +pct(t, .95).toFixed(2), p99: +pct(t, .99).toFixed(2), rps_c16: Math.round(rps) }); }
console.log(JSON.stringify(rows));
