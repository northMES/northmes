import type { ScheduledOperationState } from "@mes/contracts";
import type { DateTime } from "luxon";

/*
 * Who may move a row on the draft (order management plan, O-6; several
 * planners work on the board at once). A planner takes a soft lock on the
 * rows they are working on; another planner's move on a locked row is
 * refused with the owner's name, so the second planner is told rather than
 * silently overwritten; any planner may break a lock, which is audited, so
 * a colleague who went home does not block the board. Pinned rows refuse
 * every move, whoever asks. Pure: the row and the caller come in, a verdict
 * comes out.
 */

/** What the rules read off a row. */
export interface LockableRow {
  readonly id: string;
  readonly state: ScheduledOperationState;
  readonly pinned: boolean;
  readonly lockedBy: string | null;
  readonly lockedByName: string | null;
  readonly lockedAt: DateTime | null;
}

export interface Actor {
  readonly sub: string;
  readonly name: string;
}

/** A lock older than this counts as forgotten and may be taken over without breaking it. */
export const LOCK_STALE_MINUTES = 30;

export type MoveVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: "PINNED" | "LOCKED" | "STARTED";
      readonly message: string;
      /** Set when the reason is LOCKED, so the screen can offer to break it. */
      readonly lockedByName?: string;
    };

/** Whether the row's lock still counts, given the clock. */
export function lockIsLive(row: LockableRow, now: DateTime): boolean {
  if (row.lockedBy === null || row.lockedAt === null) return false;

  return now.diff(row.lockedAt, "minutes").minutes < LOCK_STALE_MINUTES;
}

/** Whether the actor holds the row's live lock. */
export function holdsLock(
  row: LockableRow,
  actor: Actor,
  now: DateTime,
): boolean {
  return lockIsLive(row, now) && row.lockedBy === actor.sub;
}

/**
 * May the actor place, move, split, unplace or repin the row? A started
 * row (IN_PROGRESS, COMPLETED) is the floor's now; a pinned row is refused
 * for everyone; a row another planner holds live is refused with their
 * name; an unlocked row, a stale lock, or the actor's own lock allows it.
 */
export function judgeMove(
  row: LockableRow,
  actor: Actor,
  now: DateTime,
): MoveVerdict {
  if (row.state === "IN_PROGRESS" || row.state === "COMPLETED") {
    return {
      allowed: false,
      reason: "STARTED",
      message: "The operation has started on the floor and cannot be moved.",
    };
  }
  if (row.pinned) {
    return {
      allowed: false,
      reason: "PINNED",
      message: "The operation is pinned; unpin it to move it.",
    };
  }
  if (lockIsLive(row, now) && row.lockedBy !== actor.sub) {
    const owner = row.lockedByName ?? "another planner";

    return {
      allowed: false,
      reason: "LOCKED",
      message: `${owner} is working on this operation; wait, or break the lock.`,
      lockedByName: owner,
    };
  }

  return { allowed: true };
}

export type LockVerdict =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly message: string;
      readonly lockedByName: string;
    };

/** May the actor take the lock? Their own or a stale lock is taken over; a live one of another planner is refused. */
export function judgeLock(
  row: LockableRow,
  actor: Actor,
  now: DateTime,
): LockVerdict {
  if (lockIsLive(row, now) && row.lockedBy !== actor.sub) {
    const owner = row.lockedByName ?? "another planner";

    return {
      allowed: false,
      message: `${owner} already holds this operation.`,
      lockedByName: owner,
    };
  }

  return { allowed: true };
}

/** The columns a taken lock writes. */
export function lockColumns(actor: Actor, now: DateTime) {
  return {
    lockedBy: actor.sub,
    lockedByName: actor.name,
    lockedAt: now.toJSDate(),
  };
}

/** The columns a released or broken lock writes. */
export const UNLOCKED_COLUMNS = {
  lockedBy: null,
  lockedByName: null,
  lockedAt: null,
} as const;
