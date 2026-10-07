import { Injectable, Module } from "@nestjs/common";
import { Directive, Int, Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { type CommandContext, CommandValidator, entityRef, RequirePermission } from "@northmes/sdk";
import ms from "ms";

/** Planning's ProductionOrder by name and key; quantity is planning's field, only @required here. */
const ProductionOrderRef = entityRef("ProductionOrder", () => ExampleValidatorModule, {
  external: { quantity: { type: () => Int } },
});

export const MAX_QUANTITY = 1000;
const blockReason = (quantity: number) => (quantity > MAX_QUANTITY ? `Quantity ${quantity} is above the release limit ${MAX_QUANTITY}` : null);

@Injectable()
export class ReleaseLimitValidator {
  @CommandValidator("planning.releaseProductionOrder", { timeoutMs: ms("2s") })
  check(input: { quantity: number }, _ctx: CommandContext) {
    const reason = blockReason(input.quantity);
    return reason ? { reject: reason } : undefined;
  }
}

@Resolver(() => ProductionOrderRef)
@RequirePermission("exampleValidator.rule:read")
export class BlockReasonResolver {
  @ResolveField(() => String, { nullable: true })
  @Directive('@requires(fields: "quantity")')
  exampleValidatorBlockReason(@Parent() order: { id: string; quantity: number }) {
    return blockReason(order.quantity);
  }
}

@Module({ providers: [ReleaseLimitValidator, BlockReasonResolver] })
export class ExampleValidatorModule {}
export default ExampleValidatorModule;
