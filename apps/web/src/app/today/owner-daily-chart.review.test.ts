import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {OwnerDailyChart} from './owner-daily-chart';
import {projectDailyMoney} from '../../../../../packages/domain/src/owner-summary/daily';
import type {DailyMoney} from '../../lib/owner-summary';
it('does not plot or print an unknown-currency day as an exact confirmed zero',()=>{
 const daily=projectDailyMoney([
  {sourceType:'CASH_OPERATION',sourceId:'known',serviceDate:'2026-10-14',amountMinor:100000n,currency:'USD'},
  {sourceType:'CASH_OPERATION',sourceId:'legacy',serviceDate:'2026-10-15',amountMinor:90000n,currency:null},
 ],{fromDate:'2026-10-14',toDate:'2026-10-15',timezone:'Asia/Almaty',now:new Date('2026-10-16T12:00:00Z')});
 expect(daily.days[1]?.unresolvedSources).toBe(1);
 const html=renderToStaticMarkup(createElement(OwnerDailyChart,{metrics:[{label:'Поступления',daily:daily as DailyMoney}]}));
 expect((html.match(/<circle /g)??[])).toHaveLength(1);
 expect(html).toContain('Данные неполные');
 expect(html).not.toContain('<td>0,00 USD</td>');
});
