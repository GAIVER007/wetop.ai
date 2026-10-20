import { describe, expect, it } from 'vitest';
import {
  MARKETING_PLATFORMS,
  MarketingBudgetError,
  parseMarketingBudgetInput,
  parseMarketingBudgetLinesInput,
  parseMarketingExpenseInput,
} from './budget';

const ctx = { reportingCurrency: 'KZT' };

const base = {
  date: '2026-10-08',
  platform: 'META',
  category: 'Реклама',
  amount: '120',
};

describe('расход маркетинга: разбор ввода (DATA_MODEL §41.1)', () => {
  it('валюта отчётности: курс 1, base_amount равен сумме', () => {
    const e = parseMarketingExpenseInput(base, ctx);
    expect(e.amount).toBe(12000n);
    expect(e.currency).toBe('KZT');
    expect(e.fxRate).toBe('1');
    expect(e.baseAmount).toBe(12000n);
    expect(e.countedInBudget).toBe(true);
    expect(e.campaign).toBeNull();
    expect(e.description).toBeNull();
  });

  it('чужая валюта: base_amount по курсу на дату операции, округление к ближайшему', () => {
    const e = parseMarketingExpenseInput(
      { ...base, amount: '120', currency: 'usd', fxRate: '543,27' },
      ctx,
    );
    expect(e.currency).toBe('USD');
    expect(e.fxRate).toBe('543.27');
    // 120.00 USD × 543.27 = 65 192.40 KZT → 6 519 240 тиын
    expect(e.baseAmount).toBe(6519240n);
  });

  it('курс с шестью знаками: целочисленная арифметика без float', () => {
    const e = parseMarketingExpenseInput(
      { ...base, amount: '0.03', currency: 'USD', fxRate: '543.123456' },
      ctx,
    );
    // 3 цента × 543.123456 = 16.29370368 KZT → 1629.370368 тиына → 1629
    expect(e.baseAmount).toBe(1629n);
  });

  it('чужая валюта без курса: отказ словами', () => {
    expect(() => parseMarketingExpenseInput({ ...base, currency: 'USD' }, ctx)).toThrow(
      MarketingBudgetError,
    );
  });

  it('совпадающая валюта: присланный курс не ломает пересчёт, принудительно 1', () => {
    const e = parseMarketingExpenseInput({ ...base, currency: 'KZT', fxRate: '2' }, ctx);
    expect(e.fxRate).toBe('1');
    expect(e.baseAmount).toBe(e.amount);
  });

  it('переключатель бюджета и необязательные поля', () => {
    const e = parseMarketingExpenseInput(
      {
        ...base,
        campaign: '  Лиды: Клиника  ',
        description: 'Тест новых креативов',
        countedInBudget: false,
      },
      ctx,
    );
    expect(e.campaign).toBe('Лиды: Клиника');
    expect(e.description).toBe('Тест новых креативов');
    expect(e.countedInBudget).toBe(false);
  });

  it.each([
    ['дата', { ...base, date: '08.10.2026' }],
    ['дата', { ...base, date: '2026-13-40' }],
    ['платформа', { ...base, platform: 'FAX' }],
    ['сумма', { ...base, amount: '0' }],
    ['сумма', { ...base, amount: '-5' }],
    ['сумма', { ...base, amount: 'сто' }],
    ['курс', { ...base, currency: 'USD', fxRate: '0' }],
    ['курс', { ...base, currency: 'USD', fxRate: 'много' }],
    ['валюта', { ...base, currency: 'TENGE' }],
    ['статья', { ...base, category: '   ' }],
  ])('отказ: %s', (_name, body) => {
    expect(() => parseMarketingExpenseInput(body, ctx)).toThrow(MarketingBudgetError);
  });

  it('длина полей ограничена как в базе', () => {
    expect(() =>
      parseMarketingExpenseInput({ ...base, campaign: 'к'.repeat(201) }, ctx),
    ).toThrow(MarketingBudgetError);
    expect(() =>
      parseMarketingExpenseInput({ ...base, category: 'с'.repeat(101) }, ctx),
    ).toThrow(MarketingBudgetError);
    expect(() =>
      parseMarketingExpenseInput({ ...base, description: 'о'.repeat(501) }, ctx),
    ).toThrow(MarketingBudgetError);
  });

  it('каналы ТЗ §4 на месте', () => {
    expect(MARKETING_PLATFORMS).toContain('META');
    expect(MARKETING_PLATFORMS).toContain('WHATSAPP');
    expect(MARKETING_PLATFORMS).toHaveLength(9);
  });
});

describe('план бюджета месяца: разбор ввода (DATA_MODEL §41.2)', () => {
  it('месяц нормализуется к первому числу, сумма в валюте отчётности', () => {
    const b = parseMarketingBudgetInput({ month: '2026-10', amount: '3000' });
    expect(b.month).toBe('2026-10-01');
    expect(b.amount).toBe(300000n);
  });

  it('полная дата тоже принимается и усечётся к месяцу', () => {
    expect(parseMarketingBudgetInput({ month: '2026-10-15', amount: '1' }).month).toBe(
      '2026-10-01',
    );
  });

  it.each([
    ['месяц', { month: 'октябрь', amount: '1' }],
    ['месяц', { month: '2026-00', amount: '1' }],
    ['сумма', { month: '2026-10', amount: '0' }],
    ['сумма', { month: '2026-10', amount: '-1' }],
  ])('отказ: %s', (_name, body) => {
    expect(() => parseMarketingBudgetInput(body)).toThrow(MarketingBudgetError);
  });
});

describe('расход и кампания (DATA_MODEL §53, ADR-MKT-B3)', () => {
  it('кампания необязательна; идентификатор только uuid, приводится к нижнему регистру', () => {
    expect(parseMarketingExpenseInput(base, ctx).campaignId).toBeNull();
    const id = '7B61F3E1-0000-4000-8000-000000000001';
    expect(parseMarketingExpenseInput({ ...base, campaignId: id }, ctx).campaignId).toBe(id.toLowerCase());
    expect(() => parseMarketingExpenseInput({ ...base, campaignId: 'осень' }, ctx)).toThrow('Кампания');
  });
});

describe('план по каналам: разбор ввода (DATA_MODEL §52, ADR-MKT-B7)', () => {
  it('месяц к первому числу, суммы в тиынах, пустая сумма значит «канала в плане нет»', () => {
    const r = parseMarketingBudgetLinesInput({
      month: '2026-10',
      lines: [
        { platform: 'META', amount: '120 000' },
        { platform: 'GOOGLE', amount: '' },
        { platform: 'SITE', amount: '5000,5' },
      ],
    });
    expect(r).toEqual({
      month: '2026-10-01',
      lines: [
        { platform: 'META', amount: 12000000n },
        { platform: 'SITE', amount: 500050n },
      ],
    });
  });

  it('пустой список убирает разбивку месяца целиком', () => {
    expect(parseMarketingBudgetLinesInput({ month: '2026-10', lines: [] }).lines).toEqual([]);
  });

  it.each([
    ['неизвестный канал', { month: '2026-10', lines: [{ platform: 'YANDEX', amount: '1' }] }, 'Канал'],
    ['канал дважды', { month: '2026-10', lines: [{ platform: 'META', amount: '1' }, { platform: 'META', amount: '2' }] }, 'дважды'],
    ['ноль', { month: '2026-10', lines: [{ platform: 'META', amount: '0' }] }, 'больше нуля'],
    ['не список', { month: '2026-10', lines: 'META' }, 'список'],
    ['месяц', { month: '2026-13', lines: [] }, 'Месяц'],
  ])('отказ: %s', (_name, body, word) => {
    expect(() => parseMarketingBudgetLinesInput(body as Record<string, unknown>)).toThrow(word);
  });
});

