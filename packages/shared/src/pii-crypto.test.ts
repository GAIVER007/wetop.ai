import { describe, expect, it } from 'vitest';
import { PiiKeyMissingError, decryptPii, encryptPii, maskNumber } from './pii-crypto';

const KEY = 'a'.repeat(64);
describe('pii-crypto', () => {
  it('round-trips with a random IV, so two encryptions of the same value differ', () => {
    const a = encryptPii('N1234567', KEY);
    const b = encryptPii('N1234567', KEY);
    expect(a).not.toBe(b);
    expect(a.startsWith('v1:')).toBe(true);
    expect(decryptPii(a, KEY)).toBe('N1234567');
    expect(decryptPii(b, KEY)).toBe('N1234567');
  });
  it('refuses to work without a key and rejects a wrong key', () => {
    expect(() => encryptPii('x', '')).toThrow(PiiKeyMissingError);
    expect(() => decryptPii(encryptPii('x', KEY), 'b'.repeat(64))).toThrow();
  });
  it('accepts a non-hex passphrase (derived via SHA-256) and masks numbers for display', () => {
    expect(decryptPii(encryptPii('AB 123', 'passphrase'), 'passphrase')).toBe('AB 123');
    expect(maskNumber('N1234567')).toBe('****4567');
    expect(maskNumber('12')).toBe('**');
  });
});
