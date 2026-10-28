import {dayOffsetUtc,localDate,zonedStartOfDay} from '../index';
export type ComparableOwnerPeriod = {key:string;timezone:string;fromDate:string;toDate:string;fromUtc:string;toUtc:string;isFinalized:false;policy:'SAME_LOCAL_WALL_CLOCK'};
/** Calendar dates are shifted before resolving the local wall clock. DST gaps/folds have no guessed policy. */
export function previousOwnerPeriod(key:string,now:Date,timezone:string):{period:ComparableOwnerPeriod|null;reason:string|null} {
 const today=localDate(now,timezone);
 let toDate=dayOffsetUtc(today,key==='week'?-7:-1);
 if(key==='month') {
  const previousLast=dayOffsetUtc(`${today.slice(0,7)}-01`,-1);
  if(today.slice(8)>previousLast.slice(8)) return {period:null,reason:'PREVIOUS_MONTH_DAY_NOT_AVAILABLE'};
  toDate=`${previousLast.slice(0,7)}-${today.slice(8)}`;
 }
 const fromDate=key==='month'?`${toDate.slice(0,7)}-01`:key==='week'?dayOffsetUtc(toDate,-6):toDate;
 const wall=(at:Date)=>new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(at);
 const clock=wall(now), target=Date.parse(`${toDate}T${clock}Z`)+now.getUTCMilliseconds();
 const candidates=new Set<number>();
 for(const date of [dayOffsetUtc(toDate,-1),toDate,dayOffsetUtc(toDate,1)]) {
  const sample=zonedStartOfDay(date,timezone);
  const offset=Date.parse(`${localDate(sample,timezone)}T${wall(sample)}Z`)-sample.getTime();
  const candidate=new Date(target-offset);
  if(localDate(candidate,timezone)===toDate && wall(candidate)===clock) candidates.add(candidate.getTime());
 }
 if(candidates.size!==1) return {period:null,reason:'PREVIOUS_WALL_CLOCK_NOT_UNIQUE'};
 return {period:{key,timezone,fromDate,toDate,fromUtc:zonedStartOfDay(fromDate,timezone).toISOString(),toUtc:new Date([...candidates][0]!).toISOString(),isFinalized:false,policy:'SAME_LOCAL_WALL_CLOCK'},reason:null};
}
type Metric={state:string;reason:string|null;unresolvedSources?:number;currencies:ReadonlyArray<{currency:string;amountMinor?:string;paidMinor?:string}>|null};
export type OwnerMoneyComparison={reason:string|null;currencies:{currency:string;deltaMinor:string|null;rateBasisPoints:string|null;reason:string|null}[]|null};
/** No currency conversion, floating money, zero-base division, or comparison of partial known subsets. */
export function compareOwnerMoney(current:Metric,previous:Metric|null):OwnerMoneyComparison {
 if(!previous || current.state!=='READY' || previous.state!=='READY' || current.unresolvedSources || previous.unresolvedSources) return {reason:current.reason??previous?.reason??'MONEY_NOT_FULLY_KNOWN',currencies:null};
 const currencies=[...new Set([...(current.currencies??[]),...(previous.currencies??[])].map(c=>c.currency))].sort();
 return {reason:currencies.length?null:'NO_MONEY_DATA',currencies:currencies.map(currency=>{
  const a=current.currencies?.find(c=>c.currency===currency),b=previous.currencies?.find(c=>c.currency===currency);
  if(!a || !b) return {currency,deltaMinor:null,rateBasisPoints:null,reason:'CURRENCY_NOT_PRESENT_IN_BOTH_PERIODS'};
  const prior=BigInt(b.amountMinor??b.paidMinor!),delta=BigInt(a.amountMinor??a.paidMinor!)-prior;
  return {currency,deltaMinor:delta.toString(),rateBasisPoints:prior===0n?null:(delta*10000n/prior).toString(),reason:prior===0n?'PREVIOUS_AMOUNT_ZERO':null};
 })};
}

/**
 * Период Главной владельца (владелец 29.10.2026: «оставь только месяц переключать и выбор свой период от–до»).
 * `today|week|month` прежние; `month:YYYY-MM` прошлый или текущий месяц целиком; `range:YYYY-MM-DD..YYYY-MM-DD`
 * свой период включительно, не длиннее 366 дней. Будущее обрезается сегодняшним моментом филиала, целиком
 * будущий период отклоняется. Сравнение: такой же по длине отрезок сразу до (у месяца прошлый месяц целиком).
 */
export type OwnerPeriodResolved = {key:string;fromDate:string;toDate:string;fromUtc:Date;toUtc:Date;previous:{fromDate:string;toDate:string}|null};
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v;
const spanDays=(a:string,b:string)=>Math.round((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000)+1;
export const OWNER_RANGE_MAX_DAYS=366;
export function resolveOwnerPeriod(key:string,now:Date,timezone:string):OwnerPeriodResolved|null {
 const today=localDate(now,timezone);
 const end=(toDate:string)=>toDate>=today?now:zonedStartOfDay(dayOffsetUtc(toDate,1),timezone);
 let m=/^month:(\d{4}-(0[1-9]|1[0-2]))$/.exec(key);
 if(m) {
  const fromDate=`${m[1]}-01`; if(fromDate>today) return null;
  const last=dayOffsetUtc(`${dayOffsetUtc(fromDate,32).slice(0,7)}-01`,-1);
  const toDate=last<today?last:today;
  const prevFrom=`${dayOffsetUtc(fromDate,-1).slice(0,7)}-01`;
  return {key,fromDate,toDate,fromUtc:zonedStartOfDay(fromDate,timezone),toUtc:end(toDate),previous:{fromDate:prevFrom,toDate:dayOffsetUtc(fromDate,-1)}};
 }
 m=/^range:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(key);
 if(m) {
  const [,a,b]=m as unknown as [string,string,string];
  if(!validDate(a)||!validDate(b)||b<a||a>today||spanDays(a,b)>OWNER_RANGE_MAX_DAYS) return null;
  const toDate=b<today?b:today, len=spanDays(a,toDate);
  return {key,fromDate:a,toDate,fromUtc:zonedStartOfDay(a,timezone),toUtc:end(toDate),previous:{fromDate:dayOffsetUtc(a,-len),toDate:dayOffsetUtc(a,-1)}};
 }
 return null;
}
