import { describe, expect, it } from 'vitest';
import { isPublicEntryPath } from './public-entry';

describe('isPublicEntryPath', () => {
  it('гость открывает оценку по QR без входа, рабочие экраны остаются закрытыми', () => {
    expect(isPublicEntryPath('/rate/abc')).toBe(true);
    expect(isPublicEntryPath('/reviews/synthetic-token')).toBe(true);
    expect(isPublicEntryPath('/invite/abc')).toBe(true);
    expect(isPublicEntryPath('/orders')).toBe(false);
    expect(isPublicEntryPath('/rates')).toBe(false);
  });
});
