import { describe, expect, it } from 'vitest';
import { MarketingBudgetError } from './budget';
import { parseMarketingExpensesCsv } from './expense-import';

const ctx = { reportingCurrency: 'KZT' };
const HEAD = 'Дата;Платформа;Кампания;Статья;Описание;Сумма;Валюта;Курс;Сумма, KZT;В бюджете';

const errorOf = (text: string): string => {
  try {
    parseMarketingExpensesCsv(text, ctx);
  } catch (e) {
    if (e instanceof MarketingBudgetError) return e.message;
    throw e;
  }
  throw new Error('разбор не отказал');
};

describe('импорт расходов маркетинга из CSV (МКТ-В2)', () => {
  it('файл выгрузки читается обратно: BOM, кавычки, подписи платформ, «нет» в бюджете', () => {
    const csv =
      '\uFEFF' +
      [
        HEAD,
        '"2026-10-05";"Meta Ads";"Осень";"Реклама";"Охват; сторис";"12500.5";"KZT";"1";"12500.5";"да"',
        '"2026-10-06";"Google Ads";"";"Реклама";"";"20";"USD";"543.27";"10865.4";"нет"',
      ].join('\r\n');
    const rows = parseMarketingExpensesCsv(csv, ctx);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: '2026-10-05',
      platform: 'META',
      campaign: 'Осень',
      description: 'Охват; сторис',
      amount: 1250050n,
      baseAmount: 1250050n,
      countedInBudget: true,
    });
    // сумма в валюте отчётности из файла не берётся: пересчёт по курсу, как при ручном вводе
    expect(rows[1]).toMatchObject({ platform: 'GOOGLE', currency: 'USD', baseAmount: 1086540n, countedInBudget: false });
  });

  it('после Excel: дата ДД.ММ.ГГГГ, запятая и пробелы в сумме, коды платформ, колонки в другом порядке', () => {
    const csv = ['Сумма;Дата;Статья;Платформа', '12 500,50;05.10.2026;Креативы;tiktok', '7 000;6.10.2026;Прочее;Прочие', ''].join('\n');
    const rows = parseMarketingExpensesCsv(csv, ctx);
    expect(rows.map((r) => [r.date, r.platform, r.amount])).toEqual([
      ['2026-10-05', 'TIKTOK', 1250050n],
      ['2026-10-06', 'OTHER', 700000n],
    ]);
    expect(rows[0]!.currency).toBe('KZT');
  });

  it('ошибки всех строк одним отказом, с номерами строк файла', () => {
    const msg = errorOf([HEAD, '2026-10-05;Meta Ads;;Реклама;;100;KZT;1;;да', '2026-13-01;Meta Ads;;Реклама;;100;;;;', '2026-10-07;Яндекс;;Реклама;;0;;;;'].join('\n'));
    expect(msg).toContain('Строка 3: Дата');
    expect(msg).toContain('Строка 4: Платформа');
    expect(msg).not.toContain('Строка 2');
  });

  it('без обязательной колонки и без строк: понятный отказ', () => {
    expect(errorOf('Дата;Платформа;Статья\n2026-10-05;Meta Ads;Реклама')).toContain('нет колонки «Сумма»');
    expect(errorOf(HEAD)).toContain('нет ни одной строки');
    expect(errorOf('')).toContain('нет ни одной строки');
  });

  it('не больше 1000 строк за раз', () => {
    const line = '2026-10-05;Meta Ads;;Реклама;;1;;;;';
    expect(errorOf([HEAD, ...Array(1001).fill(line)].join('\n'))).toContain('1000');
  });
});
