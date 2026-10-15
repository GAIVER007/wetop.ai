import { describe, expect, it } from 'vitest';
import { csvField, csvTenge } from './csv';
import { operationsCsv } from './operations-csv';

describe('защита CSV от формул (RPT2.2a, OWASP CSV injection)', () => {
  it.each(['=1+1', '+7701', '-2+3', '@SUM(A1)', '\tx', '\rx', '=HYPERLINK("http://x","y")'])(
    'текст «%s» в начале ячейки обезвреживается апострофом',
    (v) => {
      const out = csvField(v).replace(/^"|"$/g, '');
      expect(out.startsWith("'")).toBe(true);
    },
  );

  it('суммы с минусом и обычный текст остаются как есть', () => {
    expect(csvField(csvTenge('300000', true))).toBe('-3000,00');
    expect(csvField('-3000,00')).toBe('-3000,00');
    expect(csvField('Kaspi')).toBe('Kaspi');
    expect(csvField('27.09.2026')).toBe('27.09.2026');
    expect(csvField('')).toBe('');
  });

  it('кавычки и «;» по-прежнему экранируются, апостроф ставится до кавычек', () => {
    expect(csvField('=a;b')).toBe('"\'=a;b"');
  });

  it('комментарий и статья в ленте операций не становятся формулой', () => {
    const csv = operationsCsv([
      {
        kind: 'EXPENSE',
        id: 'e1',
        at: '2026-09-27T09:05:00.000Z',
        localAt: '2026-09-27 14:05',
        method: 'CASH',
        methodTo: null,
        amountMinor: '100000',
        status: 'COMPLETED',
        confirmationNumber: null,
        reservations: 0,
        guestLabel: '',
        category: '=cmd|calc',
        note: '@evil',
      } as Parameters<typeof operationsCsv>[0][number],
    ]);
    const line = csv.slice(1).split('\r\n')[1] ?? '';
    expect(line.endsWith(";'=cmd|calc;'@evil")).toBe(true);
    expect(line).toContain(';-1000,00;');
  });
});
