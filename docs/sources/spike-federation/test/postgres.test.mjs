// Integration test shape for NorthMES: role "all" (gateway + subgraphs in one
// process) against Postgres from @testcontainers/postgresql.
import { afterAll, beforeAll, expect, it } from "vitest";
import pg from "pg";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { boot } from "./helpers.mjs";

let container;
let ctx;
beforeAll(async () => {
  container = await new PostgreSqlContainer(process.env.SPIKE_PG_IMAGE ?? "postgres:18.4-alpine").withDatabase("northmes_test").start();
  const client = new pg.Client({ connectionString: container.getConnectionUri() });
  await client.connect();
  await client.query(`create schema core;
    create table core.article (id text primary key, code text not null, name text not null, status text not null);
    insert into core.article values ('a1','TT-100','Table top','ACTIVE'), ('a2','LG-200','Leg','ACTIVE');`);
  await client.end();
  ctx = await boot({ DATABASE_URL: container.getConnectionUri(), SPIKE_ORDERS: "40", SPIKE_NO_UNKNOWN: "1" });
});
afterAll(async () => {
  await ctx?.app.close();
  await container?.stop();
});

it("serves a cross-subgraph query from Postgres with one SQL query for all _entities", async () => {
  const { ArticleRepo } = await import("../dist/src/modules/core/core.module.js");
  const repo = ctx.app.get(ArticleRepo);
  const before = repo.sqlQueries;
  const r = await ctx.gql(`{ planningProductionOrders(first: 42) { edges { node { number article { id name } } } } }`, { sid: "sid-alice" });
  expect(r.errors).toBeUndefined();
  expect(r.data.planningProductionOrders.edges).toHaveLength(42);
  expect(r.data.planningProductionOrders.edges[0].node.article.name).toBe("Table top");
  expect(repo.sqlQueries - before).toBe(1);
});
