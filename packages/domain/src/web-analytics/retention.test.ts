import { describe, expect, it } from 'vitest';
import { WEB_RETENTION_MONTHS, webRetentionCutoff } from './retention';

describe('хранение сырых данных счётчика (план среза 8 §12, DATA_MODEL §11)', () => {
  it('13 месяцев', () => {
    expect(WEB_RETENTION_MONTHS).toBe(13);
  });

  it('граница — ровно 13 месяцев назад по UTC: первые данные 12.09.2026 уходят с 13.10.2027', () => {
    expect(webRetentionCutoff(new Date('2027-10-13T00:00:00Z')).toISOString()).toBe(
      '2026-09-13T00:00:00.000Z',
    );
  });

  it('срок можно задать; входная дата не меняется', () => {
    const now = new Date('2027-01-15T12:00:00Z');
    expect(webRetentionCutoff(now, 1).toISOString()).toBe('2026-12-15T12:00:00.000Z');
    expect(now.toISOString()).toBe('2027-01-15T12:00:00.000Z');
  });
});
