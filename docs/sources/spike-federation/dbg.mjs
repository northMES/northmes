import 'reflect-metadata';
import { InProcessSubgraphDriver } from './dist/src/sdk/subgraph.js';
const orig = InProcessSubgraphDriver.prototype.generateSchema;
InProcessSubgraphDriver.prototype.generateSchema = async function (o) {
  try { const s = await orig.call(this, o); console.log('OK', o.subgraphName, Object.keys(s.getTypeMap()).filter(n=>!n.startsWith('__')).join(',')); return s; }
  catch (e) { console.log('FAIL', o.subgraphName, e.message); throw e; }
};
const { bootstrap } = await import('./dist/src/main.js');
try { const app = await bootstrap(4102); await app.close(); } catch (e) { console.log("boot failed", e.stack); }
