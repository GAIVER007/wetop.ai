import { describe, expect, it } from 'vitest';
import { operationsCsv } from './operations-csv';

const op = (over: Partial<Parameters<typeof operationsCsv>[0][number]> = {}) => ({
  kind: 'PAYMENT' as const,
  id: 'p1',
  at: '2026-09-27T09:05:00.000Z',
  localAt: '2026-09-27 14:05',
  method: 'KASPI',
  amountMinor: '1250050',
  status: 'COMPLETED' as const,
  confirmationNumber: '20260913-TESTAA',
  reservations: 1,
  guestLabel: 'Гость Тестовый',
  ...over,
});

describe('выгрузка «Оплаты и возвраты» в CSV (ADR-113, F2)', () => {
  it('Excel в русской раскладке: BOM, «;», сумма с запятой без пробелов, дата ДД.ММ.ГГГГ и время по часам объекта', () => {
    const csv = operationsCsv([op()]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const [head, line] = csv.slice(1).split('\r\n');
    expect(head).toBe('Дата;Время;Тип;Статус;Способ;Сумма, ₸;Бронь');
    expect(line).toBe('27.09.2026;14:05;Оплата;проведена;Kaspi;12500,50;20260913-TESTAA');
  });

  it('возврат — с минусом, аннулированная оплата — своим статусом; бронь на несколько счетов названа числом', () => {
    const csv = operationsCsv([
      op({ kind: 'REFUND', amountMinor: '300000', method: 'CASH' }),
      op({ status: 'VOIDED', reservations: 3 }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe('27.09.2026;14:05;Возврат;проведён;Наличные;-3000,00;20260913-TESTAA');
    expect(lines[2]).toBe(
      '27.09.2026;14:05;Оплата;аннулирована;Kaspi;12500,50;20260913-TESTAA и ещё 2',
    );
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
    expect(lines[1]!.endsWith(';"A;""B"""')).toBe(true);
    expect(lines[2]!.endsWith(';12500,50;')).toBe(true);
  });
});
