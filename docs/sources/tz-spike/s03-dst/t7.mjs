const native = typeof globalThis.Temporal !== 'undefined';
if (!native) (await import('temporal-polyfill/shim')).installImplementation();
const T = globalThis.Temporal, Z = 'Europe/Stockholm';
const rwc = (d, t) => { const l = d.toPlainDateTime(t); const f = l.toZonedDateTime(Z, { disambiguation: 'earlier' }); return f.toPlainDateTime().equals(l) ? f.epochMilliseconds : f.getTimeZoneTransition('next').epochMilliseconds; };
const times = ['06:00','08:00','08:15','10:00','10:30','12:30','12:45','14:30','22:00','02:00','02:30','06:00'].map((s) => T.PlainTime.from(s));
let d = T.PlainDate.from('2026-10-05'); const t0 = performance.now(); let n = 0;
for (let m = 0; m < 60; m++) { let dd = d; for (let i = 0; i < 56; i++) { for (const t of times) { rwc(dd, t); n++; } dd = dd.add({ days: 1 }); } }
console.log(native ? 'native' : 'polyfill', n, 'resolveWallClock calls (60 machines x 56 days x 12 edges)', (performance.now() - t0).toFixed(0), 'ms');
