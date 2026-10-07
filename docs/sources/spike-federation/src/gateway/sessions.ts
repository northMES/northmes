import type { Principal } from "../sdk/context.js";

/** Stand-in for Better Auth getSession plus plant_member role lookup. */
const USERS: Record<string, { userId: string; plants: Record<string, string[]> }> = {
  "sid-alice": {
    userId: "alice",
    plants: {
      P1: ["core.article:read", "planning.productionOrder:read", "planning.batchRow:schedule", "hello.read"],
      P2: ["core.article:read"],
    },
  },
  "sid-bob": { userId: "bob", plants: { P1: ["core.article:read"] } },
  "sid-carol": {
    userId: "carol",
    plants: { P2: ["core.article:read", "planning.productionOrder:read"] },
  },
};

export let sessionLookups = 0;
export const resetSessionLookups = () => {
  sessionLookups = 0;
};

export function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];
}

/** Resolve the principal once per client request (gateway side). */
export function resolvePrincipal(cookieHeader: string | null | undefined, requestedPlant?: string | null): Principal | null {
  sessionLookups++;
  const sid = readCookie(cookieHeader, "northmes_session");
  const user = sid ? USERS[sid] : undefined;
  if (!user) return null;
  const plantIds = Object.keys(user.plants);
  const activePlantId = requestedPlant && plantIds.includes(requestedPlant) ? requestedPlant : plantIds[0]!;
  return {
    userId: user.userId,
    plantIds,
    activePlantId,
    permissions: new Set(user.plants[activePlantId]),
  };
}
