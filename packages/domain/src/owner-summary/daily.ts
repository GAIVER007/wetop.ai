import { dayOffsetUtc, localDate } from '../index';
import { summarizeOwnerMoney, type OwnerMoneySource } from './money';
export type DatedMoneySource = OwnerMoneySource & { occurredAt?: Date; serviceDate?: string };
export type DailyWindow = { fromDate: string; toDate: string; timezone: string; now: Date };
/** Same canonical rows as the KPI. DATE never undergoes timezone conversion. */
export function projectDailyMoney(rows: DatedMoneySource[], window: DailyWindow) {
 const groups = new Map<string,DatedMoneySource[]>();
 for(let date=window.fromDate;date<=window.toDate;date=dayOffsetUtc(date,1)) groups.set(date,[]);
 const seen=new Set<string>();
 for(const row of rows) {
  if(row.occurredAt && row.occurredAt>window.now) continue;
  const date=row.serviceDate ?? (row.occurredAt ? localDate(row.occurredAt,window.timezone) : null);
  if(!date || !groups.has(date)) continue;
  const key=`${row.sourceType}:${row.sourceId}`;
  if(seen.has(key)) continue; seen.add(key); groups.get(date)!.push(row);
 }
 const total=summarizeOwnerMoney([...groups.values()].flat());
 const currencies=total.currencies.map(c=>c.currency);
 return {...total,days:[...groups].map(([date,items])=>{
  const daily=summarizeOwnerMoney(items);
  return {date,unresolvedSources:daily.unresolvedSources,currencies:currencies.map(currency=>({currency,amountMinor:daily.currencies.find(c=>c.currency===currency)?.amountMinor ?? '0'}))};
 })};
}
