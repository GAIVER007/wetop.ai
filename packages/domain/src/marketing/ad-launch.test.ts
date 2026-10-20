import { describe, expect, it } from 'vitest';
import { checkLaunchBudget, daysLeftInMonth, launchBudgetRoom, parseLaunchInput, toBaseMinor } from './ad-launch';

/**
 * Запуск рекламы (DATA_MODEL §57, ADR-MKT-LAUNCH): правило денег «остаток плана / дни» и проверка настроек мастера.
 * Суммы и тексты вымышленные (ADR-010).
 */
describe('запуск рекламы: предел бюджета', () => {
  it('дни до конца месяца, включая сегодня', () => {
    expect(daysLeftInMonth('2026-10-16')).toBe(16);
    expect(daysLeftInMonth('2026-10-31')).toBe(1);
    expect(daysLeftInMonth('2026-02-01')).toBe(28);
    expect(daysLeftInMonth('2028-02-29')).toBe(1);
  });

  it('курс к валюте отчётности: целые тиыны вверх до тиына, без float', () => {
    expect(toBaseMinor(500n, '1')).toBe(500n);
    // 5 USD по 480,123456 = 2400,61728 ₸ → 240 062 тиына (вверх: предел не занижается)
    expect(toBaseMinor(500n, '480.123456')).toBe(240062n);
    expect(() => toBaseMinor(500n, '0')).toThrow(/курс/i);
    expect(() => toBaseMinor(500n, '1e3')).toThrow(/курс/i);
  });

  it('(действующие + новый) × дни не больше остатка плана канала', () => {
    // план 1 000 000, потрачено 200 000, остаток 800 000; 16 дней × 50 000 = 800 000: ровно можно
    expect(() =>
      checkLaunchBudget({
        planMinor: 1_000_000n,
        spentMinor: 200_000n,
        activeDailyMinor: 0n,
        newDailyMinor: 50_000n,
        daysLeft: 16,
      }),
    ).not.toThrow();
    // с уже идущей кампанией 10 000 в день: 60 000 × 16 = 960 000 > 800 000
    expect(() =>
      checkLaunchBudget({
        planMinor: 1_000_000n,
        spentMinor: 200_000n,
        activeDailyMinor: 10_000n,
        newDailyMinor: 50_000n,
        daysLeft: 16,
      }),
    ).toThrow(/не больше 400 в день/);
  });

  it('подсказка мастера: сколько ещё можно в день, та же граница, что у проверки', () => {
    const q = { planMinor: 1_000_000n, spentMinor: 200_000n, activeDailyMinor: 10_000n, daysLeft: 16 };
    expect(launchBudgetRoom(q)).toBe(40_000n);
    expect(() => checkLaunchBudget({ ...q, newDailyMinor: 40_000n })).not.toThrow();
    expect(() => checkLaunchBudget({ ...q, newDailyMinor: 40_001n })).toThrow();
    expect(launchBudgetRoom({ ...q, planMinor: null })).toBeNull();
    expect(launchBudgetRoom({ ...q, spentMinor: 2_000_000n })).toBe(0n);
  });

  it('нет плана канала Meta на месяц: запуск запрещён с подсказкой', () => {
    expect(() =>
      checkLaunchBudget({
        planMinor: null,
        spentMinor: 0n,
        activeDailyMinor: 0n,
        newDailyMinor: 1n,
        daysLeft: 10,
      }),
    ).toThrow(/план/);
  });

  it('план уже выбран: запуск запрещён', () => {
    expect(() =>
      checkLaunchBudget({
        planMinor: 100n,
        spentMinor: 100n,
        activeDailyMinor: 0n,
        newDailyMinor: 1n,
        daysLeft: 3,
      }),
    ).toThrow(/исчерпан/);
  });
});

describe('запуск рекламы: настройки мастера', () => {
  const base = {
    requestKey: '6f1c2b0e-2f7d-4a39-9b5e-1d2c3b4a5f60',
    creativeId: '0b0c2a6e-6a43-4c1d-8f77-6c0d3f1d2e11',
    destination: 'WHATSAPP',
    dailyBudgetMinor: '500',
    fxRate: '480',
    headline: 'Осень у моря',
    primaryText: 'Номер с видом на горы. Напишите.',
    description: '',
    pageId: '555',
    instagramUserId: '777',
    leadFormId: '',
    link: '',
    countryCode: 'KZ',
    cities: [{ key: '1234567', name: 'Алматы' }],
    ageMin: 25,
    ageMax: 54,
    genders: [],
    advantageAudience: false,
    welcome: { text: 'Здравствуйте!', autofill: 'Хочу узнать цены' },
    proposal: { headline: 'Осень у моря' },
  };

  it('годные настройки: деньги bigint, пустые строки в null, приветствие у переписки', () => {
    const p = parseLaunchInput(base);
    expect(p.dailyBudgetMinor).toBe(500n);
    expect(p.fxRate).toBe('480');
    expect(p.description).toBeNull();
    expect(p.leadFormId).toBeNull();
    expect(p.cities).toEqual([{ key: '1234567', name: 'Алматы' }]);
    expect(p.welcome).toEqual({ text: 'Здравствуйте!', autofill: 'Хочу узнать цены' });
  });

  it('по назначению: форма нужна заявкам, https-адрес сайту; Messenger и Direct закрыты', () => {
    expect(() => parseLaunchInput({ ...base, destination: 'LEAD_FORM' })).toThrow(/форм/);
    expect(
      parseLaunchInput({ ...base, destination: 'LEAD_FORM', leadFormId: '999' }).welcome,
    ).toBeNull();
    expect(() =>
      parseLaunchInput({ ...base, destination: 'WEBSITE', link: 'http://site.test' }),
    ).toThrow(/https/);
    expect(
      parseLaunchInput({ ...base, destination: 'WEBSITE', link: 'https://site.test/a' }).link,
    ).toBe('https://site.test/a');
    expect(() => parseLaunchInput({ ...base, destination: 'MESSENGER' })).toThrow(/Messenger/);
  });

  it('отказы: бюджет не целое положительное, возраст, Advantage+ с минимальным возрастом выше 25, ключ повтора', () => {
    expect(() => parseLaunchInput({ ...base, dailyBudgetMinor: '0' })).toThrow(/бюджет/i);
    expect(() => parseLaunchInput({ ...base, dailyBudgetMinor: '5.5' })).toThrow(/бюджет/i);
    expect(() => parseLaunchInput({ ...base, ageMin: 60, ageMax: 30 })).toThrow(/возраст/i);
    expect(() => parseLaunchInput({ ...base, advantageAudience: true, ageMin: 30 })).toThrow(
      /18–25/,
    );
    expect(() => parseLaunchInput({ ...base, requestKey: 'x' })).toThrow();
    expect(() => parseLaunchInput({ ...base, headline: '' })).toThrow(/заголов/);
    expect(() => parseLaunchInput({ ...base, cities: [{ key: 'не ключ', name: 'x' }] })).toThrow(
      /город/i,
    );
  });
});
