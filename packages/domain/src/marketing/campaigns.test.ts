import { describe, expect, it } from 'vitest';
import { MarketingBudgetError } from './budget';
import { campaignMetrics, parseCampaignInput, parseCampaignStatsCsv, parseCampaignStatsInput } from './campaigns';

const fails = (fn: () => unknown, word: string) => {
  expect(fn).toThrow(MarketingBudgetError);
  expect(fn).toThrow(word);
};

describe('кампания: разбор ввода (DATA_MODEL §53, ADR-MKT-B3)', () => {
  it('имя без лишних пробелов, статус по умолчанию «идёт», даты необязательны', () => {
    expect(parseCampaignInput({ platform: 'META', name: '  Осень: лиды  ' })).toEqual({
      platform: 'META',
      name: 'Осень: лиды',
      status: 'ACTIVE',
      startsOn: null,
      endsOn: null,
    });
    expect(parseCampaignInput({ platform: 'GOOGLE', name: 'Поиск', status: 'PAUSED', startsOn: '2026-10-01', endsOn: '2026-10-31' })).toMatchObject({
      status: 'PAUSED',
      startsOn: '2026-10-01',
      endsOn: '2026-10-31',
    });
  });

  it('отказы словами', () => {
    fails(() => parseCampaignInput({ platform: 'YANDEX', name: 'x' }), 'Платформа');
    fails(() => parseCampaignInput({ platform: 'META', name: '   ' }), 'Название');
    fails(() => parseCampaignInput({ platform: 'META', name: 'x', status: 'DONE' }), 'Статус');
    fails(() => parseCampaignInput({ platform: 'META', name: 'x', startsOn: '2026-10-10', endsOn: '2026-10-01' }), 'раньше');
  });
});

describe('статистика кампании за день', () => {
  it('целые не меньше нуля, пробелы в тысячах допустимы, пустое это ноль', () => {
    expect(parseCampaignStatsInput({ date: '2026-10-05', impressions: '12 000', clicks: '340', leads: '' })).toEqual({
      date: '2026-10-05',
      impressions: 12000,
      clicks: 340,
      leads: 0,
    });
  });

  it('кликов больше показов не бывает; дробь и минус отвергаются', () => {
    fails(() => parseCampaignStatsInput({ date: '2026-10-05', impressions: '10', clicks: '11' }), 'больше показов');
    fails(() => parseCampaignStatsInput({ date: '2026-10-05', impressions: '1,5' }), 'Показы');
    fails(() => parseCampaignStatsInput({ date: '2026-10-05', leads: '-1' }), 'Лиды');
    fails(() => parseCampaignStatsInput({ date: '2026-13-01' }), 'Дата');
  });

  it('CSV статистики: колонки по заголовку, дата из Excel, ошибки строк одним отказом', () => {
    const rows = parseCampaignStatsCsv('\uFEFFДата;Показы;Клики;Лиды\r\n05.10.2026;1 000;20;2\r\n2026-10-06;500;5;\r\n');
    expect(rows).toEqual([
      { line: 2, date: '2026-10-05', impressions: 1000, clicks: 20, leads: 2 },
      { line: 3, date: '2026-10-06', impressions: 500, clicks: 5, leads: 0 },
    ]);
    fails(() => parseCampaignStatsCsv('Дата;Показы;Клики\n2026-10-05;10;20\n2026-10-06;x;1'), 'Строка 2');
    fails(() => parseCampaignStatsCsv('Дата;Показы\n2026-10-05;1\n05.10.2026;2'), 'дважды');
    fails(() => parseCampaignStatsCsv('Показы;Клики\n1;1'), 'нет колонки «Дата»');
  });
});

describe('показатели кампании', () => {
  it('CTR в сотых долях процента, CPC, CPM и CPL площадки в тиынах с округлением к ближайшему', () => {
    // расход 10 000 ₸, 25 000 показов, 300 кликов, 12 лидов
    expect(campaignMetrics({ spendMinor: 1000000n, impressions: 25000, clicks: 300, leads: 12 })).toEqual({
      ctrBp: 120, // 1,20 %
      cpcMinor: 3333n, // 33,33 ₸
      cpmMinor: 40000n, // 400 ₸ за тысячу показов
      cplMinor: 83333n, // 833,33 ₸
    });
  });

  it('делить не на что: пусто, а не ноль', () => {
    expect(campaignMetrics({ spendMinor: 0n, impressions: 0, clicks: 0, leads: 0 })).toEqual({
      ctrBp: null,
      cpcMinor: null,
      cpmMinor: null,
      cplMinor: null,
    });
  });
});
