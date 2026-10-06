import type { Principal } from "@northmes/sdk";

/** Stand-in for Better Auth getSession plus the plant role lookup. */
const USERS: Record<string, { userId: string; plants: Record<string, string[]> }> = {
  "sid-alice": {
    userId: "alice",
    plants: {
      P1: ["core.article:read", "planning.productionOrder:read", "planning.productionOrder:release", "exampleValidator.rule:read"],
      P2: ["core.article:read"],
    },
  },
  "sid-bob": { userId: "bob", plants: { P1: ["core.article:read"] } },
};

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  return header?.split(";").map((c) => c.trim().split("=")).find(([k]) => k === name)?.[1];
}

export function resolvePrincipal(cookieHeader: string | null | undefined, requestedPlant?: string | null): Principal | null {
  const sid = readCookie(cookieHeader, "northmes_session");
  const user = sid ? USERS[sid] : undefined;
  if (!user) return null;
  const plantIds = Object.keys(user.plants);
  const activePlantId = requestedPlant && plantIds.includes(requestedPlant) ? requestedPlant : plantIds[0]!;
  return { userId: user.userId, plantIds, activePlantId, permissions: new Set(user.plants[activePlantId]) };
}
