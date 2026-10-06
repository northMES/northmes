// Example plugin. Imports only the SDK (MIT) and @nestjs/* (MIT); no core class.
import { Module } from "@nestjs/common";
import { Directive, Field, Parent, Query, ResolveField, Resolver } from "@nestjs/graphql";
import { entityRef } from "../../src/sdk/types.js";
import { Public, RequirePermission } from "../../src/sdk/permission.js";

/** Article by name and key; `name` is owned by core and only @required here. */
const ArticleRef = entityRef("Article", () => HelloModule, { external: { name: { type: () => String } } });

@Resolver(() => ArticleRef)
@RequirePermission("hello.read")
export class HelloArticleResolver {
  @ResolveField(() => String, { nullable: true })
  @Directive('@requires(fields: "name")')
  helloGreeting(@Parent() article: { id: string; name?: string }) {
    return `Hello, ${article.name ?? "(name not provided)"} (${article.id})`;
  }
}

@Resolver()
export class HelloQueryResolver {
  @Query(() => String)
  @Public()
  helloPing() {
    return "pong";
  }
}

@Module({ providers: [HelloArticleResolver, HelloQueryResolver] })
export class HelloModule {}
