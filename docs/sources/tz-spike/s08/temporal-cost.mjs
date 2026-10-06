// Cost of resolving wall-clock window bounds to instants with Temporal (Node --harmony-temporal).
const T = globalThis.Temporal;
if (!T) { console.log('no Temporal'); process.exit(0); }
const zone = 'Europe/Stockholm';
const times = ['06:00', '08:00', '08:15', '10:00', '10:30', '12:30', '12:45', '14:30'].map(t => T.PlainTime.from(t));
const start = T.PlainDate.from('2026-10-05');
const t0 = performance.now(); let n = 0, sum = 0;
for (let m = 0; m < 40; m++) for (let d = 0; d < 140; d++) {
  const date = start.add({ days: d });
  if (date.dayOfWeek > 5) continue;
  for (const t of times) { const z = date.toPlainDateTime(t).toZonedDateTime(zone, { disambiguation: 'compatible' }); sum += z.epochMilliseconds; n++; }
}
const t1 = performance.now();
console.log(JSON.stringify({ conversions: n, ms: +(t1 - t0).toFixed(1), usPerConversion: +((t1 - t0) * 1000 / n).toFixed(2) }));
