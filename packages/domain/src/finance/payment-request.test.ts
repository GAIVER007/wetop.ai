import { describe, expect, it } from 'vitest';
import {
  PAYMENT_REQUEST_METHODS,
  parsePaymentRequestInput,
  paymentRequestMessage,
} from './payment-request';

describe('запрос оплаты: разбор формы (DATA_MODEL §24, ADR-144)', () => {
  it('Kaspi по телефону: сумма в тенге строкой → тиыны, ссылки нет', () => {
    expect(parsePaymentRequestInput({ method: 'KASPI', amount: '12000' })).toEqual({
      ok: true,
      value: { method: 'KASPI', amountMinor: 1_200_000n, link: null, note: null },
    });
  });
  it('копейки и пробелы: «12 000,50» → 1 200 050', () => {
    const r = parsePaymentRequestInput({
      method: 'HALYK',
      amount: '12 000,50',
      link: 'https://epay.example/p/1',
    });
    expect(r).toMatchObject({
      ok: true,
      value: { amountMinor: 1_200_050n, link: 'https://epay.example/p/1' },
    });
  });
  it.each([
    ['нет суммы', { method: 'KASPI' }, 'Сумма'],
    ['ноль', { method: 'KASPI', amount: '0' }, 'Сумма'],
    ['минус', { method: 'KASPI', amount: '-5' }, 'Сумма'],
    ['три знака после запятой', { method: 'KASPI', amount: '1,005' }, 'Сумма'],
    ['наличные — не запрос', { method: 'CASH', amount: '100' }, 'Способ'],
    ['ссылка не https', { method: 'HALYK', amount: '100', link: 'http://bank.example' }, 'Ссылка'],
    [
      'ссылка javascript',
      { method: 'HALYK', amount: '100', link: 'javascript:alert(1)' },
      'Ссылка',
    ],
    [
      'ссылка длиннее 500',
      { method: 'HALYK', amount: '100', link: `https://b.example/${'x'.repeat(500)}` },
      'Ссылка',
    ],
  ])('%s — отказ словами', (_name, input, word) => {
    const r = parsePaymentRequestInput(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(word);
  });
  it('способы — живые деньги со счётом или ссылкой', () => {
    expect(PAYMENT_REQUEST_METHODS).toEqual([
      'KASPI',
      'HALYK',
      'BANK_TRANSFER_PERSON',
      'CARD_TERMINAL',
    ]);
  });
});

describe('текст гостю о запросе оплаты', () => {
  const base = {
    propertyName: 'Хостел Тест',
    confirmationNumber: 'WEB-1042',
    amountMinor: '1200000',
    currency: 'KZT',
    method: 'KASPI' as const,
    link: null,
  };
  it('Kaspi по-русски: сумма, номер брони и где искать счёт', () => {
    const t = paymentRequestMessage({ ...base, lang: 'ru' });
    expect(t).toBe(
      'Хостел Тест: счёт на оплату брони WEB-1042, 12 000 ₸. Счёт выставлен в Kaspi на ваш номер телефона: откройте Kaspi.kz, раздел «Платежи», и подтвердите оплату.',
    );
  });
  it('ссылка банка: в тексте ссылка', () => {
    const t = paymentRequestMessage({
      ...base,
      lang: 'en',
      method: 'HALYK',
      link: 'https://epay.example/p/1',
    });
    expect(t).toContain('https://epay.example/p/1');
    expect(t).toContain('12 000 ₸');
    expect(t).toContain('WEB-1042');
  });
  it('без длинного тире на всех языках', () => {
    for (const lang of ['ru', 'kk', 'en', 'zh'] as const) {
      for (const method of PAYMENT_REQUEST_METHODS) {
        expect(
          paymentRequestMessage({ ...base, lang, method, link: 'https://b.example/p' }),
        ).not.toContain('—');
      }
    }
  });
});
