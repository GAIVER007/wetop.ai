/**
 * Бонусы и подарочные сертификаты салона (docs/decisions/2026-10-21-salon-reminders-loyalty.md, §2-3).
 * Деньги и бонусы только bigint в минорных единицах (AGENTS.md §12): 1 бонус = 1 единица валюты филиала.
 */
import { randomBytes } from 'node:crypto';
import { FOOD_PAYMENT_METHODS, type FoodPaymentMethod } from '../food/cash';

/** Способы оплаты записи, которые не являются деньгами в кассе (решение §«Последствия») */
export const LOYALTY_PAYMENT_METHODS = ['BONUS', 'GIFT_CERTIFICATE'] as const;
export type LoyaltyPaymentMethod = (typeof LOYALTY_PAYMENT_METHODS)[number];
export type AppointmentPaymentMethod = FoodPaymentMethod | LoyaltyPaymentMethod;
export const isLoyaltyMethod = (method: string): method is LoyaltyPaymentMethod =>
  (LOYALTY_PAYMENT_METHODS as readonly string[]).includes(method);
export const isMoneyMethod = (method: string): method is FoodPaymentMethod =>
  (FOOD_PAYMENT_METHODS as readonly string[]).includes(method);

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function percentOk(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

/** Начисление с оплаченной суммы, вниз до целой минорной единицы */
export function bonusAccrual(paidMinor: bigint, percent: number): bigint {
  if (!percentOk(percent)) throw new Error('Процент начисления от 0 до 100');
  if (paidMinor <= 0n) return 0n;
  return (paidMinor * BigInt(percent)) / 100n;
}

/** Сколько бонусов можно списать в этот чек: доля чека, но не больше баланса */
export function maxRedeem(totalMinor: bigint, balanceMinor: bigint, maxPercent: number): bigint {
  if (!percentOk(maxPercent)) throw new Error('Доля оплаты бонусами от 0 до 100');
  const cap = (totalMinor * BigInt(maxPercent)) / 100n;
  const balance = balanceMinor > 0n ? balanceMinor : 0n;
  return cap < balance ? cap : balance;
}

export interface BonusEntryForBalance {
  amountMinor: bigint;
  createdAt: Date;
  expiresAt: Date | null;
}

/**
 * Баланс = сумма движений; у начисления может быть срок. Списание берёт сначала из начислений, которые сгорят
 * раньше (живых на момент списания); остаток начисления после срока не считается.
 */
export function bonusBalance(entries: readonly BonusEntryForBalance[], now: Date): bigint {
  const ordered = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lots: Array<{ left: bigint; expiresAt: Date | null }> = [];
  let debt = 0n;
  const alive = (lot: { expiresAt: Date | null }, at: Date) => lot.expiresAt === null || lot.expiresAt.getTime() > at.getTime();
  for (const entry of ordered) {
    if (entry.amountMinor > 0n) {
      let left = entry.amountMinor;
      // долг (списание без живых начислений) гасится новым поступлением
      if (debt > 0n) {
        const take = left < debt ? left : debt;
        left -= take;
        debt -= take;
      }
      lots.push({ left, expiresAt: entry.expiresAt });
      continue;
    }
    let need = -entry.amountMinor;
    const usable = lots
      .filter((lot) => lot.left > 0n && alive(lot, entry.createdAt))
      .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
    for (const lot of usable) {
      if (need === 0n) break;
      const take = lot.left < need ? lot.left : need;
      lot.left -= take;
      need -= take;
    }
    debt += need;
  }
  return lots.filter((lot) => alive(lot, now)).reduce((sum, lot) => sum + lot.left, 0n) - debt;
}

/** Сколько начисленного снять при возврате денег: пропорционально, не больше ещё не снятого */
export function accrualReversal(refundMinor: bigint, paidMoneyMinor: bigint, accruedMinor: bigint, reversedMinor: bigint): bigint {
  if (paidMoneyMinor <= 0n || refundMinor <= 0n || accruedMinor <= 0n) return 0n;
  const share = (accruedMinor * refundMinor) / paidMoneyMinor;
  const left = accruedMinor - reversedMinor;
  if (left <= 0n) return 0n;
  return share < left ? share : left;
}

export interface BonusProgramInput {
  expectedRevision: number;
  enabled: boolean;
  accrualPercent: number;
  maxRedeemPercent: number;
  expiresDays: number | null;
}

export function parseBonusProgram(raw: unknown): Parsed<BonusProgramInput> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'Пришлите настройки бонусов' };
  const b = raw as Record<string, unknown>;
  const keys = ['expectedRevision', 'enabled', 'accrualPercent', 'maxRedeemPercent', 'expiresDays'];
  if (Object.keys(b).some((key) => !keys.includes(key))) return { ok: false, reason: 'Лишние поля в настройках бонусов' };
  const revision = b['expectedRevision'];
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0)
    return { ok: false, reason: 'Проверьте версию настроек' };
  if (typeof b['enabled'] !== 'boolean') return { ok: false, reason: 'Укажите, включены ли бонусы' };
  const accrual = b['accrualPercent'];
  const redeem = b['maxRedeemPercent'];
  if (typeof accrual !== 'number' || !percentOk(accrual)) return { ok: false, reason: 'Начисление: целый процент от 0 до 100' };
  if (typeof redeem !== 'number' || !percentOk(redeem)) return { ok: false, reason: 'Оплата бонусами: целый процент от 0 до 100' };
  const expires = b['expiresDays'] ?? null;
  if (expires !== null && (typeof expires !== 'number' || !Number.isInteger(expires) || expires < 1 || expires > 3650))
    return { ok: false, reason: 'Срок бонусов: от 1 до 3650 дней или без срока' };
  return {
    ok: true,
    value: { expectedRevision: revision, enabled: b['enabled'], accrualPercent: accrual, maxRedeemPercent: redeem, expiresDays: expires as number | null },
  };
}

export function parseBonusAdjustment(raw: unknown): Parsed<{ amountMinor: bigint; reason: string }> {
  const b = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const text = typeof b['amountMinor'] === 'number' ? String(b['amountMinor']) : b['amountMinor'];
  if (typeof text !== 'string' || !/^-?\d{1,15}$/.test(text.trim())) return { ok: false, reason: 'Сумма: целое число бонусов' };
  const amountMinor = BigInt(text.trim());
  if (amountMinor === 0n) return { ok: false, reason: 'Сумма не может быть нулём' };
  const reason = typeof b['reason'] === 'string' ? b['reason'].trim() : '';
  if (!reason || reason.length > 300) return { ok: false, reason: 'Укажите причину правки, до 300 знаков' };
  return { ok: true, value: { amountMinor, reason } };
}

// ───────────── сертификаты ─────────────

/** Без похожих знаков 0 O 1 I L: код читают вслух и вводят с бумаги */
export const CERTIFICATE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CERTIFICATE_CODE_LENGTH = 8;
export const DEFAULT_CERTIFICATE_MONTHS = 12;

export function generateCertificateCode(random: (size: number) => Uint8Array = (size) => randomBytes(size)): string {
  const out: string[] = [];
  // отбор без перекоса: байты за пределами кратного длине алфавита отбрасываются
  const limit = 256 - (256 % CERTIFICATE_ALPHABET.length);
  while (out.length < CERTIFICATE_CODE_LENGTH) {
    for (const byte of random(CERTIFICATE_CODE_LENGTH * 2)) {
      if (byte >= limit) continue;
      out.push(CERTIFICATE_ALPHABET[byte % CERTIFICATE_ALPHABET.length]!);
      if (out.length === CERTIFICATE_CODE_LENGTH) break;
    }
  }
  return out.join('');
}

export function normalizeCertificateCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CERTIFICATE_CODE_LENGTH) return null;
  return [...code].every((ch) => CERTIFICATE_ALPHABET.includes(ch)) ? code : null;
}

export type CertificateStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'VOID';

export interface CertificateForRedeem {
  businessId: string;
  status: CertificateStatus;
  balanceMinor: bigint;
  expiresAt: Date;
  currency: string;
}

export function certificateStatus(cert: Pick<CertificateForRedeem, 'status' | 'balanceMinor' | 'expiresAt'>, now: Date): CertificateStatus {
  if (cert.status === 'VOID' || cert.status === 'USED') return cert.status;
  if (cert.balanceMinor <= 0n) return 'USED';
  return cert.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : cert.status;
}

export type CertificateRedeem =
  | { ok: true; redeemMinor: bigint; remainderMinor: bigint; balanceAfterMinor: bigint }
  | { ok: false; reason: string };

/** Погашение: чужой бизнес не найден, просроченный и пустой не принимаются, не хватает: частично */
export function certificateRedeem(
  cert: CertificateForRedeem,
  ask: { businessId: string; now: Date; amountMinor: bigint; currency: string },
): CertificateRedeem {
  if (cert.businessId !== ask.businessId) return { ok: false, reason: 'Сертификат не найден' };
  const status = certificateStatus(cert, ask.now);
  if (status === 'VOID') return { ok: false, reason: 'Сертификат аннулирован' };
  if (status === 'USED') return { ok: false, reason: 'Сертификат уже использован' };
  if (status === 'EXPIRED') return { ok: false, reason: 'Срок сертификата истёк' };
  if (cert.currency !== ask.currency) return { ok: false, reason: 'Валюта сертификата не совпадает с валютой записи' };
  if (ask.amountMinor <= 0n) return { ok: false, reason: 'Сумма больше нуля' };
  const redeemMinor = ask.amountMinor < cert.balanceMinor ? ask.amountMinor : cert.balanceMinor;
  return { ok: true, redeemMinor, remainderMinor: ask.amountMinor - redeemMinor, balanceAfterMinor: cert.balanceMinor - redeemMinor };
}

/** Срок через N месяцев; 31 января + 1 месяц = 28 (29) февраля, а не 3 марта */
export function certificateExpiry(soldAt: Date, months: number): Date {
  const out = new Date(soldAt.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

export interface CertificateSaleInput {
  amountMinor: bigint;
  method: FoodPaymentMethod;
  months: number;
  buyerCustomerId: string | null;
  idempotencyKey: string;
}

export function parseCertificateSale(raw: unknown): Parsed<CertificateSaleInput> {
  const b = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const keys = ['amountMinor', 'method', 'months', 'buyerCustomerId', 'idempotencyKey'];
  if (Object.keys(b).some((key) => !keys.includes(key))) return { ok: false, reason: 'Лишние поля продажи' };
  const amount = b['amountMinor'];
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1)
    return { ok: false, reason: 'Номинал: целое число больше нуля' };
  if (typeof b['method'] !== 'string' || !isMoneyMethod(b['method']))
    return { ok: false, reason: 'Сертификат продаётся за деньги: выберите способ оплаты' };
  const months = b['months'] ?? DEFAULT_CERTIFICATE_MONTHS;
  if (typeof months !== 'number' || !Number.isInteger(months) || months < 1 || months > 60)
    return { ok: false, reason: 'Срок сертификата от 1 до 60 месяцев' };
  const buyer = b['buyerCustomerId'] ?? null;
  if (buyer !== null && (typeof buyer !== 'string' || !UUID.test(buyer))) return { ok: false, reason: 'Покупатель не найден' };
  const key = b['idempotencyKey'];
  if (typeof key !== 'string' || !key.trim() || key.length > 100) return { ok: false, reason: 'Нужен ключ повтора' };
  return {
    ok: true,
    value: { amountMinor: BigInt(amount), method: b['method'], months, buyerCustomerId: buyer as string | null, idempotencyKey: key.trim() },
  };
}

export interface AppointmentPaymentInput {
  method: AppointmentPaymentMethod;
  amount: bigint;
  idempotencyKey: string;
  certificateCode: string | null;
}

/** Оплата записи: живые деньги, бонусы или сертификат по коду */
export function parseAppointmentPayment(raw: unknown): Parsed<AppointmentPaymentInput> {
  const b = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  if (Object.keys(b).some((key) => !['method', 'amount', 'idempotencyKey', 'certificateCode'].includes(key)))
    return { ok: false, reason: 'Лишние поля оплаты' };
  const method = b['method'];
  if (typeof method !== 'string' || !(isMoneyMethod(method) || isLoyaltyMethod(method)))
    return { ok: false, reason: 'Неизвестный способ оплаты' };
  const amount = b['amount'];
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1)
    return { ok: false, reason: 'Сумма: целое число в минорных единицах' };
  const key = b['idempotencyKey'];
  if (typeof key !== 'string' || !key.trim() || key.length > 100) return { ok: false, reason: 'Нужен ключ повтора' };
  let certificateCode: string | null = null;
  if (method === 'GIFT_CERTIFICATE') {
    certificateCode = normalizeCertificateCode(b['certificateCode']);
    if (!certificateCode) return { ok: false, reason: 'Введите код сертификата: 8 знаков' };
  } else if (b['certificateCode'] != null) return { ok: false, reason: 'Код нужен только при оплате сертификатом' };
  return { ok: true, value: { method, amount: BigInt(amount), idempotencyKey: key.trim(), certificateCode } };
}
