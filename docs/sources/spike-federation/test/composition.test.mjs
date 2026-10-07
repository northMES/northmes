// Pure SDL tests of the earlier attempt's composition failures, against
// @theguild/federation-composition 0.27.0 (what the spike composes with).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parse } from "graphql";
import { composeServices } from "@theguild/federation-composition";
const gql = (strings) => parse(strings.join(""));
const nestFile = (rel) => readFileSync(fileURLToPath(import.meta.resolve("@nestjs/graphql")).replace(/index\.js$/, rel), "utf8");
import { composeSupergraph, SupergraphCompositionError } from "../dist/src/gateway/compose.js";

const link = (v = "v2.9") =>
  `extend schema @link(url: "https://specs.apollo.dev/federation/${v}", import: ["@key", "@shareable", "@external", "@requires"])`;
const sg = (name, sdl, v) => ({ name, url: `inproc://${name}`, sdl: `${link(v)}\n${sdl}` });
const codes = (fn) => {
  try {
    fn();
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(SupergraphCompositionError);
    return e.details.map((d) => d.code);
  }
};

const pageInfo = (shareable) => `type PageInfo ${shareable ? "@shareable" : ""} { hasNextPage: Boolean! endCursor: String }`;

describe("composition rules", () => {
  it("PageInfo emitted by two subgraphs needs @shareable", () => {
    const a = (s) => sg("core", `${pageInfo(s)} type ArticleConnection { pageInfo: PageInfo! } type Query { coreArticles: ArticleConnection! }`);
    const b = (s) => sg("planning", `${pageInfo(s)} type OrderConnection { pageInfo: PageInfo! } type Query { planningOrders: OrderConnection! }`);
    expect(codes(() => composeSupergraph([a(false), b(false)]))).toContain("INVALID_FIELD_SHARING");
    expect(codes(() => composeSupergraph([a(true), b(true)]))).toEqual([]);
  });

  it("same enum name with different values breaks composition when used in an input", () => {
    const a = sg("process", `enum LossCategory { BREAKDOWN SETUP } input LossFilter { category: LossCategory } type Query { processLosses(f: LossFilter): Int }`);
    const b = sg("analyzing", `enum LossCategory { AVAILABILITY QUALITY } input FactFilter { category: LossCategory } type Query { analyzingFacts(f: FactFilter): Int }`);
    const c = codes(() => composeSupergraph([a, b]));
    console.log("duplicate enum in input:", c);
    expect(c.length).toBeGreaterThan(0);
  });

  it("same enum name used only in outputs merges silently (values are unioned)", () => {
    const a = sg("process", `enum LossCategory { BREAKDOWN SETUP } type Query { processLoss: LossCategory }`);
    const b = sg("analyzing", `enum LossCategory { AVAILABILITY QUALITY } type Query { analyzingLoss: LossCategory }`);
    const sdl = composeServices([a, b].map((x) => ({ name: x.name, url: x.url, typeDefs: parse(x.sdl) }))).supergraphSdl;
    const enumBlock = sdl.slice(sdl.indexOf("enum LossCategory"), sdl.indexOf("}", sdl.indexOf("enum LossCategory")));
    console.log(enumBlock.replace(/\s+/g, " "));
    expect(enumBlock).toContain("BREAKDOWN");
    expect(enumBlock).toContain("QUALITY");
  });

  it("NorthMES rule: an enum or value type name lives in one module (catches the silent enum merge)", () => {
    const a = sg("process", `enum LossCategory { BREAKDOWN SETUP } type Query { processLoss: LossCategory }`);
    const b = sg("analyzing", `enum LossCategory { AVAILABILITY QUALITY } type Query { analyzingLoss: LossCategory }`);
    expect(codes(() => composeSupergraph([a, b]))).toEqual(["NORTHMES_TYPE_OWNERSHIP"]);
  });

  it("NorthMES rule: a field added to another module's entity must be nullable", () => {
    const core = sg("core", `type Article @key(fields: "id") { id: ID! name: String! } type Query { coreArticle(id: ID!): Article }`);
    const planning = { ...sg("planning", `type Article @key(fields: "id") { id: ID! openOrderCount: Int! } type Query { planningX: Int }`), refTypes: ["Article"] };
    expect(codes(() => composeSupergraph([core, planning]))).toEqual(["NORTHMES_CONTRIBUTED_FIELD_NULLABLE"]);
  });

  it("an @external field must match the owner's type, nullability included", () => {
    const core = sg("core", `type Article @key(fields: "id") { id: ID! name: String! } type Query { coreArticle(id: ID!): Article }`);
    const plugin = sg("hello", `type Article @key(fields: "id") { id: ID! name: String @external helloGreeting: String @requires(fields: "name") } type Query { helloPing: String }`);
    expect(codes(() => composeSupergraph([core, plugin]))).toEqual(expect.arrayContaining(["FIELD_TYPE_MISMATCH", "EXTERNAL_TYPE_MISMATCH"]));
  });

  it("Nest 14's default federation link (v2.14) is unknown to federation-composition 0.27.0", () => {
    const nestDefault = nestFile("federation/type-defs-federation2.decorator.js");
    expect(nestDefault).toContain("federation/v2.14");
    const core = sg("core", `type Article @key(fields: "id") { id: ID! } type Query { coreArticle: Article }`, "v2.14");
    expect(codes(() => composeSupergraph([core]))).toContain("UNKNOWN_FEDERATION_LINK_VERSION");
    const v29 = sg("core", `type Article @key(fields: "id") { id: ID! } type Query { coreArticle: Article }`, "v2.9");
    expect(codes(() => composeSupergraph([v29]))).toEqual([]);
  });

  it("root fields must carry the module prefix (NorthMES rule, checked before composition)", () => {
    const a = sg("planning", `type Query { productionOrders: Int planningOrders: Int } type Subscription { boardChanged: Int }`);
    const c = codes(() => composeSupergraph([a]));
    expect(c.filter((x) => x === "NORTHMES_ROOT_FIELD_PREFIX")).toHaveLength(2);
  });

  it("two subgraphs defining the same root field fail without @shareable", () => {
    const a = sg("core", `type Query { coreArticleCount: Int }`);
    const b = sg("core2", `type Query { coreArticleCount: Int }`);
    // prefix rule aside, composition itself refuses the shared root field
    const c = codes(() => composeSupergraph([a, { ...b, name: "core" + "X" }]));
    expect(c).toContain("INVALID_FIELD_SHARING");
  });

  it("namespace objects (ADR-014 style) shared by two subgraphs", () => {
    const a = sg("planning", `type PlanningQuery @shareable { orders: Int } type Query { planning: PlanningQuery @shareable }`);
    const b = sg("hello", `type PlanningQuery @shareable { helloOrders: Int } type Query { planning: PlanningQuery @shareable }`);
    // Bypass the NorthMES prefix rule to see what composition itself says.
    const r = composeServices([a, b].map((x) => ({ name: x.name, url: x.url, typeDefs: parse(x.sdl) })));
    console.log("shared namespace:", r.errors ? r.errors.map((e) => e.extensions?.code) : "composed");
    expect(r.errors).toBeUndefined();
  });
});

describe("@apollo/subgraph 2.15.x input shape", () => {
  const { buildSubgraphSchema } = createRequire(import.meta.url)("@apollo/subgraph");
  const typeDefs = gql`type Query { x: Int }`;
  it("rejects the single { typeDefs, resolvers } object that @nestjs/graphql 14.0.0 and 14.0.1 passed", () => {
    expect(() => buildSubgraphSchema({ typeDefs, resolvers: {} })).toThrow(/definitions is not iterable/);
  });
  it("accepts the array form that @nestjs/graphql 14.0.2+ passes", () => {
    expect(() => buildSubgraphSchema([{ typeDefs, resolvers: {} }])).not.toThrow();
    const nest = nestFile("federation/graphql-federation.factory.js");
    expect(nest).toContain("buildSubgraphSchema([{ typeDefs, resolvers }])");
  });
});
