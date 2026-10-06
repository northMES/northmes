import { Temporal as P } from '../tzlab/node_modules/temporal-polyfill/index.js';
const run = (T, label) => {
  const zone = 'Europe/Stockholm';
  const times = ['06:00', '08:00', '08:15', '10:00', '10:30', '12:30', '12:45', '14:30'].map(t => T.PlainTime.from(t));
  const start = T.PlainDate.from('2026-10-05');
  const t0 = performance.now(); let n = 0;
  for (let m = 0; m < 40; m++) for (let d = 0; d < 140; d++) {
    const date = start.add({ days: d }); if (date.dayOfWeek > 5) continue;
    for (const t of times) { date.toPlainDateTime(t).toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds; n++; }
  }
  const t1 = performance.now();
  // cached variant: one offset lookup per date (zone offset at local noon), reused for all bounds that day unless near a transition
  const t2 = performance.now(); let k = 0;
  const cache = new Map();
  for (let m = 0; m < 40; m++) for (let d = 0; d < 140; d++) {
    const key = d; let base = cache.get(key);
    if (base === undefined) { const date = start.add({ days: d }); base = date.dayOfWeek > 5 ? null : times.map(t => date.toPlainDateTime(t).toZonedDateTime(zone).epochMilliseconds); cache.set(key, base); }
    if (base) k += base.length;
  }
  const t3 = performance.now();
  console.log(JSON.stringify({ impl: label, conversions: n, naiveMs: +(t1 - t0).toFixed(1), usPer: +((t1 - t0) * 1000 / n).toFixed(1), perCalendarCachedMs: +(t3 - t2).toFixed(1) }));
};
run(P, 'temporal-polyfill');
if (globalThis.Temporal) run(globalThis.Temporal, 'node24 --harmony-temporal');
