// Hive Gateway runtime in its own process (what the gateway container would run),
// reaching the Nest app's /subgraphs/* over loopback HTTP and graphql-ws.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createGatewayRuntime } from '@graphql-hive/gateway-runtime';
import httpTransport from '@graphql-mesh/transport-http';
import wsTransport from '@graphql-mesh/transport-ws';
const { resolvePrincipal } = await import('./dist/src/gateway/sessions.js');
const { signPrincipal, PRINCIPAL_HEADER } = await import('./dist/src/sdk/subgraph.js');
const runtime = createGatewayRuntime({
  supergraph: readFileSync(process.env.SUPERGRAPH, 'utf8'),
  landingPage: false, graphiql: false,
  transports: { http: httpTransport, ws: wsTransport },
  transportEntries: { '*.http': { headers: [[PRINCIPAL_HEADER, '{context.principalHeader}']] } },
  plugins: () => [{ onContextBuilding({ context, extendContext }) {
    const principal = resolvePrincipal(context.request?.headers?.get?.('cookie'), context.request?.headers?.get?.('x-northmes-plant'));
    const requestId = randomUUID();
    extendContext({ principal, requestId, principalHeader: signPrincipal(principal, requestId) });
  } }],
});
await runtime.getSchema();
createServer(runtime).listen(Number(process.env.GW_PORT), '127.0.0.1', () => console.log('standalone gateway on', process.env.GW_PORT));
