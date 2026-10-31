import { describe, expect, it } from 'vitest';
import { isPublicEntryPath } from './public-entry';

describe('isPublicEntryPath', () => {
  it('гость открывает оценку по QR без входа, рабочие экраны остаются закрытыми', () => {
    expect(isPublicEntryPath('/rate/abc')).toBe(true);
    expect(isPublicEntryPath('/reviews/synthetic-token')).toBe(true);
    expect(isPublicEntryPath('/invite/abc')).toBe(true);
    // ссылка партнёра и его кабинет вне стойки (DATA_MODEL §63.3): вход проверяет сама страница кабинета
    expect(isPublicEntryPath('/start')).toBe(true);
    expect(isPublicEntryPath('/partner/join/abc')).toBe(true);
    expect(isPublicEntryPath('/partner')).toBe(true);
    expect(isPublicEntryPath('/orders')).toBe(false);
    expect(isPublicEntryPath('/rates')).toBe(false);
  });
});
