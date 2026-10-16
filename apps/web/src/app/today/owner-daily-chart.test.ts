import {it,expect} from 'vitest';
import type {DailyMoney} from '../../lib/owner-summary';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {OwnerDailyChart} from './owner-daily-chart';
it('renders one real daily point with exact huge amount and no interpolated path',()=>{
 const html=renderToStaticMarkup(createElement(OwnerDailyChart,{metrics:[{label:'Выручка',daily:{state:'READY',reason:null,currencies:[{currency:'KZT',amountMinor:'900719925474099301'}],days:[{date:'2026-10-16',unresolvedSources:0,currencies:[{currency:'KZT',amountMinor:'900719925474099301'}]}]}}]}));
 expect(html).toContain('9 007 199 254 740 993,01 KZT');expect(html).toContain('<circle');expect(html).not.toContain('<path');expect(html).toContain('<table');expect(html).not.toContain('NaN');expect(html).not.toContain('Infinity');
});
it('unsupported receipts are unavailable not a zero series',()=>{
 const html=renderToStaticMarkup(createElement(OwnerDailyChart,{metrics:[{label:'Поступления',daily:{state:'UNAVAILABLE',reason:'PAYMENT_LEDGER_NOT_AVAILABLE',currencies:null,days:null}}]}));
 expect(html).toContain('Реестр оплат не подключён');expect(html).not.toContain('<svg');
});

const daily = (amounts:(string|null)[], month='10'):DailyMoney => ({state:'READY',reason:null,currencies:[{currency:'KZT',amountMinor:'100'}],days:amounts.map((amountMinor,i)=>({date:`2026-${month}-${String(i+1).padStart(2,'0')}`,unresolvedSources:0,currencies:amountMinor===null?[]:[{currency:'KZT',amountMinor}]}))});
it('keeps chart visible, switches metrics with labelled tabs, and compares the same metric only',()=>{
 const html=renderToStaticMarkup(createElement(OwnerDailyChart,{metrics:[{label:'Выручка',daily:daily(['100','200']),previous:daily(['300','400'],'09')},{label:'Поступления',daily:daily(['99999','88888'])}]}));
 expect(html).toContain('role="tablist"');expect(html).toContain('role="tab"');expect(html).toContain('aria-selected="true"');
 expect(html).toContain('data-series="previous"');expect(html).toContain('stroke-dasharray="5 5"');
 expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('<details'));
 expect(html).not.toContain('999,99 KZT');expect(html).toContain('4,00 KZT');
});
it('labels the partial previous series rather than presenting it as complete',()=>{
 const html=renderToStaticMarkup(createElement(OwnerDailyChart,{metrics:[{label:'Выручка',daily:daily(['100']),previous:{...daily(['200'],'09'),state:'PARTIAL',reason:'UNKNOWN_SOURCE_CURRENCY',unresolvedSources:1}}]}));
 expect(html).toContain('Предыдущий период: данные неполные');
});
it('keeps huge axis labels compact and the exact amounts accessible',()=>{
 const html=renderToStaticMarkup(createElement(OwnerDailyChart,{metrics:[{label:'Выручка',daily:daily(['900719925474099301'])}]}));
 const axis=Array.from(html.matchAll(/<text x="90"[^>]*>([\s\S]*?)<\/text>/g),m=>m[1]!.replace(/<title>[\s\S]*?<\/title>/g,''));
 expect(axis).toHaveLength(5);expect(axis.every(label=>label.length<=12)).toBe(true);
 expect(html).toContain('9 007 199 254 740 993,01 KZT');
});
it('does not replace a missing day currency with an invented zero point',()=>{
 const html=renderToStaticMarkup(createElement(OwnerDailyChart,{metrics:[{label:'Выручка',daily:daily(['100',null,'300'])}]}));
 expect((html.match(/<circle/g)||[]).length).toBe(2);expect(html).not.toContain('<path');expect(html).toContain('Нет данных');expect(html).not.toContain('<td>0,00 KZT</td>');
});
