import { expect, it } from 'vitest';
import { projectRestaurantWorkload } from './workload';
const t=(s:string)=>new Date(s);
const from=t('2026-10-01T00:00:00Z'), now=t('2026-10-01T04:00:00Z');
const interval=(tableId:string,start:number,end:number)=>({tableId,from:new Date(+from+start*60000),to:new Date(+from+end*60000)});
it('weights table duration, unions sessions and clips to now',()=>{
 const result=projectRestaurantWorkload(from,now,[interval('a',0,60),interval('b',0,180)],[interval('a',0,60),interval('a',30,60),interval('b',0,60)],[{from,to:now,state:'COMPLETE',sourceRevision:'v1'}]);
 expect(result.numerator).toBe('7200000'); expect(result.denominator).toBe('14400000'); expect(result.percent).toBe(50); expect(result.state).toBe('COMPLETE');
});
it('never labels partial captured period as full period percent',()=>{
 const result=projectRestaurantWorkload(from,now,[interval('a',60,300)],[interval('a',60,300)],[{from:new Date(+from+3600000),to:now,state:'COMPLETE',sourceRevision:'v1'}]);
 expect(result.state).toBe('PARTIAL'); expect(result.percent).toBeNull(); expect(result.coveredPercent).toBe(100); expect(result.denominator).toBe('10800000');
});
it('coverage gaps remove both numerator and denominator',()=>{
 const result=projectRestaurantWorkload(from,now,[interval('a',0,240)],[interval('a',0,240)],[{from,to:now,state:'COMPLETE',sourceRevision:'v1'},{from:new Date(+from+3600000),to:new Date(+from+7200000),state:'GAP',sourceRevision:'v2'}]);
 expect(result.state).toBe('PARTIAL'); expect(result.denominator).toBe('10800000'); expect(result.percent).toBeNull();
});
it('missing schedule and zero capacity never become zero percent',()=>{
 const result=projectRestaurantWorkload(from,now,[],[],[{from,to:now,state:'COMPLETE',sourceRevision:'v1'}]);
 expect(result.state).toBe('UNAVAILABLE'); expect(result.percent).toBeNull(); expect(result.reason).toBe('NO_AVAILABLE_CAPACITY_OR_SCHEDULE');
});
it('uses UTC elapsed time through DST and midnight',()=>{
 const start=t('2026-10-24T22:00:00Z'),end=t('2026-10-25T23:00:00Z');
 const result=projectRestaurantWorkload(start,end,[{tableId:'a',from:start,to:end}],[{tableId:'a',from:start,to:end}],[{from:start,to:end,state:'COMPLETE',sourceRevision:'v1'}]);
 expect(result.denominator).toBe('90000000'); expect(result.percent).toBe(100);
});
