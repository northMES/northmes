import { Temporal as P } from 'temporal-polyfill/implementation';
const N = globalThis.Temporal;
const nd = N.PlainDate.from('2026-10-25'), pd = P.PlainDate.from('2026-10-25');
const tries = {
  'native instanceof poly class': () => nd instanceof P.PlainDate,
  'poly.PlainDate.compare(native, poly)': () => P.PlainDate.compare(nd, pd),
  'poly.equals(native)': () => pd.equals(nd),
  'native.equals(poly)': () => nd.equals(pd),
  'poly PlainDate.toPlainDateTime(native PlainTime)': () => pd.toPlainDateTime(N.PlainTime.from('02:30')).toString(),
  'native Instant.compare(native, poly Instant)': () => N.Instant.compare(N.Instant.from('2026-10-25T00:30Z'), P.Instant.from('2026-10-25T00:30Z')),
  'poly ZonedDateTime.from(native zdt)': () => P.ZonedDateTime.from(N.ZonedDateTime.from('2026-10-25T02:30+01:00[Europe/Stockholm]')).toString(),
  'JSON.stringify native Instant': () => JSON.stringify({ a: N.Instant.from('2026-10-25T00:30Z') }),
  'structuredClone poly Instant': () => String(structuredClone(P.Instant.from('2026-10-25T00:30Z'))),
  'Object.keys poly Instant': () => JSON.stringify(Object.keys(P.Instant.from('2026-10-25T00:30Z'))),
  'toStringTag poly Instant': () => Object.prototype.toString.call(P.Instant.from('2026-10-25T00:30Z')),
};
for (const [k, f] of Object.entries(tries)) { try { console.log(k, '->', f()); } catch (e) { console.log(k, '-> THROWS', e.constructor.name, e.message.slice(0, 90)); } }
