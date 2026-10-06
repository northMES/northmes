import { Temporal } from 'temporal-polyfill/implementation';
// wall clock -> epoch ms, default rule = Temporal 'compatible'
export const at = (zone, date, time) => Temporal.PlainDate.from(date).toPlainDateTime(Temporal.PlainTime.from(time)).toZonedDateTime(zone, { disambiguation: 'compatible' }).epochMilliseconds;
export function normalize(iv){ const s=[...iv].filter(([a,b])=>b>a).sort((x,y)=>x[0]-y[0]); const out=[]; for(const [a,b] of s){ const l=out.at(-1); if(l && a<=l[1]) l[1]=Math.max(l[1],b); else out.push([a,b]); } return out; }
export function subtract(A,B){ const out=[]; let j=0; for(const [a0,b0] of A){ let a=a0; while(j<B.length && B[j][1]<=a) j++; let k=j; while(k<B.length && B[k][0]<b0){ if(B[k][0]>a) out.push([a,B[k][0]]); a=Math.max(a,B[k][1]); if(a>=b0) break; k++; } if(a<b0) out.push([a,b0]); } return out; }
export const union=(A,B)=>normalize([...A,...B]);
export function addWork(avail, start, ms){ let rem=ms; let i=avail.findIndex(([,b])=>b>start); if(i<0) return null; let first=null; const segs=[]; for(;i<avail.length;i++){ const [a,b]=avail[i]; const s=Math.max(a,start); if(first===null) first=s; const take=Math.min(b-s,rem); if(take>0) segs.push([s,s+take]); rem-=take; if(rem===0) return {start:first,end:s+take,segs}; } return null; }
export function subtractWork(avail, end, ms){ let rem=ms; let i=-1; for(let k=avail.length-1;k>=0;k--){ if(avail[k][0]<end){i=k;break;} } if(i<0) return null; const segs=[]; let last=null; for(;i>=0;i--){ const [a,b]=avail[i]; const e=Math.min(b,end); if(last===null) last=e; const take=Math.min(e-a,rem); if(take>0) segs.unshift([e-take,e]); rem-=take; if(rem===0) return {start:e-take,end:last,segs}; } return null; }
export const iso = (ms, zone) => Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone).toString({timeZoneName:'never'});
export const utc = ms => Temporal.Instant.fromEpochMilliseconds(ms).toString();
const nextDay = d => Temporal.PlainDate.from(d).add({days:1}).toString();
// one shift with breaks, crossing midnight if end <= start
export function shiftWindows(zone, date, s){ const endDate = s.end<=s.start? nextDay(date):date; const shift=[[at(zone,date,s.start), at(zone,endDate,s.end)]]; const br = (s.breaks||[]).map(([bs,be])=>{ const d1 = bs< s.start? nextDay(date):date; const d2 = be< s.start? nextDay(date):date; return [at(zone,d1,bs), at(zone,d2,be)]; }); return { shift, breaks: normalize(br) }; }
