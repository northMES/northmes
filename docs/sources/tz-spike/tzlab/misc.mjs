import { Temporal } from 'temporal-polyfill/implementation';
for (const s of ['2026-10-25 01:30:00+00','2026-10-25 01:30:00.123456+00','2026-10-25T01:30:00.123456789Z']) {
  try { const i = Temporal.Instant.from(s); console.log(s,'->',i.toString(), i.epochNanoseconds.toString()); } catch(e){ console.log(s,'ERR',e.message); }
}
for (const d of ['2026-12-27','2026-12-28','2027-01-01','2027-01-03','2027-01-04','2027-01-10','2027-01-11']) {
  const p = Temporal.PlainDate.from(d);
  console.log(d, 'dow', p.dayOfWeek, 'yearOfWeek', p.yearOfWeek, 'weekOfYear', p.weekOfYear, 'parity', p.weekOfYear%2===0?'even':'odd');
}
// years with 53 ISO weeks 2024..2040
const y53=[]; for (let y=2024;y<=2040;y++){ const p=Temporal.PlainDate.from({year:y,month:12,day:28}); if(p.weekOfYear===53) y53.push(y);} console.log('53-week years', y53.join(','));
for (const [zone,d] of [['America/Santiago','2026-09-06'],['America/Santiago','2026-04-05'],['Australia/Lord_Howe','2026-10-04'],['Africa/Casablanca','2026-10-01'],['Asia/Kathmandu','2026-10-01']]) {
  const z = Temporal.PlainDate.from(d).toZonedDateTime(zone);
  console.log(zone,d,'startOfDay',z.startOfDay().toString(),'hoursInDay',z.hoursInDay);
}
console.log('Santiago next transitions from 2026-08-01:');
let z = Temporal.ZonedDateTime.from({year:2026,month:8,day:1,timeZone:'America/Santiago'});
for (let i=0;i<2;i++){ z=z.getTimeZoneTransition('next'); console.log(' ', z.toString()); }
console.log('Lord_Howe next transition from 2026-08-01:', Temporal.ZonedDateTime.from({year:2026,month:8,day:1,timeZone:'Australia/Lord_Howe'}).getTimeZoneTransition('next').toString());
console.log('Casablanca transitions 2026:'); z = Temporal.ZonedDateTime.from({year:2026,month:1,day:1,timeZone:'Africa/Casablanca'}); for (let i=0;i<4;i++){ const n=z.getTimeZoneTransition('next'); if(!n){console.log('  none');break;} z=n; console.log(' ', z.toString()); }
// time zone id handling
console.log(Temporal.ZonedDateTime.from('2026-10-01T12:00[Europe/Kiev]').timeZoneId, Temporal.ZonedDateTime.from('2026-10-01T12:00[europe/stockholm]').timeZoneId);
