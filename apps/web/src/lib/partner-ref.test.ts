import { describe, expect, it } from 'vitest';
import { partnerCodeOf, partnerCookieValue, readPartnerCookie } from './partner-ref';

describe('ссылка партнёра: кука', () => {
  it('код и канал туда и обратно; чужое значение: null', () => {
    expect(partnerCodeOf(' p007 ')).toBe('P007');
    expect(partnerCodeOf('<script>')).toBeNull();
    expect(readPartnerCookie(partnerCookieValue('P007', 'instagram'))).toEqual({ partnerCode: 'P007', partnerChannel: 'instagram' });
    expect(readPartnerCookie('P007')).toEqual({ partnerCode: 'P007' });
    expect(readPartnerCookie('P007:%%%')).toBeNull();
    expect(readPartnerCookie('x:y')).toBeNull();
    expect(readPartnerCookie(undefined)).toBeNull();
  });
});
