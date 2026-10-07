// A plugin with two contract mistakes, to check that composition fails at boot with a clear message.
import { Module } from "@nestjs/common";
import { Directive, Int, Parent, Query, ResolveField, Resolver } from "@nestjs/graphql";
import { entityRef } from "../../src/sdk/types.js";
import { Public } from "../../src/sdk/permission.js";

// Mistake 1: core's Article.name is String!, this says Int!.
const ArticleRef = entityRef("Article", () => BrokenModule, { external: { name: { type: () => Int } } });

@Resolver(() => ArticleRef)
export class BrokenArticleResolver {
  @ResolveField(() => String, { nullable: true })
  @Directive('@requires(fields: "name")')
  @Public()
  brokenLabel(@Parent() a: { id: string }) {
    return a.id;
  }
}

@Resolver()
export class BrokenQueryResolver {
  // Mistake 2: root field without the module prefix.
  @Query(() => String)
  @Public()
  ping() {
    return "pong";
  }
}

@Module({ providers: [BrokenArticleResolver, BrokenQueryResolver] })
export class BrokenModule {}
