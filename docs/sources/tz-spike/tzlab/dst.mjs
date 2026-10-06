import { Temporal } from 'temporal-polyfill/implementation';
import { DateTime } from 'luxon';
import { TZDate } from '@date-fns/tz';
import dayjs from 'dayjs'; import utc from 'dayjs/plugin/utc.js'; import tz from 'dayjs/plugin/timezone.js';
dayjs.extend(utc); dayjs.extend(tz);

// find transitions for Stockholm and Helsinki 2026, 2027
for (const zone of ['Europe/Stockholm','Europe/Helsinki']) {
  const tzo = Temporal.TimeZone ? null : null;
  let z = Temporal.ZonedDateTime.from({year:2026,month:1,day:1,timeZone:zone});
  for (let i=0;i<4;i++) {
    const t = z.getTimeZoneTransition('next');
    console.log(zone, 'transition at', t.toString(), 'UTC', t.toInstant().toString(), 'local before->after offsets');
    z = t;
  }
}
// hoursInDay
for (const d of ['2026-03-29','2026-10-25','2027-03-28','2027-10-31']) {
  const z = Temporal.PlainDate.from(d).toZonedDateTime('Europe/Stockholm');
  console.log(d, 'hoursInDay', z.hoursInDay, 'startOfDay', z.startOfDay().toString());
}
const cases = ['2026-03-29T02:00','2026-03-29T02:30','2026-10-25T02:30','2027-03-28T02:30','2027-10-31T02:30'];
for (const c of cases) {
  const pdt = Temporal.PlainDateTime.from(c);
  const t = pdt.toZonedDateTime('Europe/Stockholm',{disambiguation:'compatible'}).toString();
  const e = pdt.toZonedDateTime('Europe/Stockholm',{disambiguation:'earlier'}).toString();
  const l = pdt.toZonedDateTime('Europe/Stockholm',{disambiguation:'later'}).toString();
  const lux = DateTime.fromISO(c,{zone:'Europe/Stockholm'}).toISO();
  const [dt,tm]=c.split('T'); const [Y,M,D]=dt.split('-').map(Number); const [h,m]=tm.split(':').map(Number);
  const tzd = new TZDate(Y,M-1,D,h,m,0,'Europe/Stockholm').toISOString();
  const dj = dayjs.tz(c,'Europe/Stockholm').format();
  console.log(c, '\n  temporal compatible', t, '\n  earlier', e, '\n  later', l, '\n  luxon', lux, '\n  @date-fns/tz', tzd, '\n  dayjs', dj);
}
