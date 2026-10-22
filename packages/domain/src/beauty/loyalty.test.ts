import { describe, expect, it } from 'vitest';
import {
  CERTIFICATE_ALPHABET,
  accrualReversal,
  bonusAccrual,
  bonusBalance,
  certificateExpiry,
  certificateRedeem,
  certificateStatus,
  generateCertificateCode,
  maxRedeem,
  normalizeCertificateCode,
  parseBonusAdjustment,
  parseBonusProgram,
  parseCertificateSale,
} from './loyalty';

const day = (d: string) => new Date(`${d}T12:00:00Z`);

describe('бонусы', () => {
  it('начисление процентом с округлением вниз, без float', () => {
    expect(bonusAccrual(199_999n, 5)).toBe(9_999n);
    expect(bonusAccrual(100n, 0)).toBe(0n);
    expect(bonusAccrual(0n, 5)).toBe(0n);
    expect(() => bonusAccrual(100n, 101)).toThrow();
  });
  it('списать можно не больше доли чека и не больше баланса', () => {
    expect(maxRedeem(1_000_000n, 500_000n, 30)).toBe(300_000n);
    expect(maxRedeem(1_000_000n, 100_000n, 30)).toBe(100_000n);
    expect(maxRedeem(1_000_000n, -5n, 30)).toBe(0n);
    expect(maxRedeem(999n, 1_000n, 30)).toBe(299n);
  });
  it('баланс: сумма движений, сгоревшие начисления не считаются, списание берёт раньше сгорающие', () => {
    const entries = [
      { amountMinor: 1000n, createdAt: day('2026-01-01'), expiresAt: day('2026-02-01') },
      { amountMinor: 500n, createdAt: day('2026-01-10'), expiresAt: null },
      { amountMinor: -800n, createdAt: day('2026-01-15'), expiresAt: null },
    ];
    // до сгорания: 1000 + 500 - 800
    expect(bonusBalance(entries, day('2026-01-20'))).toBe(700n);
    // списание 800 взяло из первого (сгорающего) начисления, в нём осталось 200, оно сгорело
    expect(bonusBalance(entries, day('2026-03-01'))).toBe(500n);
  });
  it('сгоревшее до списания не тратится; минус остаётся минусом', () => {
    const entries = [
      { amountMinor: 1000n, createdAt: day('2026-01-01'), expiresAt: day('2026-01-05') },
      { amountMinor: -300n, createdAt: day('2026-01-10'), expiresAt: null },
    ];
    expect(bonusBalance(entries, day('2026-01-20'))).toBe(-300n);
  });
  it('снятие начисления при возврате пропорционально, не больше начисленного', () => {
    expect(accrualReversal(500_000n, 1_000_000n, 50_000n, 0n)).toBe(25_000n);
    expect(accrualReversal(1_000_000n, 1_000_000n, 50_000n, 40_000n)).toBe(10_000n);
    expect(accrualReversal(100n, 0n, 0n, 0n)).toBe(0n);
  });
  it('программа: проценты 0..100, срок пустой или дни', () => {
    expect(parseBonusProgram({ expectedRevision: 0, enabled: true, accrualPercent: 5, maxRedeemPercent: 30, expiresDays: null })).toEqual({
      ok: true, value: { expectedRevision: 0, enabled: true, accrualPercent: 5, maxRedeemPercent: 30, expiresDays: null },
    });
    expect(parseBonusProgram({ expectedRevision: 0, enabled: true, accrualPercent: 101, maxRedeemPercent: 30, expiresDays: null }).ok).toBe(false);
    expect(parseBonusProgram({ expectedRevision: 0, enabled: true, accrualPercent: 5, maxRedeemPercent: 30, expiresDays: 0 }).ok).toBe(false);
    expect(parseBonusProgram({ expectedRevision: 0, enabled: true, accrualPercent: 5.5, maxRedeemPercent: 30, expiresDays: null }).ok).toBe(false);
  });
  it('ручная правка: ненулевая сумма и причина', () => {
    expect(parseBonusAdjustment({ amountMinor: '-1500', reason: ' Ошибка кассира ' })).toEqual({ ok: true, value: { amountMinor: -1500n, reason: 'Ошибка кассира' } });
    expect(parseBonusAdjustment({ amountMinor: '0', reason: 'x' }).ok).toBe(false);
    expect(parseBonusAdjustment({ amountMinor: '100', reason: ' ' }).ok).toBe(false);
    expect(parseBonusAdjustment({ amountMinor: '1.5', reason: 'x' }).ok).toBe(false);
  });
});

describe('сертификаты', () => {
  it('код: 8 знаков без похожих 0 O 1 I L', () => {
    expect(CERTIFICATE_ALPHABET).not.toMatch(/[0O1IL]/);
    for (let i = 0; i < 200; i++) {
      const code = generateCertificateCode();
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      expect(code).not.toMatch(/[0O1IL]/);
    }
    let n = 0;
    const fixed = generateCertificateCode((size) => Uint8Array.from({ length: size }, () => n++ % 256));
    expect(fixed).toBe('ABCDEFGH');
  });
  it('ввод кода: регистр, пробелы и дефисы не важны', () => {
    expect(normalizeCertificateCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeCertificateCode('ABCD0FGH')).toBeNull();
    expect(normalizeCertificateCode('ABC')).toBeNull();
  });
  const cert = { businessId: 'b1', status: 'ACTIVE' as const, balanceMinor: 300_000n, expiresAt: day('2027-01-01'), currency: 'KZT' };
  const ask = { businessId: 'b1', now: day('2026-10-21'), amountMinor: 200_000n, currency: 'KZT' };
  it('погашение: хватает, частично, чужой бизнес, просрочен, аннулирован, пуст, валюта', () => {
    expect(certificateRedeem(cert, ask)).toEqual({ ok: true, redeemMinor: 200_000n, remainderMinor: 0n, balanceAfterMinor: 100_000n });
    expect(certificateRedeem(cert, { ...ask, amountMinor: 500_000n })).toEqual({ ok: true, redeemMinor: 300_000n, remainderMinor: 200_000n, balanceAfterMinor: 0n });
    expect(certificateRedeem(cert, { ...ask, businessId: 'b2' })).toEqual({ ok: false, reason: 'Сертификат не найден' });
    expect(certificateRedeem(cert, { ...ask, now: day('2027-01-02') })).toEqual({ ok: false, reason: 'Срок сертификата истёк' });
    expect(certificateRedeem({ ...cert, status: 'VOID' }, ask)).toEqual({ ok: false, reason: 'Сертификат аннулирован' });
    expect(certificateRedeem({ ...cert, balanceMinor: 0n, status: 'USED' }, ask)).toEqual({ ok: false, reason: 'Сертификат уже использован' });
    expect(certificateRedeem(cert, { ...ask, currency: 'USD' })).toEqual({ ok: false, reason: 'Валюта сертификата не совпадает с валютой записи' });
  });
  it('статус для экрана: просрочен считается по сроку', () => {
    expect(certificateStatus(cert, day('2026-10-21'))).toBe('ACTIVE');
    expect(certificateStatus(cert, day('2027-02-01'))).toBe('EXPIRED');
    expect(certificateStatus({ ...cert, balanceMinor: 0n, status: 'USED' }, day('2027-02-01'))).toBe('USED');
  });
  it('срок по умолчанию 12 месяцев, конец месяца не перескакивает', () => {
    expect(certificateExpiry(new Date('2026-10-21T08:00:00Z'), 12).toISOString()).toBe('2027-10-21T08:00:00.000Z');
    expect(certificateExpiry(new Date('2026-01-31T08:00:00Z'), 1).toISOString()).toBe('2026-02-28T08:00:00.000Z');
  });
  it('продажа: сумма, способ живыми деньгами, срок 1..60 месяцев', () => {
    expect(parseCertificateSale({ amountMinor: 1_000_000, method: 'CASH', idempotencyKey: 'k1' })).toEqual({
      ok: true, value: { amountMinor: 1_000_000n, method: 'CASH', months: 12, buyerCustomerId: null, idempotencyKey: 'k1' },
    });
    expect(parseCertificateSale({ amountMinor: 1, method: 'BONUS', idempotencyKey: 'k1' }).ok).toBe(false);
    expect(parseCertificateSale({ amountMinor: 0, method: 'CASH', idempotencyKey: 'k1' }).ok).toBe(false);
    expect(parseCertificateSale({ amountMinor: 1, method: 'CASH', idempotencyKey: 'k1', months: 61 }).ok).toBe(false);
    expect(parseCertificateSale({ amountMinor: 1, method: 'CASH', idempotencyKey: 'k1', buyerCustomerId: 'nope' }).ok).toBe(false);
  });
});
