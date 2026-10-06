import fc from 'fast-check';
import * as E from './engine.mjs';
const H=3600000;
const ivArb = fc.array(fc.tuple(fc.integer({min:0,max:500}), fc.integer({min:1,max:40})), {maxLength:30}).map(xs=>E.normalize(xs.map(([s,l])=>[s*H/4,(s+l)*H/4])));
const work = (avail, a, b) => avail.reduce((t,[x,y])=>t+Math.max(0,Math.min(y,b)-Math.max(x,a)),0);
fc.assert(fc.property(ivArb, ivArb, ivArb, ivArb, fc.integer({min:0,max:600*H/4}), fc.integer({min:1,max:60*H}), (shifts, breaks, overtime, off, start, d) => {
  const avail = E.subtract(E.union(E.subtract(shifts, breaks), overtime), off);
  const r = E.addWork(avail, start, d);
  if (r === null) return work(avail, start, Infinity) < d;           // ran out of capacity
  if (work(avail, start, r.end) !== d) return false;                  // work conserved
  if (r.segs.some(([a,b]) => work(off,a,b) > 0)) return false;         // never in non-working time
  if (r.segs.some(([a,b]) => work(E.subtract(breaks, overtime),a,b) > 0)) return false; // never in a break unless overtime covers it
  const b = E.subtractWork(avail, r.end, d);
  return b !== null && b.start >= start && work(avail, b.start, r.end) === d; // backward from forward end
}), { numRuns: 5000 });
console.log('properties passed');
