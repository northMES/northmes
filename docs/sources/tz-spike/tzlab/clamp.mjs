import { Temporal } from 'temporal-polyfill/implementation';
const Z='Europe/Stockholm';
function resolveClamp(zone, pdt) {
  const e = pdt.toZonedDateTime(zone, { disambiguation: 'earlier' });
  if (e.toPlainDateTime().equals(pdt)) return e;               // exists (first occurrence if repeated)
  return e.getTimeZoneTransition('next');                      // in a gap: the first instant after it
}
const compat = (zone, pdt) => pdt.toZonedDateTime(zone, { disambiguation: 'compatible' });
for (const [a,b] of [['2026-03-29T02:30','2026-03-29T03:15'],['2026-03-29T02:00','2026-03-29T02:30'],['2026-03-29T01:30','2026-03-29T02:30'],['2026-10-25T02:30','2026-10-25T03:15']]) {
  const A=Temporal.PlainDateTime.from(a), B=Temporal.PlainDateTime.from(b);
  const c=[compat(Z,A),compat(Z,B)], k=[resolveClamp(Z,A),resolveClamp(Z,B)];
  const len = ([x,y]) => (y.epochMilliseconds-x.epochMilliseconds)/60000;
  console.log(`[${a.slice(11)}, ${b.slice(11)}) ${a.slice(0,10)}: compatible ${c[0].toInstant()}..${c[1].toInstant()} = ${len(c)} min | clamp ${k[0].toInstant()}..${k[1].toInstant()} = ${len(k)} min`);
}
