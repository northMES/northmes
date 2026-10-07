import { Temporal } from 'temporal-polyfill/implementation';
export * from './engine.mjs';
export const at = (zone, date, time) => { const pdt = Temporal.PlainDate.from(date).toPlainDateTime(Temporal.PlainTime.from(time)); const e = pdt.toZonedDateTime(zone,{disambiguation:'earlier'}); return (e.toPlainDateTime().equals(pdt) ? e : e.getTimeZoneTransition('next')).epochMilliseconds; };
