import { describe, expect, it } from 'vitest';
import type { ReservationFinance } from '../../../../lib/api';
import {
  CONTRACT_T,
  INVOICE_T,
  PROPERTY,
  cancellationRule,
  invoiceLines,
  nightsBetween,
  sumMinor,
} from './forms';

/** Заготовки печатных форм (договор, счёт): словари RU/KZ, ночи, строки счёта, суммы без float. */
const finance: ReservationFinance = {
  confirmationNumber: '20260911-ABC123',
  currency: 'KZT',
  chargedMinor: '1500000',
  paidMinor: '500000',
  refundedMinor: '0',
  balanceMinor: '1000000',
  folios: [
    {
      id: 'f1',
      reservationItemId: 'i1',
      status: 'OPEN',
      currency: 'KZT',
      stay: {
        accommodationTypeName: 'Тестовая койка',
        arrivalDate: '2026-09-11',
        departureDate: '2026-09-13',
        status: 'CONFIRMED',
      },
      charges: [
        {
          id: 'c1',
          kind: 'ACCOMMODATION',
          serviceCode: null,
          description: 'Проживание',
          quantity: 1,
          unitPriceMinor: '1200000',
          amountMinor: '1200000',
          serviceDate: '2026-09-11',
          createdAt: '2026-09-11T05:00:00Z',
          voidedAt: null,
        },
        {
          id: 'c2',
          kind: 'SERVICE',
          serviceCode: 'towel',
          description: 'Полотенце (сторно)',
          quantity: 1,
          unitPriceMinor: '50000',
          amountMinor: '50000',
          serviceDate: '2026-09-11',
          createdAt: '2026-09-11T05:00:00Z',
          voidedAt: '2026-09-11T06:00:00Z',
        },
      ],
      payments: [],
      refunds: [],
      chargedMinor: '1200000',
      paidMinor: '500000',
      refundedMinor: '0',
      balanceMinor: '700000',
    },
    {
      id: 'f2',
      reservationItemId: 'i2',
      status: 'OPEN',
      currency: 'KZT',
      stay: {
        accommodationTypeName: 'Тестовая койка',
        arrivalDate: '2026-09-11',
        departureDate: '2026-09-13',
        status: 'CONFIRMED',
      },
      charges: [
        {
          id: 'c3',
          kind: 'SERVICE',
          serviceCode: 'breakfast',
          description: 'Завтрак',
          quantity: 2,
          unitPriceMinor: '150000',
          amountMinor: '300000',
          serviceDate: '2026-09-12',
          createdAt: '2026-09-11T05:00:00Z',
          voidedAt: null,
        },
      ],
      payments: [],
      refunds: [],
      chargedMinor: '300000',
      paidMinor: '0',
      refundedMinor: '0',
      balanceMinor: '300000',
    },
  ],
};

describe('печатные формы: словари и расчёты', () => {
  it('казахский словарь покрывает те же ключи, что русский, и без пустых строк', () => {
    for (const T of [CONTRACT_T, INVOICE_T]) {
      expect(Object.keys(T.kz).sort()).toEqual(Object.keys(T.ru).sort());
      for (const v of [...Object.values(T.ru), ...Object.values(T.kz)]) expect(v).not.toBe('');
    }
  });
  it('ночи считаются по датам проживания, а не по часам', () => {
    expect(nightsBetween('2026-09-11', '2026-09-13')).toBe(2);
    expect(nightsBetween('2026-09-11', '2026-09-11')).toBe(0);
  });
  it('строки счёта — все счета брони, сторнированные начисления не попадают', () => {
    const lines = invoiceLines(finance);
    expect(lines.map((l) => l.description)).toEqual(['Проживание', 'Завтрак']);
    expect(lines[1]).toMatchObject({
      quantity: 2,
      unitPriceMinor: '150000',
      amountMinor: '300000',
      serviceDate: '2026-09-12',
    });
  });
  it('сумма строк — integer minor units через BigInt, без потери точности', () => {
    expect(sumMinor(['900719925474099300', '1', '-5'])).toBe('900719925474099296');
    expect(sumMinor([])).toBe('0');
    expect(sumMinor(invoiceLines(finance).map((l) => l.amountMinor))).toBe('1500000');
  });
  it('правило отмены объекта (Q-103) есть на обоих языках и различается', () => {
    expect(cancellationRule('ru')).toMatch(/день заезда/);
    expect(cancellationRule('ru')).toMatch(/незаезд/);
    expect(cancellationRule('kz')).not.toBe('');
    expect(cancellationRule('kz')).not.toBe(cancellationRule('ru'));
  });
  it('реквизиты объекта взяты из OBJECT.md, банковские — плейсхолдеры', () => {
    expect(PROPERTY.name).toBe('Luxx Aparts');
    expect(PROPERTY.legalEntity).toMatch(/ИП/);
    expect(PROPERTY.bank).toBe('___');
    expect(PROPERTY.iban).toBe('___');
  });
});
