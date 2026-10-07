// The earlier attempt's bug: without fieldResolverEnhancers, guards do not run on
// @ResolveField or @ResolveReference handlers, so entity fields skip permission checks.
import { afterAll, beforeAll, expect, it } from "vitest";
import { boot } from "./helpers.mjs";

let ctx;
beforeAll(async () => {
  ctx = await boot({ SPIKE_NO_ENHANCERS: "1" });
});
afterAll(async () => ctx.app.close());

it("bob (no planning permission) reads planning's Article.openOrderCount when enhancers are off", async () => {
  const r = await ctx.gql(`{ coreArticle(id: "a1") { name openOrderCount } }`, { sid: "sid-bob" });
  expect(r.errors).toBeUndefined();
  expect(r.data.coreArticle.openOrderCount).toBe(1);
});
