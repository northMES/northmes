import { Temporal } from 'temporal-polyfill/implementation';
import * as E from './engine.mjs';
const S='Europe/Stockholm', H='Europe/Helsinki';
const hrs = iv => iv.reduce((t,[a,b])=>t+(b-a),0)/3600000;
const show = (label, iv, z=S) => console.log(label, iv.map(([a,b])=>`[${E.iso(a,z)} .. ${E.iso(b,z)}] (${E.utc(a)}..${E.utc(b)})`).join(' '), 'hours', hrs(iv));
// A: day shift 06:00-14:30 with assumed breaks
const day = {start:'06:00', end:'14:30', breaks:[['08:00','08:15'],['10:00','10:30'],['12:15','12:30']]};
let w1=E.shiftWindows(S,'2026-10-19',day), w2=E.shiftWindows(S,'2026-10-20',day);
const availA = E.union(E.subtract(w1.shift,w1.breaks), E.subtract(w2.shift,w2.breaks));
console.log('A day avail hours (2 days)', hrs(availA));
let r = E.addWork(availA, E.at(S,'2026-10-19','06:00'), 30000*1000); console.log('A forward 30000s from Mon 06:00 ->', E.iso(r.end,S));
r = E.subtractWork(availA, E.at(S,'2026-10-20','14:30'), 30000*1000); console.log('A backward 30000s to Tue 14:30 ->', E.iso(r.start,S));
// B: weeknight 22-06 with break 02:00-02:30; and Sat overtime same window
const night = {start:'22:00', end:'06:00', breaks:[['02:00','02:30']]};
for (const d of ['2026-03-26','2026-03-28','2026-03-30','2026-10-22','2026-10-24','2027-03-27','2027-10-30']) {
  const w=E.shiftWindows(S,d,night); const av=E.subtract(w.shift,w.breaks);
  console.log('B night starting', d, Temporal.PlainDate.from(d).dayOfWeek, 'shift h', hrs(w.shift), 'avail h', hrs(av)); show('   break', w.breaks);
}
// C: forward/backward across autumn and spring nights
for (const [d, work] of [['2026-10-24',8],['2026-03-28',6],['2027-10-30',8],['2027-03-27',6]]) {
  const w=E.shiftWindows(S,d,night); const av=E.subtract(w.shift,w.breaks);
  const f=E.addWork(av, E.at(S,d,'22:00'), work*3600000);
  const b=E.subtractWork(av, w.shift[0][1], work*3600000);
  console.log(`C ${d}: fwd ${work}h from 22:00 -> ${E.iso(f.end,S)} (${E.utc(f.end)}); bwd ${work}h to shift end ${E.iso(w.shift[0][1],S)} -> start ${E.iso(b.start,S)} (${E.utc(b.start)})`);
}
// naive comparison: wall clock arithmetic
// E: production days (06:00 start) for both plants
for (const z of [S,H]) for (const d of ['2026-03-28','2026-03-29','2026-10-24','2026-10-25','2027-03-27','2027-10-30']) {
  const a=E.at(z,d,'06:00'), b=E.at(z,Temporal.PlainDate.from(d).add({days:1}).toString(),'06:00');
  console.log('E PD', z, d, E.utc(a), '->', E.utc(b), (b-a)/3600000, 'h');
}
// F: instant -> production day per plant
const pd = (ms, z, startTime='06:00') => { const local = Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(z).toPlainDateTime(); const t=Temporal.PlainTime.from(startTime); return local.subtract({hours:t.hour, minutes:t.minute}).toPlainDate().toString(); };
for (const s of ['2026-10-25T03:30:00Z','2026-10-25T04:30:00Z','2026-10-25T05:30:00Z','2026-11-02T22:30:00Z','2027-03-28T03:30:00Z']) {
  const ms=Temporal.Instant.from(s).epochMilliseconds;
  console.log('F', s, 'STO', E.iso(ms,S), 'PD06', pd(ms,S), 'PD00', pd(ms,S,'00:00'), '| HEL', E.iso(ms,H), 'PD06', pd(ms,H), 'PD00', pd(ms,H,'00:00'));
}
// G: crew rotation
const anchor = Temporal.PlainDate.from('2026-01-05');
for (const d of ['2026-12-21','2026-12-28','2027-01-04','2027-01-11','2027-01-18']) {
  const p=Temporal.PlainDate.from(d); const idx = Math.floor(anchor.until(p,{largestUnit:'days'}).days/7)%2;
  console.log('G', d, 'W'+p.weekOfYear, 'ISO parity ->', p.weekOfYear%2===0?'shift 1':'shift 2', '| anchored ->', idx===0?'shift 1':'shift 2');
}
console.log('anchor week', anchor.weekOfYear);
