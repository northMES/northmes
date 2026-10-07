const port = Number(process.env.GW_PORT);
const Q_PLAN = '{ planningProductionOrders { edges { node { number article { id } } } } }';
const Q_CROSS = '{ planningProductionOrders { edges { node { number article { id name openOrderCount } } } } }';
const Q_CROSS3 = '{ planningProductionOrders { edges { node { number article { id name openOrderCount helloGreeting } } } } }';
const gw = (q) => fetch(`http://127.0.0.1:${port}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'northmes_session=sid-alice' }, body: JSON.stringify({ query: q }) }).then(r => r.json());
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
async function measure(fn, n) { const t = []; for (let i = 0; i < n; i++) { const s = process.hrtime.bigint(); const r = await fn(); if (r.errors) throw new Error(JSON.stringify(r.errors)); t.push(Number(process.hrtime.bigint() - s) / 1e6); } t.sort((a, b) => a - b); return t; }
async function throughput(fn, conc, ms) { let c = 0; const end = Date.now() + ms; await Promise.all(Array.from({ length: conc }, async () => { while (Date.now() < end) { await fn(); c++; } })); return c / (ms / 1000); }
const rows = [];
for (const [name, q] of [['separate gateway process, planning only', Q_PLAN], ['separate gateway process, planning + core + planning', Q_CROSS], ['separate gateway process, + hello (@requires)', Q_CROSS3]]) {
  const fn = () => gw(q); await measure(fn, 300); const t = await measure(fn, 2000); const rps = await throughput(fn, 16, 3000);
  rows.push({ mode: 'separate', scenario: name, p50_ms: pct(t, .5).toFixed(2), p95_ms: pct(t, .95).toFixed(2), p99_ms: pct(t, .99).toFixed(2), rps_c16: Math.round(rps) });
}
console.table(rows); console.log(JSON.stringify(rows));
