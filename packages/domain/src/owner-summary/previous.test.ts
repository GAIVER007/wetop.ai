import {describe,it,expect} from 'vitest';
import {previousOwnerPeriod,compareOwnerMoney} from './previous';
describe('comparable partial owner money',()=>{
 it('uses previous local date and wall clock across DST, not 24 elapsed hours',()=>{
  expect(previousOwnerPeriod('today',new Date('2026-03-09T12:15:00.123Z'),'America/New_York').period).toMatchObject({fromDate:'2026-03-08',toDate:'2026-03-08',fromUtc:'2026-03-08T05:00:00.000Z',toUtc:'2026-03-08T12:15:00.123Z'});
  expect(previousOwnerPeriod('today',new Date('2026-03-08T12:15Z'),'America/New_York').period?.toUtc).toBe('2026-03-07T13:15:00.000Z');
 });
 it('shifts rolling seven dates and handles local midnight',()=>{
  expect(previousOwnerPeriod('week',new Date('2026-10-16T19:00Z'),'Asia/Almaty').period).toMatchObject({fromDate:'2026-10-04',toDate:'2026-10-10',toUtc:'2026-10-09T19:00:00.000Z'});
 });
 it('uses previous calendar month without clipping unequal months',()=>{
  expect(previousOwnerPeriod('month',new Date('2026-03-30T12:00Z'),'UTC')).toEqual({period:null,reason:'PREVIOUS_MONTH_DAY_NOT_AVAILABLE'});
  expect(previousOwnerPeriod('month',new Date('2026-01-16T12:00Z'),'UTC').period).toMatchObject({fromDate:'2025-12-01',toDate:'2025-12-16'});
 });
 it('rejects nonexistent or ambiguous prior wall clocks',()=>{
  expect(previousOwnerPeriod('today',new Date('2026-03-09T06:30Z'),'America/New_York').reason).toBe('PREVIOUS_WALL_CLOCK_NOT_UNIQUE');
  expect(previousOwnerPeriod('today',new Date('2026-11-02T06:30Z'),'America/New_York').reason).toBe('PREVIOUS_WALL_CLOCK_NOT_UNIQUE');
 });
 const money=(amount:string,state='READY')=>({state,reason:null,currencies:[{currency:'USD',amountMinor:amount}]});
 it('keeps exact BigInt delta and rational rate; zero has no fabricated rate',()=>{
  expect(compareOwnerMoney(money('9007199254740995'),money('9007199254740993')).currencies?.[0]).toMatchObject({deltaMinor:'2',rateBasisPoints:'0',reason:null});
  expect(compareOwnerMoney(money('10'),money('0')).currencies?.[0]).toMatchObject({deltaMinor:'10',rateBasisPoints:null,reason:'PREVIOUS_AMOUNT_ZERO'});
  expect(compareOwnerMoney(money('10'),money('9','PARTIAL')).currencies).toBeNull();
  expect(compareOwnerMoney(money('10'),{state:'READY',reason:null,currencies:[]}).currencies?.[0]).toMatchObject({deltaMinor:null,reason:'CURRENCY_NOT_PRESENT_IN_BOTH_PERIODS'});
 });
});
