// Run: node t1.mjs (polyfill) or node --harmony-temporal t1.mjs native
const native = typeof globalThis.Temporal !== 'undefined';
if (!native) { const m = await import('temporal-polyfill/shim'); m.installImplementation(); }
const T = globalThis.Temporal;
console.log('impl', native ? 'native' : 'polyfill', 'tz', process.versions.tz, 'TZ', process.env.TZ);
const Z = 'Europe/Stockholm';
function rwc(date, time) {
  const local = T.PlainDate.from(date).toPlainDateTime(T.PlainTime.from(time));
  const first = local.toZonedDateTime(Z, { disambiguation: 'earlier' });
  if (first.toPlainDateTime().equals(local)) return first.toInstant().toString();
  const tr = first.getTimeZoneTransition('next');
  return tr.toInstant().toString();
}
for (const [d, t] of [['2026-10-25','02:30'],['2026-10-25','03:00'],['2026-10-25','02:00'],['2027-03-28','02:30'],['2027-03-28','02:00'],['2027-03-28','03:00']]) {
  try { console.log('rwc', d, t, '->', rwc(d, t)); } catch (e) { console.log('rwc', d, t, 'ERR', e.message); }
}
// snapping with round() inside the repeated hour
for (const s of ['2026-10-25T02:10:00+01:00[Europe/Stockholm]', '2026-10-25T02:10:00+02:00[Europe/Stockholm]']) {
  const z = T.ZonedDateTime.from(s);
  const r = z.round({ smallestUnit: 'minute', roundingIncrement: 15 });
  const viaResolve = rwc('2026-10-25', z.toPlainTime().round({ smallestUnit: 'minute', roundingIncrement: 15 }).toString());
  console.log('snap', s, 'zdt.round ->', r.toString(), r.toInstant().toString(), '| local-round+resolveWallClock ->', viaResolve);
}
// hour ticks by wall clock iteration vs exact
const ticksWall = []; const ticksExact = [];
let p = T.PlainDateTime.from('2026-10-25T00:00');
for (let i = 0; i < 5; i++) { ticksWall.push(p.toZonedDateTime(Z).toInstant().toString().slice(11,16) + 'Z'); p = p.add({ hours: 1 }); }
let z0 = T.ZonedDateTime.from('2026-10-25T00:00[Europe/Stockholm]');
for (let i = 0; i < 5; i++) { ticksExact.push(z0.toPlainTime().toString().slice(0,5) + z0.offset); z0 = z0.add({ hours: 1 }); }
console.log('autumn ticks wall-iter', ticksWall.join(' '), '| exact', ticksExact.join(' '));
const sw = []; p = T.PlainDateTime.from('2027-03-28T00:00');
for (let i = 0; i < 5; i++) { sw.push(p.toZonedDateTime(Z).toInstant().toString().slice(11,16) + 'Z'); p = p.add({ hours: 1 }); }
console.log('spring ticks wall-iter (default compatible)', sw.join(' '));
// day add across DST: ZonedDateTime add days vs hours
const sat = T.ZonedDateTime.from('2026-10-24T22:00[Europe/Stockholm]');
console.log('sat22 +24h', sat.add({ hours: 24 }).toString(), '| +1 day', sat.add({ days: 1 }).toString());
console.log('hoursInDay 10-25', T.ZonedDateTime.from('2026-10-25T12:00[Europe/Stockholm]').hoursInDay, '2027-03-28', T.ZonedDateTime.from('2027-03-28T12:00[Europe/Stockholm]').hoursInDay);
// until with largestUnit days vs hours across autumn
const a = T.ZonedDateTime.from('2026-10-22T06:00[Europe/Stockholm]'), b = T.ZonedDateTime.from('2026-10-26T07:40[Europe/Stockholm]');
console.log('until days', a.until(b, { largestUnit: 'days' }).toString(), 'hours', a.until(b, { largestUnit: 'hours' }).toString());
// Instant.from Postgres text
for (const s of ['2026-10-25 01:30:00.123456+00', '2026-10-25 02:30:00+01', '2026-10-25 12:30:00+13:45', '1800-01-01 00:00:00+01:12:12', 'infinity']) {
  try { console.log('Instant.from', JSON.stringify(s), '->', T.Instant.from(s).toString()); } catch (e) { console.log('Instant.from', JSON.stringify(s), 'ERR', e.constructor.name, e.message.slice(0, 80)); }
}
// PlainTime parse of pg time text
for (const s of ['06:00:00', '24:00:00', '02:30:00.5']) { try { console.log('PlainTime.from', s, T.PlainTime.from(s).toString()); } catch (e) { console.log('PlainTime.from', s, 'ERR', e.message.slice(0,60)); } }
// Intl labels
const i1 = T.Instant.from('2026-10-25T00:30:00Z'), i2 = T.Instant.from('2026-10-25T01:30:00Z');
for (const opts of [{ timeStyle: 'short' }, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }, { hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }]) {
  for (const loc of ['sv-SE', 'en-GB', 'fi-FI', 'de-DE']) {
    const f = new Intl.DateTimeFormat(loc, { ...opts, timeZone: Z });
    let s1, s2;
    try { s1 = f.format(i1); s2 = f.format(i2); } catch (e) { s1 = 'ERR ' + e.message.slice(0, 50); }
    console.log('intl', loc, JSON.stringify(opts), '|', s1, '|', s2);
  }
}
try { console.log('dtf.format(zdt)', new Intl.DateTimeFormat('sv-SE', { timeStyle: 'short', timeZone: Z }).format(i1.toZonedDateTimeISO(Z))); } catch (e) { console.log('dtf.format(zdt) ERR', e.constructor.name, e.message.slice(0, 80)); }
try { console.log('dtf.format(zdt other zone)', new Intl.DateTimeFormat('sv-SE', { timeStyle: 'short', timeZone: 'UTC' }).format(i1.toZonedDateTimeISO(Z))); } catch (e) { console.log('dtf.format(zdt other zone) ERR', e.constructor.name, e.message.slice(0, 80)); }
console.log('dtf no timeZone, Instant', new Intl.DateTimeFormat('sv-SE', { timeStyle: 'short' }).format(i1));
console.log('zdt.toLocaleString', i1.toZonedDateTimeISO(Z).toLocaleString('sv-SE', { timeStyle: 'short' }));
