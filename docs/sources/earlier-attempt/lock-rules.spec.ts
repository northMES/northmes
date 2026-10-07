import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  holdsLock,
  judgeLock,
  judgeMove,
  LOCK_STALE_MINUTES,
  type LockableRow,
  lockColumns,
  lockIsLive,
  UNLOCKED_COLUMNS,
} from "./lock-rules.js";

const now = DateTime.fromISO("2026-09-11T09:00:00.000Z");
const anna = { sub: "user_anna", name: "Anna Berg" };
const bo = { sub: "user_bo", name: "Bo Lind" };

function row(overrides: Partial<LockableRow> = {}): LockableRow {
  return {
    id: "so_1",
    state: "SCHEDULED",
    pinned: false,
    lockedBy: null,
    lockedByName: null,
    lockedAt: null,
    ...overrides,
  };
}

const heldByAnna = row({
  lockedBy: anna.sub,
  lockedByName: anna.name,
  lockedAt: now.minus({ minutes: 5 }),
});

describe("lockIsLive and holdsLock", () => {
  it("counts a lock live within the stale window and forgotten after it", () => {
    expect(lockIsLive(heldByAnna, now)).toBe(true);
    expect(
      lockIsLive(
        row({
          ...heldByAnna,
          lockedAt: now.minus({ minutes: LOCK_STALE_MINUTES + 1 }),
        }),
        now,
      ),
    ).toBe(false);
    expect(lockIsLive(row(), now)).toBe(false);
  });

  it("knows whose lock it is", () => {
    expect(holdsLock(heldByAnna, anna, now)).toBe(true);
    expect(holdsLock(heldByAnna, bo, now)).toBe(false);
  });
});

describe("judgeMove", () => {
  it("allows a move on an unlocked row, the owner's own lock, and a stale lock", () => {
    expect(judgeMove(row(), bo, now)).toEqual({ allowed: true });
    expect(judgeMove(heldByAnna, anna, now)).toEqual({ allowed: true });
    expect(
      judgeMove(
        row({ ...heldByAnna, lockedAt: now.minus({ hours: 2 }) }),
        bo,
        now,
      ),
    ).toEqual({ allowed: true });
  });

  it("refuses another planner's live lock with the owner's name", () => {
    expect(judgeMove(heldByAnna, bo, now)).toEqual({
      allowed: false,
      reason: "LOCKED",
      message:
        "Anna Berg is working on this operation; wait, or break the lock.",
      lockedByName: "Anna Berg",
    });
  });

  it("refuses a pinned row for everyone, and a started row before the lock is even read", () => {
    expect(judgeMove(row({ pinned: true }), anna, now)).toMatchObject({
      allowed: false,
      reason: "PINNED",
    });
    expect(
      judgeMove(row({ ...heldByAnna, state: "IN_PROGRESS" }), anna, now),
    ).toMatchObject({ allowed: false, reason: "STARTED" });
    expect(judgeMove(row({ state: "COMPLETED" }), anna, now)).toMatchObject({
      allowed: false,
      reason: "STARTED",
    });
  });
});

describe("judgeLock and the columns", () => {
  it("lets a planner take a free, stale or own lock and refuses a live one", () => {
    expect(judgeLock(row(), bo, now)).toEqual({ allowed: true });
    expect(judgeLock(heldByAnna, anna, now)).toEqual({ allowed: true });
    expect(judgeLock(heldByAnna, bo, now)).toEqual({
      allowed: false,
      message: "Anna Berg already holds this operation.",
      lockedByName: "Anna Berg",
    });
    expect(
      judgeLock(row({ ...heldByAnna, lockedByName: null }), bo, now),
    ).toMatchObject({ lockedByName: "another planner" });
  });

  it("writes the owner and the instant, and clears all three on release", () => {
    expect(lockColumns(bo, now)).toEqual({
      lockedBy: "user_bo",
      lockedByName: "Bo Lind",
      lockedAt: now.toJSDate(),
    });
    expect(UNLOCKED_COLUMNS).toEqual({
      lockedBy: null,
      lockedByName: null,
      lockedAt: null,
    });
  });
});
