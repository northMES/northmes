const native = typeof globalThis.Temporal !== 'undefined';
if (!native) { (await import('temporal-polyfill/shim')).installImplementation(); }
const T = globalThis.Temporal; const Z = 'Europe/Stockholm';
const base = Date.UTC(2026, 9, 19); const strs = Array.from({ length: 10000 }, (_, i) => new Date(base + i * 517_000).toISOString());
let t = performance.now(); const inst = strs.map((s) => T.Instant.from(s)); const tParse = performance.now() - t;
t = performance.now(); const zs = inst.map((i) => i.toZonedDateTimeISO(Z)); const tZone = performance.now() - t;
t = performance.now(); zs.forEach((z) => z.offset); const tOff = performance.now() - t;
const f = new Intl.DateTimeFormat('sv-SE', { timeZone: Z, hour: '2-digit', minute: '2-digit' });
t = performance.now(); inst.forEach((i) => f.format(i)); const tFmtInst = performance.now() - t;
t = performance.now(); inst.forEach((i) => f.format(i.epochMilliseconds)); const tFmtMs = performance.now() - t;
t = performance.now(); strs.forEach((s) => Date.parse(s)); const tDate = performance.now() - t;
console.log(native ? 'native' : 'polyfill', '10k Instant.from', tParse.toFixed(1), 'ms; toZonedDateTimeISO', tZone.toFixed(1), 'ms; offset', tOff.toFixed(1), 'ms; Intl.format(Instant)', tFmtInst.toFixed(1), 'ms; Intl.format(ms)', tFmtMs.toFixed(1), 'ms; Date.parse', tDate.toFixed(1), 'ms');
