import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { GraphQLError } from "graphql";
import type { SubgraphContext } from "./context.js";

const PERMISSION_KEY = "northmes:permission";
const PUBLIC_KEY = "northmes:public";

/** Class or method level. Method wins over class. */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
/** Explicit opt-out, so "no decorator" can be a boot error instead of an open door. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const guardLog: string[] = [];

/**
 * Global guard. With fieldResolverEnhancers: ["guards"] it also runs on every
 * @ResolveField, including fields reached through _entities.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType<string>() !== "graphql") return true;
    const gql = GqlExecutionContext.create(context);
    const info = gql.getInfo();
    const ctx = gql.getContext<SubgraphContext>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets);
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, targets);
    guardLog.push(`${ctx?.subgraph ?? "?"}:${info?.parentType?.name}.${info?.fieldName}:${permission ?? (isPublic ? "public" : "none")}`);
    if (isPublic) return true;
    if (!permission) {
      throw new GraphQLError(`No permission declared for ${info?.parentType?.name}.${info?.fieldName}`, {
        extensions: { code: "INTERNAL_SERVER_ERROR", errorCode: "core.permission_missing" },
      });
    }
    const principal = ctx?.principal;
    if (!principal) {
      throw new GraphQLError("Not signed in", { extensions: { code: "UNAUTHENTICATED" } });
    }
    if (!principal.permissions.has(permission)) {
      throw new GraphQLError(`Missing permission ${permission}`, {
        extensions: { code: "FORBIDDEN", errorCode: "core.forbidden", permission },
      });
    }
    return true;
  }
}
