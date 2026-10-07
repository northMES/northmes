/** The NorthMES version the shell runs; lockstep with every core package. */
export const NORTHMES_VERSION = "0.1.0";

/** Minimal range check for ">=a.b.c <x.y.z" ranges, enough for the spike. */
export function satisfiesRange(version: string, range: string): boolean {
  const toNum = (v: string) => v.split(".").map(Number).reduce((acc, n) => acc * 1000 + n, 0);
  const v = toNum(version);
  return range.split(/\s+/).every((part) => {
    const m = /^(>=|<=|>|<|=)?(\d+\.\d+\.\d+)$/.exec(part);
    if (!m) return false;
    const r = toNum(m[2]!);
    switch (m[1] ?? "=") {
      case ">=": return v >= r;
      case "<=": return v <= r;
      case ">": return v > r;
      case "<": return v < r;
      default: return v === r;
    }
  });
}
