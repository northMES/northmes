const T = globalThis.Temporal;
const zone = 'Europe/Stockholm';
const pdt = T.PlainDateTime.from('2026-11-02T06:00');
const N = 5000;
let t0 = performance.now(); for (let i = 0; i < N; i++) pdt.toZonedDateTime(zone).epochMilliseconds; let t1 = performance.now();
const zdt = pdt.toZonedDateTime(zone);
let t2 = performance.now(); for (let i = 0; i < N; i++) zdt.add({ hours: 1 }).epochMilliseconds; let t3 = performance.now();
let t4 = performance.now(); for (let i = 0; i < N; i++) T.PlainDate.from('2026-11-02').add({ days: 1 }); let t5 = performance.now();
// offset via Intl once per date
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' });
let t6 = performance.now(); for (let i = 0; i < N; i++) fmt.formatToParts(1793000000000 + i * 86400000); let t7 = performance.now();
console.log(JSON.stringify({ toZonedUs: +((t1 - t0) * 1000 / N).toFixed(1), zonedAddUs: +((t3 - t2) * 1000 / N).toFixed(1), plainDateAddUs: +((t5 - t4) * 1000 / N).toFixed(1), intlOffsetUs: +((t7 - t6) * 1000 / N).toFixed(1), node: process.version }));
