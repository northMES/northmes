import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { printSchema, lexicographicSortSchema } from 'graphql';
const { bootstrap } = await import('./dist/src/main.js');
const { GatewayService } = await import('./dist/src/gateway/gateway.module.js');
const app = await bootstrap(Number(process.env.PORT));
const gw = app.get(GatewayService);
writeFileSync(process.env.OUT, gw.supergraphSdl);
import('node:fs').then(fs => fs.mkdirSync('out/subgraphs', { recursive: true }));
for (const s of gw.collectSubgraphs()) (await import('node:fs')).writeFileSync(`out/subgraphs/${s.name}.graphql`, s.sdl);
// Client-facing API schema (what codegen and schema diffs should use)
writeFileSync(process.env.OUT.replace('.graphql', '.api.graphql'), printSchema(lexicographicSortSchema(await gw.runtime.getSchema())));
if (process.env.KEEP !== '1') { await app.close(); process.exit(0); }
console.log('app up');
