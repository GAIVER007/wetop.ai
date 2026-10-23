import { describe, expect, it } from 'vitest';
import { adLibrary, audienceKey, type AdLibraryLaunch } from './ad-library';

/**
 * «Аудитории» и «Креативы» ИИ-таргетолога (23.10.2026, пункт 5 плана вертикалей): сводка прошлых успешных запусков
 * филиала по настройкам аудитории и по файлу креатива. Без новой таблицы: запуск (§57) и дни кампании (§53).
 */
const base = (over: Partial<AdLibraryLaunch>): AdLibraryLaunch => ({
  id: 'l1',
  status: 'SUCCEEDED',
  createdAt: '2026-10-01T10:00:00.000Z',
  currency: 'KZT',
  headline: 'Номер у гор',
  settings: { countryCode: 'KZ', cities: [{ key: '1', name: 'Алматы' }], ageMin: 25, ageMax: 45, genders: [], advantageAudience: false },
  creative: { id: 'c1', kind: 'IMAGE', fileName: 'room.jpg' },
  stats: { spendMinor: 1_000_000n, leads: 10, impressions: 5000, clicks: 100 },
  ...over,
});

describe('библиотека аудиторий и креативов (ИИ-таргетолог)', () => {
  it('ключ аудитории не зависит от порядка городов', () => {
    const a = audienceKey({ countryCode: 'KZ', cities: [{ key: '2', name: 'Астана' }, { key: '1', name: 'Алматы' }], ageMin: 25, ageMax: 45, genders: [], advantageAudience: false });
    const b = audienceKey({ countryCode: 'KZ', cities: [{ key: '1', name: 'Алматы' }, { key: '2', name: 'Астана' }], ageMin: 25, ageMax: 45, genders: [], advantageAudience: false });
    expect(a).toBe(b);
  });

  it('одинаковые аудитории складываются; цена заявки = расход / заявки; лучшие сверху, без заявок внизу', () => {
    const lib = adLibrary([
      base({ id: 'a' }),
      base({ id: 'b', createdAt: '2026-10-05T10:00:00.000Z', stats: { spendMinor: 500_000n, leads: 10, impressions: 1, clicks: 1 } }),
      base({
        id: 'c',
        settings: { countryCode: 'KZ', cities: [], ageMin: 18, ageMax: 65, genders: [2], advantageAudience: true },
        creative: { id: 'c2', kind: 'VIDEO', fileName: 'tour.mp4' },
        stats: { spendMinor: 300_000n, leads: 0, impressions: 1, clicks: 1 },
      }),
      base({
        id: 'd',
        settings: { countryCode: 'KZ', cities: [{ key: '2', name: 'Астана' }], ageMin: 30, ageMax: 50, genders: [1], advantageAudience: false },
        creative: { id: 'c3', kind: 'IMAGE', fileName: 'spa.jpg' },
        stats: { spendMinor: 200_000n, leads: 10, impressions: 1, clicks: 1 },
      }),
    ]);
    expect(lib.audiences.map((a) => [a.label, a.launches, a.leads, a.spendMinor, a.cplMinor])).toEqual([
      ['Астана · 30–50 · мужчины', 1, 10, '200000', '20000'],
      ['Алматы · 25–45 · все', 2, 20, '1500000', '75000'],
      ['Весь Казахстан · 18–65 · женщины · расширение Meta', 1, 0, '300000', null],
    ]);
    expect(lib.audiences[1]!.lastLaunchId).toBe('b');
    expect(lib.audiences[1]!.settings.cities).toEqual([{ key: '1', name: 'Алматы' }]);
    expect(lib.creatives.map((c) => [c.fileName, c.kind, c.launches, c.leads, c.cplMinor, c.bestHeadline])).toEqual([
      ['spa.jpg', 'IMAGE', 1, 10, '20000', 'Номер у гор'],
      ['room.jpg', 'IMAGE', 2, 20, '75000', 'Номер у гор'],
      ['tour.mp4', 'VIDEO', 1, 0, null, 'Номер у гор'],
    ]);
  });

  it('неудачные и идущие запуски не считаются; расход разных валют не складывается', () => {
    const lib = adLibrary([
      base({ id: 'f', status: 'FAILED' }),
      base({ id: 'r', status: 'RUNNING' }),
      base({ id: 'k' }),
      base({ id: 'u', currency: 'USD', stats: { spendMinor: 2000n, leads: 1, impressions: 1, clicks: 1 } }),
    ]);
    expect(lib.audiences.map((a) => [a.currency, a.launches, a.spendMinor])).toEqual([
      ['USD', 1, '2000'],
      ['KZT', 1, '1000000'],
    ]);
  });

  it('без дней кабинета: заявок и расхода нет, цена не считается; без креатива строки креатива нет', () => {
    const lib = adLibrary([base({ stats: null, creative: null })]);
    expect(lib.audiences[0]).toMatchObject({ leads: 0, spendMinor: '0', cplMinor: null });
    expect(lib.creatives).toEqual([]);
  });

  it('битые настройки старого запуска пропускаются, а не роняют экран', () => {
    const lib = adLibrary([base({ settings: { headline: 'x' } as never }), base({ id: 'ok' })]);
    expect(lib.audiences).toHaveLength(1);
  });
});
