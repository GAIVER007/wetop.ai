import { describe, it, expect } from 'vitest';
import { projectDailyMoney } from './daily';
describe('canonical daily money', () => {
 it('uses local event dates, DATE verbatim, deduplicates and excludes future events with exact sums', () => {
  const r=projectDailyMoney([
   {sourceType:'PAYMENT',sourceId:'a',amountMinor:900719925474099301n,currency:'KZT',occurredAt:new Date('2026-10-14T19:00Z')},
   {sourceType:'PAYMENT',sourceId:'a',amountMinor:900719925474099301n,currency:'KZT',occurredAt:new Date('2026-10-14T19:00Z')},
   {sourceType:'CHARGE',sourceId:'b',amountMinor:10n,currency:'KZT',serviceDate:'2026-10-16'},
   {sourceType:'CASH',sourceId:'c',amountMinor:20n,currency:null,occurredAt:new Date('2026-10-16T01:00Z')},
   {sourceType:'PAYMENT',sourceId:'future',amountMinor:99n,currency:'USD',occurredAt:new Date('2026-10-16T10:00Z')},
   {sourceType:'PAYMENT',sourceId:'before',amountMinor:99n,currency:'USD',occurredAt:new Date('2026-10-14T18:59Z')},
  ], {fromDate:'2026-10-15',toDate:'2026-10-16',timezone:'Asia/Almaty',now:new Date('2026-10-16T09:00Z')});
  expect(r.days.map(d=>d.date)).toEqual(['2026-10-15','2026-10-16']);
  expect(r.state).toBe('PARTIAL'); expect(r.unresolvedSources).toBe(1);
  expect(r.days.map(d=>d.currencies)).toEqual([[{currency:'KZT',amountMinor:'900719925474099301'}],[{currency:'KZT',amountMinor:'10'}]]);
  expect(r.days.reduce((n,d)=>n+BigInt(d.currencies[0]!.amountMinor),0n)).toBe(900719925474099311n);
 });
 it('today is one daily point, empty sources are empty rather than a fabricated currency',()=>{
  expect(projectDailyMoney([], {fromDate:'2026-10-16',toDate:'2026-10-16',timezone:'UTC',now:new Date('2026-10-16T09:00Z')}).days).toEqual([{date:'2026-10-16',currencies:[],unresolvedSources:0}]);
 });
});
