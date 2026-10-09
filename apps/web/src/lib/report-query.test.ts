import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autoGranularity, parseReportQuery, reportHref } from './report-query';

const TODAY = '2026-10-09';

describe('общий разбор периода и фильтров отчётов (RPT2.2b)', () => {
  it('без параметров: этот месяц, сравнение включено, весь фонд, без источника и категории', () => {
    const q = parseReportQuery({}, TODAY);
    expect(q.period).toMatchObject({ preset: 'month', from: '2026-10-01', to: '2026-10-31' });
    expect(q).toMatchObject({ compare: true, fund: 'all', source: null, category: null });
    expect(q.granularity).toBe('day');
  });

  it('детализация по умолчанию зависит от длины периода и не пишется в адрес', () => {
    expect(autoGranularity('2026-10-01', '2026-10-31')).toBe('day');
    expect(autoGranularity('2026-07-01', '2026-10-31')).toBe('week');
    expect(autoGranularity('2026-01-01', '2026-12-31')).toBe('month');
    const q = parseReportQuery({}, TODAY);
    expect(reportHref('/reports', q)).toBe('/reports');
  });

  it('адрес переживает круг разбор → ссылка → разбор', () => {
    const sp = {
      period: 'custom',
      from: '2026-09-01',
      to: '2026-09-30',
      compare: '0',
      fund: 'rooms',
      source: 'Booking.com',
      category: 'Люкс',
      by: 'week',
    };
    const q = parseReportQuery(sp, TODAY);
    expect(q).toMatchObject({
      compare: false,
      fund: 'rooms',
      source: 'Booking.com',
      category: 'Люкс',
      granularity: 'week',
    });
    const href = reportHref('/reports', q);
    const back = parseReportQuery(
      Object.fromEntries(new URL(href, 'http://x').searchParams),
      TODAY,
    );
    expect(back).toEqual(q);
  });

  it('мусор в адресе не ломает отчёт: неверная детализация, длинный или управляющий текст отбрасываются', () => {
    const q = parseReportQuery(
      { by: 'year', source: 'x'.repeat(200), category: 'a\u0000b', fund: 'cars' },
      TODAY,
    );
    expect(q).toMatchObject({ source: null, category: null, fund: 'all', granularity: 'day' });
  });

  it('период длиннее года и перевёрнутый период дают ошибку, а не запрос', () => {
    expect(
      parseReportQuery({ period: 'custom', from: '2024-01-01', to: '2026-01-01' }, TODAY).period
        .error,
    ).toMatch(/не больше/);
    expect(
      parseReportQuery({ period: 'custom', from: '2026-10-05', to: '2026-10-01' }, TODAY).period
        .error,
    ).toMatch(/раньше/);
  });

  it('смена фильтра сохраняет остальные и не тянет чужие параметры', () => {
    const q = parseReportQuery({ source: 'Прямые', fund: 'beds' }, TODAY);
    const href = reportHref('/reports', q, { category: 'Dorm' });
    expect(new URL(href, 'http://x').searchParams.get('source')).toBe('Прямые');
    expect(new URL(href, 'http://x').searchParams.get('category')).toBe('Dorm');
    expect(new URL(href, 'http://x').searchParams.get('fund')).toBe('beds');
  });
});

describe('страницы отчётов закрыты для салона и ресторана (находка аудита RPT2.1)', () => {
  it.each([
    'page.tsx',
    'form-910/page.tsx',
    'print/page.tsx',
    'overview/page.tsx',
    'occupancy/page.tsx',
    'units/page.tsx',
  ])('reports/%s вызывает requireVertical', (f) => {
    const src = readFileSync(new URL(`../app/reports/${f}`, import.meta.url), 'utf8');
    expect(src).toContain("requireVertical(['HOSPITALITY'])");
  });
});
