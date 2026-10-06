import 'reflect-metadata';
import WebSocket from 'ws';
import { createClient } from 'graphql-ws';
const port = Number(process.env.PORT ?? 4105);
const { bootstrap } = await import('./dist/src/main.js');
const app = await bootstrap(port);
class CookieWS extends WebSocket { constructor(url, protocols) { super(url, protocols, { headers: { cookie: 'northmes_session=sid-alice' } }); } }
const client = createClient({ url: `ws://127.0.0.1:${port}/graphql`, webSocketImpl: CookieWS, lazy: false });
const events = [];
const done = new Promise((resolve, reject) => {
  client.subscribe({ query: 'subscription { planningBoardChanged(plantId: "P1") { plantId kind productionOrder { number version article { id name } } } }' }, {
    next: (v) => { events.push(v); if (events.length === 2) resolve(); },
    error: (e) => reject(e), complete: () => {},
  });
});
await new Promise((r) => setTimeout(r, 300));
const gql = (q, sid='sid-alice') => fetch(`http://127.0.0.1:${port}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `northmes_session=${sid}` }, body: JSON.stringify({ query: q }) }).then(r => r.json());
console.log('mutation', JSON.stringify(await gql('mutation { planningMoveProductionOrder(id: "po1") { number version } }')));
console.log('mutation', JSON.stringify(await gql('mutation { planningMoveProductionOrder(id: "po2") { number version } }')));
await Promise.race([done, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]).catch(e => console.log('ERR', e.message ?? e));
console.log('events', JSON.stringify(events));
await client.dispose();
await app.close();
