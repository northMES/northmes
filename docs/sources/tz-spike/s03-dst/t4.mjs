import { Temporal as T } from 'temporal-polyfill/implementation';
import { normalize, subtract, union, addWork, subtractWork } from '../tzlab/engine.mjs';
const Z = 'Europe/Stockholm';
const clamp = (d, t) => { const l = T.PlainDate.from(d).toPlainDateTime(T.PlainTime.from(t)); const e = l.toZonedDateTime(Z, { disambiguation: 'earlier' }); return (e.toPlainDateTime().equals(l) ? e : e.getTimeZoneTransition('next')).epochMilliseconds; };
const compat = (d, t) => T.PlainDate.from(d).toPlainDateTime(T.PlainTime.from(t)).toZonedDateTime(Z, { disambiguation: 'compatible' }).epochMilliseconds;
const nd = (d) => T.PlainDate.from(d).add({ days: 1 }).toString();
const loc = (ms) => T.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(Z).toString({ timeZoneName: 'never' }).slice(0, 19);
const day = { start: '06:00', end: '14:30', breaks: [['08:00', '08:15'], ['10:00', '10:30'], ['12:30', '12:45']], days: [1, 2, 3, 4, 5] };
const night = { start: '22:00', end: '06:00', breaks: [['02:00', '02:30']], days: [1, 2, 3, 4, 5] };
function expand(from, to, overtime, R) {
  let av = [];
  for (let d = from; T.PlainDate.compare(T.PlainDate.from(d), T.PlainDate.from(to)) <= 0; d = nd(d)) {
    const wd = T.PlainDate.from(d).dayOfWeek;
    for (const s of [day, night]) {
      if (!s.days.includes(wd)) continue;
      const ed = s.end <= s.start ? nd(d) : d;
      const sh = [[R(d, s.start), R(ed, s.end)]];
      const br = normalize(s.breaks.map(([a, b]) => [R(a < s.start ? nd(d) : d, a), R(b < s.start ? nd(d) : d, b)]));
      av = union(av, subtract(sh, br));
    }
  }
  return union(av, normalize(overtime.map(([d1, t1, d2, t2]) => [R(d1, t1), R(d2, t2)])));
}
const work = 352800 * 1000;
for (const [label, from, to, ot] of [
  ['autumn, Sat overtime one row 22-06', '2026-10-19', '2026-11-13', [['2026-10-24', '22:00', '2026-10-25', '06:00']]],
  ['autumn, Sat overtime two rows (break 02:00-02:30)', '2026-10-19', '2026-11-13', [['2026-10-24', '22:00', '2026-10-25', '02:00'], ['2026-10-25', '02:30', '2026-10-25', '06:00']]],
  ['autumn, no overtime', '2026-10-19', '2026-11-13', []],
  ['spring, Sat overtime one row', '2027-03-22', '2027-04-16', [['2027-03-27', '22:00', '2027-03-28', '06:00']]],
  ['spring, Sat overtime two rows', '2027-03-22', '2027-04-16', [['2027-03-27', '22:00', '2027-03-28', '02:00'], ['2027-03-28', '02:30', '2027-03-28', '06:00']]],
]) {
  for (const [rn, R] of [['clamp', clamp], ['compatible', compat]]) {
    const av = expand(from, to, ot, R);
    const start = R(T.PlainDate.from(from).add({ days: 3 }).toString(), '06:00'); // Thursday 06:00
    const f = addWork(av, start, work);
    const satNight = av.filter(([a, b]) => b > R(T.PlainDate.from(from).add({ days: 5 }).toString(), '20:00') && a < R(T.PlainDate.from(from).add({ days: 6 }).toString(), '08:00'));
    const otH = satNight.reduce((s, [a, b]) => s + b - a, 0) / 3.6e6;
    console.log(label.padEnd(50), rn.padEnd(10), 'Sat-night avail h', otH, '| fwd', work / 1000, 's from Thu 06:00 ends', loc(f.end), new Date(f.end).toISOString());
  }
}
// backward: deadline Monday 2026-10-26 06:00 local, autumn one-row overtime
{
  const av = expand('2026-10-12', '2026-10-30', [['2026-10-24', '22:00', '2026-10-25', '06:00']], clamp);
  const b = subtractWork(av, clamp('2026-10-26', '06:00'), work);
  console.log('backward to Mon 2026-10-26 06:00 (autumn, one-row overtime) latest start', loc(b.start), new Date(b.start).toISOString());
  const segSat = b.segs.filter(([a, c]) => a >= clamp('2026-10-24', '20:00') && c <= clamp('2026-10-25', '08:00'));
  console.log('  Saturday segment(s)', segSat.map(([a, c]) => `${loc(a)}..${loc(c)} (${(c - a) / 3.6e6} h)`).join(' '));
}
