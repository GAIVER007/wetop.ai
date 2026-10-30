import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnerSummaryView } from './unified-owner';
import { formatOwnerMoney, ownerPeriod, type OwnerSummaryDto } from '../../lib/owner-summary';
const dto = (key: 'today' | 'week' | 'month' = 'today'): OwnerSummaryDto => ({
  sourceVersion: 'owner-cash-foundation-v1',
  generatedAt: '2026-10-16T09:00:00Z',
  state: 'PARTIAL',
  scope: { locationId: 'test-location', organizationId: 'test-org', vertical: 'BEAUTY' },
  period: {
    key,
    timezone: 'Asia/Almaty',
    fromDate: '2026-10-01',
    toDate: '2026-10-16',
    fromUtc: '2026-09-30T19:00:00Z',
    toUtc: '2026-10-16T09:00:00Z',
    isFinalized: false,
  },
  current: {
    revenue: {
      state: 'READY',
      reason: null,
      unresolvedSources: 0,
      currencies: [
        { currency: 'KZT', amountMinor: '900719925474099301' },
        { currency: 'USD', amountMinor: '12345' },
      ],
    },
    receipts: { state: 'UNAVAILABLE', reason: 'PAYMENT_LEDGER_NOT_AVAILABLE', currencies: null },
    paidExpenses: {
      state: 'PARTIAL',
      reason: 'UNKNOWN_SOURCE_CURRENCY',
      unresolvedSources: 1,
      currencies: [],
    },
  },
  previous: null,
  comparisonReason: 'COMPARABLE_PROJECTION_NOT_CONNECTED',
  classificationReason: 'EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED',
  workload: {
    state: 'PARTIAL',
    reason: 'INCOMPLETE_PERIOD_COVERAGE',
    basis: 'BOOKED_SCHEDULE',
    unit: 'EMPLOYEE_MILLISECOND',
    numerator: '100',
    denominator: '200',
    percent: null,
    coverage: [],
  },
});
describe('unified owner actual DTO', () => {
  for (const vertical of ['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY']) {
    for (const [key, from] of [['today', '2026-10-18'], ['week', '2026-10-12'], ['month', '2026-10-01']] as const) {
      it(`preserves API dates in every finance link: ${vertical}/${key}`, () => {
        const d = dto(key);
        d.scope.vertical = vertical;
        d.period.fromDate = from;
        d.period.toDate = '2026-10-18';
        const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }));
        const links = [...html.matchAll(/href="([^"]+)"/g)]
          .map((m) => new URL(m[1]!.replaceAll('&amp;', '&'), 'https://unit.invalid'))
          .filter((url) => ['/finance', '/restaurant-finance'].includes(url.pathname));
        // шапка, график и «Куда уходят деньги»; общая строка «Открыть операции» ушла с настоящими сигналами (21.10.2026)
        expect(links.length).toBeGreaterThanOrEqual(3);
        for (const url of links) {
          expect(url.pathname).toBe(vertical === 'FOOD_SERVICE' ? '/restaurant-finance' : '/finance');
          expect(url.searchParams.get('from')).toBe(from);
          expect(url.searchParams.get('to')).toBe('2026-10-18');
          expect([...url.searchParams.keys()].sort()).toEqual(['from', 'to']);
        }
      });
    }
  }
  it('provides the skip-link main landmark in supported and unsupported views', () => {
    for (const vertical of ['BEAUTY', 'UNKNOWN']) {
      const d = dto(); d.scope.vertical = vertical;
      expect(renderToStaticMarkup(createElement(OwnerSummaryView, {summary:d}))).toContain('<main id="main-content"');
    }
  });
  it('explains missing money without exposing a raw reason code or invented totals', () => {
    const d = dto(); d.current.revenue = {state:'UNAVAILABLE', reason:'NO_MONEY_DATA', currencies:null};
    // поступления есть, поэтому плитки на месте (при всех пустых показателях их заменяет пустое состояние)
    d.current.receipts = {state:'READY', reason:null, currencies:[{currency:'USD', amountMinor:'100'}]};
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, {summary:d}));
    expect(html).toContain('Нет денежных операций за выбранный период');
    expect(html).not.toContain('NO_MONEY_DATA');
    expect(html).not.toContain('>0 ₸<');
  });
  it('passes actual previous daily money to the always-open chart', () => {
    const d = dto();
    const daily = (amountMinor:string, date:string) => ({state:'READY' as const, reason:null, currencies:[{currency:'KZT',amountMinor}], days:[{date,unresolvedSources:0,currencies:[{currency:'KZT',amountMinor}]}]});
    d.current.revenue.daily = daily('12345','2026-10-16');
    d.previous = {period:{...d.period,policy:'SAME_LOCAL_WALL_CLOCK'}, ...d.current, revenue:{...d.current.revenue,daily:daily('6789','2026-09-16')}};
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, {summary:d}));
    expect(html).toContain('data-series="previous"');
    expect(html).toContain('67,89 ₸');
    expect(html).toContain('role="tablist"');
    // точные суммы под графиком (свой <details>), окно периода в шапке тоже <details>: ищем после шапки
    const plot = html.indexOf('owner-chart-plot');
    expect(plot).toBeLessThan(html.indexOf('<details', html.indexOf('</header>')));
    expect(html.indexOf('owner-chart-plot')).toBeGreaterThan(-1);
  });
  it('shows category bars only for a complete reconciled currency breakdown', () => {
    const d = dto();
    d.current.paidExpenses = {state:'READY',reason:null,currencies:[{currency:'KZT',paidMinor:'40000',categories:[{categoryId:'a',categoryName:'Материалы',paidMinor:'10000'},{categoryId:null,categoryName:'Прочее',paidMinor:'30000'}]}]};
    const html = renderToStaticMarkup(createElement(OwnerSummaryView,{summary:d}));
    expect(html).toContain('value="25"'); expect(html).toContain('value="75"');
    expect(html).toContain('Без статьи'); expect(html).not.toContain('<h3>Прочее</h3>');
    d.current.paidExpenses.state = 'PARTIAL';
    expect(renderToStaticMarkup(createElement(OwnerSummaryView,{summary:d}))).not.toContain('Доля расходов');
  });
  it('renders linked category names safely and minute units without claiming disconnected', () => {
    const d = dto();
    d.classificationReason = null;
    d.current.paidExpenses = { state: 'READY', reason: null, currencies: [{ currency: 'KZT', paidMinor: '40000', categories: [{categoryId: 'c', categoryName: '<Закупки>', paidMinor: '40000'}] }] };
    d.workload.numerator = '3600000'; d.workload.denominator = '7200000';
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, {summary:d}));
    expect(html).toContain('&lt;Закупки&gt;');
    expect(html).toContain('400 ₸');
    expect(html).not.toContain('Классификация расходов не подключена');
    expect(html).not.toContain('миллисекунд');
    expect(html).toContain('60 из 120');
  });
  for (const [key, label] of [
    ['today', 'Загрузка сегодня'],
    ['week', 'Средняя загрузка за 7 дней'],
    ['month', 'Средняя загрузка за месяц'],
  ] as const)
    it(key, () => {
      const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto(key) }));
      expect(html).toContain(label);
      expect(html).toContain('Оплаченные расходы');
      expect(html).toContain('USD');
      // тенге знаком «₸», как на остальных экранах (аудит 22.10.2026 P1-1)
      expect(html).toContain('₸');
      expect(html).not.toMatch(/\d KZT/);
      expect(html).not.toContain('50%');
      expect(html).toContain('Неполное покрытие периода');
      expect(html).toContain('Временной ряд не подключён');
      // график по дням не рисуется без ряда (стрелки месяца тоже svg, поэтому ищем сам график)
      expect(html).not.toContain('owner-chart-plot');
    });
  it('renders exact signed comparable money and basis point rate, never previous workload',()=>{
    const d=dto();
    d.comparisons={revenue:{reason:null,currencies:[{currency:'USD',deltaMinor:'100',rateBasisPoints:'125',reason:null}]},receipts:{reason:'PAYMENT_LEDGER_NOT_AVAILABLE',currencies:null},paidExpenses:{reason:'UNKNOWN_SOURCE_CURRENCY',currencies:null}};
    const html=renderToStaticMarkup(createElement(OwnerSummaryView,{summary:d}));
    expect(html).toContain('+1 USD');
    expect(html).toContain('+1,25%');
    expect(html).toContain('Нет данных для сравнения');
  });
  it('formats big minor units without float loss', () =>
    expect(formatOwnerMoney('900719925474099301', 'KZT').replace(/\s/g, '')).toBe(
      '9007199254740993,01₸',
    ));
  it('деньги как везде: «50 000 ₸» без копеек, другая валюта кодом (аудит 22.10.2026 P1-1)', () => {
    expect(formatOwnerMoney('5000000', 'KZT').replace(/\s/g, ' ')).toBe('50 000 ₸');
    expect(formatOwnerMoney('-5000000', 'KZT').replace(/\s/g, ' ')).toBe('−50 000 ₸');
    expect(formatOwnerMoney('6789', 'USD')).toBe('67,89 USD');
    expect(formatOwnerMoney('100', 'USD')).toBe('1 USD');
  });
  it('normalizes query, not rolling 30 days', () => {
    // владелец 29.10.2026: по умолчанию текущий месяц; свой месяц и период «от–до» проходят как есть
    expect(ownerPeriod(undefined)).toBe('month');
    expect(ownerPeriod('month')).toBe('month');
    expect(ownerPeriod('30')).toBe('month');
    expect(ownerPeriod('month:2026-09')).toBe('month:2026-09');
    expect(ownerPeriod('range:2026-10-01..2026-10-15')).toBe('range:2026-10-01..2026-10-15');
    expect(ownerPeriod('range:2026-10-01..x')).toBe('month');
  });
  it('шапка: только месяц со стрелками и «Свой период» с календарём, без «Сегодня» и «7 дней»', () => {
    const d = dto('month');
    d.period = { ...d.period, key: 'month:2026-09', fromDate: '2026-09-01', toDate: '2026-09-30' };
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }));
    const bar = html.match(/<header class="owner-bar">([\s\S]*?)<\/header>/)?.[1] ?? '';
    // отдельных кнопок «Сегодня» и «7 дней» в шапке нет: готовые периоды только внутри окна периода, как в Журнале
    const outside = bar.replace(/<div class="date-range__panel"[\s\S]*?<\/details>/, '');
    expect(outside).not.toContain('>Сегодня<');
    expect(outside).not.toContain('>7 дней<');
    // подпись периода как в Финансах и Записях («1–30 сентября 2026»), а не отдельная кнопка месяца
    expect(bar).toMatch(/1[–-]30 сентября 2026/);
    expect(bar).toContain('href="/today?period=month:2026-08"');
    expect(bar).toContain('href="/today?period=month:2026-10"');
    expect(bar).toContain('data-testid="owner-custom-period"');
  });
  it('период Главной тем же окном, что Журнал, Записи и Финансы: календарь с готовыми периодами, а не поля даты браузера', () => {
    // владелец 30.10.2026 (скрин): «почему такой стрёмный выбор периода, сделай как в других местах, единый стиль»
    const d = dto('month');
    d.period = { ...d.period, key: 'range:2026-10-01..2026-10-15', fromDate: '2026-10-01', toDate: '2026-10-15' };
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }));
    const bar = html.match(/<header class="owner-bar">([\s\S]*?)<\/header>/)?.[1] ?? '';
    expect(bar).toContain('class="date-range');
    expect(bar).toMatch(/<summary[^>]*data-testid="owner-custom-period"/);
    expect(bar).toContain('action="/today"');
    expect(bar).not.toContain('owner-period__form');
    expect(bar).not.toContain('>Свой период<');
  });
  // владелец 30.10.2026: «добавь статистику конверсия из записи в визит, а то бронируют и не доходят»
  it('салон: «Запись → визит» справа под делами: процент пришедших и разбивка, ссылка на записи «Не пришёл»', () => {
    const d = dto('month');
    const visits = { booked: 12, came: 7, noShow: 2, cancelled: 1, unmarked: 2, percent: 58 };
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d, visits }));
    const panel = html.match(/<section[^>]*data-testid="owner-visits"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(panel).toContain('Запись → визит');
    expect(panel).toContain('58 %');
    expect(panel).toContain('Пришли');
    expect(panel).toContain('Не пришли');
    expect(panel).toContain('Отменили');
    expect(panel).toContain('Не отмечены');
    expect(panel).toContain('href="/appointments?from=2026-10-01&amp;to=2026-10-16&amp;status=NO_SHOW"');
    expect(html.indexOf('owner-attention-title')).toBeLessThan(html.indexOf('data-testid="owner-visits"'));
  });
  it('записей за период нет: блок говорит это словами, без 0 %', () => {
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto('month'), visits: { booked: 0, came: 0, noShow: 0, cancelled: 0, unmarked: 0, percent: null } }));
    const panel = html.match(/<section[^>]*data-testid="owner-visits"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(panel).toContain('Прошедших записей за период нет');
    expect(panel).not.toContain('0 %');
  });
  it('без данных конверсии (гостиница, ресторан) блока нет', () => {
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto('month') }));
    expect(html).not.toContain('owner-visits');
  });
  it('unknown vertical is explicit unsupported', () => {
    const d = dto();
    d.scope.vertical = 'UNKNOWN';
    expect(renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }))).toContain(
      'Направление не поддерживается',
    );
  });
  it('keeps room and bed separate without invented percent', () => {
    const d = dto();
    d.scope.vertical = 'HOSPITALITY';
    d.workload = {
      state: 'PARTIAL',
      basis: 'SELLABLE_NIGHTS',
      reason: 'OBSERVED_SOURCE_NOT_COMPLETE_HISTORY',
      numerator: null,
      denominator: null,
      percent: null,
      coverage: [],
      funds: [
        { unit: 'ROOM_NIGHT', state: 'PARTIAL', numerator: '2', denominator: '5', percent: null },
        { unit: 'BED_NIGHT', state: 'PARTIAL', numerator: '3', denominator: '7', percent: null },
      ],
    };
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }));
    expect(html).toContain('Номеро-ночи');
    expect(html).toContain('Койко-ночи');
    expect(html).not.toContain('40%');
  });
  it('keeps the approved home free of developer diagnostics and extra pseudo-tasks', () => {
    const d = dto();
    d.classificationReason = 'EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED';
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }));
    expect(html).not.toContain('Автоматические задачи и отклонения API не передаёт');
    expect(html).not.toContain('Операционные инструменты дня');
    expect(html).toContain('Нет данных для сравнения');
  });
  it('ведёт к рабочему дню: экраны дня живут на /today/operations (аудит 17.10.2026, Д6)', () => {
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto() }));
    expect(html).toMatch(/<a[^>]*href="\/today\/operations"[^>]*>Рабочий день<\/a>/);
  });
  it('говорит по-человечески: даты словами, без пояса Asia/Almaty и служебных оговорок (живой сайт 21.10.2026)', () => {
    const d = dto('today');
    d.period.fromDate = '2026-10-21';
    d.period.toDate = '2026-10-21';
    d.previous = null;
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }));
    expect(html).not.toContain('Asia/Almaty');
    expect(html).not.toMatch(/>2026-10-21/);
    expect(html).toContain('21 октября');
    expect(html).not.toContain('Отсутствие данных не означает нулевые расходы');
    expect(html).not.toContain('Валюты показаны раздельно, без общего итога');
    expect(html).not.toContain('Связи с документами расходов пока не подключены');
  });
  it('период из нескольких дней виден на кнопке периода: «1–16 октября 2026»', () => {
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto('month') }));
    expect(html).toContain('1–16 октября 2026');
  });
  // аудит живого сайта 21.10.2026, п. 8: четыре плитки «Нет данных» владелец не хочет
  it('все четыре показателя пусты: одно короткое пустое состояние с записью в Журнал вместо плиток', () => {
    const d = dto('today');
    d.current.revenue = { state: 'UNAVAILABLE', reason: 'NO_MONEY_DATA', currencies: null };
    d.current.receipts = { state: 'UNAVAILABLE', reason: 'NO_MONEY_DATA', currencies: null };
    d.current.paidExpenses = { state: 'UNAVAILABLE', reason: 'NO_MONEY_DATA', currencies: null };
    d.workload = { ...d.workload, state: 'UNAVAILABLE', percent: null, numerator: null, denominator: null };
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }));
    expect(html).not.toContain('owner-kpis');
    expect(html).toContain('data-testid="owner-empty"');
    expect(html).toMatch(/<a[^>]*href="\/calendar"[^>]*>Добавить первую запись<\/a>/);
  });
  it('есть данные: итоги строкой на месте (Главная на одном экране, 21.10.2026)', () => {
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto('today') }));
    expect(html).toContain('owner-totals');
    expect(html).not.toContain('data-testid="owner-empty"');
  });
  it('салон: строка «Требуют решения» ведёт в Журнал, как меню (п. 10)', () => {
    const d = dto('today');
    d.attention = [{ id: 'unpaid-visits', tone: 'warn', count: 1, text: 'Не оплачено сегодня: 1 запись', href: '/calendar', action: 'Журнал' }];
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: d }));
    expect(html).toMatch(/<a href="\/calendar">Журнал<\/a>/);
    expect(html).not.toContain('href="/appointments"');
  });
  it('пустой график без служебных оговорок (п. 9)', () => {
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto('today') }));
    expect(html).not.toContain('Недоступные источники не означают ноль');
    expect(html).not.toContain('подтверждённой валютой');
  });
  it('«Обновлено 16 окт., 14:00» без года и «г.» (аудит 22.10.2026 P2-9)', () => {
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto('today') }));
    expect(html).toContain('Обновлено 16 окт., 14:00');
    expect(html).not.toMatch(/Обновлено[^<]*2026/);
  });
  it('без «пока недоступны» на Главной (аудит 22.10.2026 P1-1)', () => {
    const html = renderToStaticMarkup(createElement(OwnerSummaryView, { summary: dto('today') }));
    expect(html).not.toContain('пока недоступны');
  });
});
