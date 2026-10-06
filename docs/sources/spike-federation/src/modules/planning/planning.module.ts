import { Inject, Injectable, Module } from "@nestjs/common";
import {
  Args,
  Context,
  Field,
  ID,
  Int,
  Mutation,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";
import { connectionOf, entityRef, toConnection } from "../../sdk/types.js";
import { RequirePermission } from "../../sdk/permission.js";
import type { SubgraphContext } from "../../sdk/context.js";

/** By-name stub for core's Article; planning adds openOrderCount to it. */
export const ArticleRef = entityRef("Article", () => PlanningModule);

@ObjectType("ProductionOrder", { registerIn: () => PlanningModule })
export class ProductionOrder {
  @Field(() => ID) id: string;
  @Field(() => String) number: string;
  @Field(() => ID) plantId: string;
  @Field(() => Int) quantity: number;
  @Field(() => Int) version: number;
  /** Stays on the row; the article field below turns it into an entity reference. */
  articleId: string;
}

const ProductionOrderConnection = connectionOf(ProductionOrder, "ProductionOrder", () => PlanningModule);

@ObjectType("PlanningBoardChange", { registerIn: () => PlanningModule })
export class PlanningBoardChange {
  @Field(() => ID) plantId: string;
  @Field(() => String) kind: string;
  @Field(() => ProductionOrder) productionOrder: ProductionOrder;
}

/** Stand-in for the event tail of internal research note 07 (LISTEN plus read from core.event). */
export const boardEvents = new PubSub();
export const BOARD_CHANGED = "planning.board.changed";

@Injectable()
export class OrderRepo {
  rows: ProductionOrder[] = [
    { id: "po1", number: "4101", plantId: "P1", quantity: 100, version: 1, articleId: "a1" },
    { id: "po2", number: "4102", plantId: "P1", quantity: 400, version: 1, articleId: "a2" },
    { id: "po3", number: "4103", plantId: "P2", quantity: 50, version: 1, articleId: "a1" },
    { id: "po4", number: "4104", plantId: "P1", quantity: 10, version: 1, articleId: "a404" },
  ];
  constructor() {
    if (process.env.SPIKE_NO_UNKNOWN === "1") this.rows = this.rows.filter((r) => r.articleId !== "a404");
    const extra = Number(process.env.SPIKE_ORDERS ?? 0);
    for (let i = 0; i < extra; i++) {
      this.rows.push({ id: `pox${i}`, number: `9${i}`, plantId: "P1", quantity: i, version: 1, articleId: i % 2 ? "a1" : "a2" });
    }
  }
  forPlant(plantId: string) {
    return this.rows.filter((r) => r.plantId === plantId);
  }
}

function activePlant(ctx: SubgraphContext): string {
  const plant = ctx.principal?.activePlantId;
  if (!plant) throw new GraphQLError("No active plant", { extensions: { code: "FORBIDDEN" } });
  return plant;
}

@Resolver(() => ProductionOrder)
@RequirePermission("planning.productionOrder:read")
export class ProductionOrderResolver {
  constructor(@Inject(OrderRepo) private readonly repo: OrderRepo) {}

  @Query(() => ProductionOrderConnection)
  planningProductionOrders(
    @Args("first", { type: () => Int, defaultValue: 25 }) first: number,
    @Context() ctx: SubgraphContext,
  ) {
    return toConnection(this.repo.forPlant(activePlant(ctx)), Math.min(first, 100));
  }

  @ResolveField(() => ArticleRef, { nullable: true })
  article(@Parent() order: ProductionOrder) {
    // A reference only: the gateway fetches the rest from core through _entities.
    return { __typename: "Article", id: order.articleId };
  }

  @Mutation(() => ProductionOrder)
  @RequirePermission("planning.batchRow:schedule")
  async planningMoveProductionOrder(
    @Args("id", { type: () => ID }) id: string,
    @Context() ctx: SubgraphContext,
  ) {
    const row = this.repo.forPlant(activePlant(ctx)).find((r) => r.id === id);
    if (!row) throw new GraphQLError("Not found", { extensions: { code: "NOT_FOUND", errorCode: "planning.production_order.not_found" } });
    row.version++;
    await boardEvents.publish(BOARD_CHANGED, { plantId: row.plantId, kind: "moved", productionOrder: { ...row } });
    return row;
  }

  @Subscription(() => PlanningBoardChange, {
    filter: (payload: PlanningBoardChange, variables: { plantId: string }, ctx: SubgraphContext) =>
      payload.plantId === variables.plantId && !!ctx.principal?.plantIds.includes(payload.plantId),
    resolve: (payload: PlanningBoardChange) => payload,
  })
  @RequirePermission("planning.productionOrder:read")
  planningBoardChanged(@Args("plantId", { type: () => ID }) plantId: string, @Context() ctx: SubgraphContext) {
    if (!ctx.principal?.plantIds.includes(plantId)) {
      throw new GraphQLError(`No access to plant ${plantId}`, { extensions: { code: "FORBIDDEN" } });
    }
    return boardEvents.asyncIterableIterator(BOARD_CHANGED);
  }
}

@Resolver(() => ArticleRef)
@RequirePermission("planning.productionOrder:read")
export class PlanningArticleResolver {
  constructor(@Inject(OrderRepo) private readonly repo: OrderRepo) {}

  // Nullable on purpose: a field one module adds to another module's entity must
  // not null the owner's whole object when it fails or is forbidden.
  @ResolveField(() => Int, { nullable: process.env.SPIKE_NONNULL_CONTRIBUTED !== "1" })
  openOrderCount(@Parent() article: { id: string }, @Context() ctx: SubgraphContext) {
    return this.repo.forPlant(activePlant(ctx)).filter((r) => r.articleId === article.id).length;
  }
}

@Module({ providers: [OrderRepo, ProductionOrderResolver, PlanningArticleResolver] })
export class PlanningModule {}
