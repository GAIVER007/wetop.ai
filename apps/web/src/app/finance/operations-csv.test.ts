import { describe, expect, it } from 'vitest';
import { operationsCsv } from './operations-csv';

const op = (over: Partial<Parameters<typeof operationsCsv>[0][number]> = {}) => ({
  kind: 'PAYMENT' as const,
  id: 'p1',
  at: '2026-09-27T09:05:00.000Z',
  localAt: '2026-09-27 14:05',
  method: 'KASPI',
  methodTo: null,
  amountMinor: '1250050',
  status: 'COMPLETED' as const,
  confirmationNumber: '20260913-TESTAA',
  reservations: 1,
  guestLabel: 'Гость Тестовый',
  category: null,
  note: null,
  ...over,
});

describe('выгрузка общей ленты денег в CSV (ADR-113 F2; касса — §21)', () => {
  it('Excel в русской раскладке: BOM, «;», сумма с запятой без пробелов, дата ДД.ММ.ГГГГ и время по часам объекта', () => {
    const csv = operationsCsv([op()]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [head, line] = csv.slice(1).split('\r\n');
    expect(head).toBe('Дата;Время;Тип;Статус;Способ;Сумма, ₸;Бронь;Статья;Комментарий');
    expect(line).toBe('27.09.2026;14:05;Оплата;проведена;Kaspi;12500,50;20260913-TESTAA;;');
  });

  it('возврат — с минусом, аннулированная оплата — своим статусом; бронь на несколько счетов названа числом', () => {
    const csv = operationsCsv([
      op({ kind: 'REFUND', amountMinor: '300000', method: 'CASH' }),
      op({ status: 'VOIDED', reservations: 3 }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe('27.09.2026;14:05;Возврат;проведён;Наличные;-3000,00;20260913-TESTAA;;');
    expect(lines[2]).toBe(
      '27.09.2026;14:05;Оплата;аннулирована;Kaspi;12500,50;20260913-TESTAA и ещё 2;;',
    );
  });

  it('касса (§21): расход с минусом и статьёй, перевод «откуда → куда», комментарий — колонкой', () => {
    const csv = operationsCsv([
      op({
        kind: 'EXPENSE' as never,
        amountMinor: '500000',
        method: 'CASH',
        confirmationNumber: null,
        reservations: 0,
        guestLabel: null,
        category: 'Зарплата',
        note: 'аванс',
      }),
      op({
        kind: 'TRANSFER' as never,
        amountMinor: '100000',
        method: 'KASPI',
        methodTo: 'CASH',
        confirmationNumber: null,
        reservations: 0,
        guestLabel: null,
      }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe('27.09.2026;14:05;Расход;проведён;Наличные;-5000,00;;Зарплата;аванс');
    expect(lines[2]).toBe('27.09.2026;14:05;Перевод;проведён;Kaspi → Наличные;1000,00;;;');
  });

  it('имён гостей в файле нет: файл уходит из системы, бронь находится по номеру', () => {
    expect(operationsCsv([op()])).not.toContain('Гость Тестовый');
  });

  it('поле с «;» или кавычкой берётся в кавычки; пустая бронь — пустое поле', () => {
    const csv = operationsCsv([
      op({ confirmationNumber: 'A;"B"' }),
      op({ confirmationNumber: null }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]!.includes(';"A;""B""";')).toBe(true);
    expect(lines[2]!.includes(';12500,50;;;')).toBe(true);
  });
});
