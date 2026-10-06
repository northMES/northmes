import { Inject, Injectable, Module } from "@nestjs/common";
import {
  Args, Context, Directive, Field, ID, Int, Mutation, ObjectType, Parent, Query, ResolveField,
  ResolveReference, Resolver, Subscription,
} from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";
import {
  COMMAND_BUS, type CommandBus, connectionOf, entityRef, RequirePermission, type SubgraphContext, toConnection,
} from "@northmes/sdk";
import { ArticleService, CoreApiModule } from "@northmes/module-core/api";
import { CoreModule } from "@northmes/module-core/graphql";

/** Core's Article, referenced by name and key only. */
export const ArticleRef = entityRef("Article", () => PlanningModule);

@ObjectType("ProductionOrder", { registerIn: () => PlanningModule })
@Directive('@key(fields: "id")')
export class ProductionOrder {
  @Field(() => ID) id: string;
  @Field(() => String) number: string;
  @Field(() => ID) plantId: string;
  @Field(() => Int) quantity: number;
  @Field(() => String) status: string;
  @Field(() => Int) version: number;
  articleId: string;
}

const ProductionOrderConnection = connectionOf(ProductionOrder, "ProductionOrder", () => PlanningModule);

@ObjectType("PlanningBoardChange", { registerIn: () => PlanningModule })
export class PlanningBoardChange {
  @Field(() => ID) plantId: string;
  @Field(() => String) kind: string;
  @Field(() => ProductionOrder) productionOrder: ProductionOrder;
}

/** Stand-in for the event tail in internal research note 07. */
export const boardEvents = new PubSub();

@Injectable()
export class ProductionOrderService {
  rows: ProductionOrder[] = [
    { id: "po1", number: "4101", plantId: "P1", quantity: 100, status: "PLANNED", version: 1, articleId: "a1" },
    { id: "po2", number: "4102", plantId: "P1", quantity: 400, status: "PLANNED", version: 1, articleId: "a2" },
    { id: "po3", number: "4103", plantId: "P1", quantity: 1500, status: "PLANNED", version: 1, articleId: "a1" },
    { id: "po4", number: "4104", plantId: "P2", quantity: 50, status: "PLANNED", version: 1, articleId: "a1" },
  ];
  forPlant(plantId: string) {
    return this.rows.filter((r) => r.plantId === plantId);
  }
}

const activePlant = (ctx: SubgraphContext) => {
  const plant = ctx.principal?.activePlantId;
  if (!plant) throw new GraphQLError("No active plant", { extensions: { code: "FORBIDDEN" } });
  return plant;
};

@Resolver(() => ProductionOrder)
@RequirePermission("planning.productionOrder:read")
export class ProductionOrderResolver {
  constructor(
    @Inject(ProductionOrderService) private readonly orders: ProductionOrderService,
    @Inject(COMMAND_BUS) private readonly bus: CommandBus,
    @Inject(ArticleService) private readonly articles: ArticleService,
  ) {}

  /** A command that calls core's public service API synchronously, in process. */
  @Mutation(() => ProductionOrder)
  @RequirePermission("planning.productionOrder:release")
  async planningCreateProductionOrder(
    @Args("articleId", { type: () => ID }) articleId: string,
    @Args("quantity", { type: () => Int }) quantity: number,
    @Context() ctx: SubgraphContext,
  ) {
    if (!(await this.articles.exists(articleId))) {
      throw new GraphQLError(`Unknown article ${articleId}`, { extensions: { code: "BAD_USER_INPUT", errorCode: "planning.article.unknown" } });
    }
    const row = { id: `po${this.orders.rows.length + 1}`, number: String(4101 + this.orders.rows.length), plantId: activePlant(ctx), quantity, status: "PLANNED", version: 1, articleId };
    this.orders.rows.push(row);
    return row;
  }

  @Query(() => ProductionOrderConnection)
  planningProductionOrders(@Args("first", { type: () => Int, defaultValue: 25 }) first: number, @Context() ctx: SubgraphContext) {
    return toConnection(this.orders.forPlant(activePlant(ctx)), Math.min(first, 100));
  }

  @ResolveField(() => ArticleRef, { nullable: true })
  article(@Parent() order: ProductionOrder) {
    return { __typename: "Article", id: order.articleId };
  }

  @ResolveReference()
  resolveReference(@Parent() ref: { id: string }) {
    return this.orders.rows.find((r) => r.id === ref.id) ?? null;
  }

  @Mutation(() => ProductionOrder)
  @RequirePermission("planning.productionOrder:release")
  planningReleaseProductionOrder(@Args("id", { type: () => ID }) id: string, @Context() ctx: SubgraphContext) {
    const row = this.orders.forPlant(activePlant(ctx)).find((r) => r.id === id);
    if (!row) throw new GraphQLError("Not found", { extensions: { code: "NOT_FOUND", errorCode: "planning.production_order.not_found" } });
    const input = { productionOrderId: row.id, quantity: row.quantity, plantId: row.plantId };
    return this.bus.run("planning.releaseProductionOrder", input, ctx, async () => {
      row.status = "RELEASED";
      row.version++;
      await boardEvents.publish("board", { plantId: row.plantId, kind: "released", productionOrder: { ...row } });
      return row;
    });
  }

  @Subscription(() => PlanningBoardChange, {
    filter: (p: PlanningBoardChange, v: { plantId: string }, ctx: SubgraphContext) =>
      p.plantId === v.plantId && !!ctx.principal?.plantIds.includes(p.plantId),
    resolve: (p: PlanningBoardChange) => p,
  })
  planningBoardChanged(@Args("plantId", { type: () => ID }) plantId: string, @Context() ctx: SubgraphContext) {
    if (!ctx.principal?.plantIds.includes(plantId)) throw new GraphQLError(`No access to plant ${plantId}`, { extensions: { code: "FORBIDDEN" } });
    return boardEvents.asyncIterableIterator("board");
  }
}

// SPIKE_PLANNING_IMPORTS=core-graphql imports core's resolver module instead of its API module (leak test).
@Module({
  imports: [process.env.SPIKE_PLANNING_IMPORTS === "core-graphql" ? CoreModule : CoreApiModule],
  providers: [ProductionOrderService, ProductionOrderResolver],
  exports: [ProductionOrderService],
})
export class PlanningModule {}
export default PlanningModule;
