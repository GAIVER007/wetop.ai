/**
 * Запрос оплаты (DATA_MODEL §23, ADR-141): счёт Kaspi по номеру телефона, ссылка банка или перевод, привязанные к
 * счёту проживания. Здесь только разбор формы и текст гостю; запись и превращение в платёж — в API под блокировкой.
 * У Kaspi официального API оплаты для внешнего софта нет: счёт выставляется в Kaspi Pay вручную, здесь он учитывается.
 */
import { FinanceRuleError, parseMoney } from './finance';

export const PAYMENT_REQUEST_METHODS = [
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'CARD_TERMINAL',
] as const;
export type PaymentRequestMethod = (typeof PAYMENT_REQUEST_METHODS)[number];
export const PAYMENT_REQUEST_LINK_MAX = 500;

export interface PaymentRequestInput {
  method: PaymentRequestMethod;
  amountMinor: bigint;
  link: string | null;
  note: string | null;
}

export type ParsedRequest =
  { ok: true; value: PaymentRequestInput } | { ok: false; reason: string };

/** Форма запроса: сумма в тенге («12000», «12 000,50»), способ, необязательная ссылка https и заметка */
export function parsePaymentRequestInput(raw: unknown): ParsedRequest {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const method = PAYMENT_REQUEST_METHODS.find((m) => m === b.method);
  if (!method) return { ok: false, reason: 'Способ: Kaspi, Halyk, перевод или терминал' };
  const amountText =
    typeof b.amount === 'number' ? String(b.amount) : typeof b.amount === 'string' ? b.amount : '';
  let amountMinor: bigint;
  try {
    amountMinor = parseMoney(amountText.replace(/\s/g, ''));
  } catch (e) {
    if (e instanceof FinanceRuleError)
      return { ok: false, reason: 'Сумма: число больше нуля, до двух знаков после запятой' };
    throw e;
  }
  if (amountMinor <= 0n)
    return { ok: false, reason: 'Сумма: число больше нуля, до двух знаков после запятой' };
  const linkRaw = typeof b.link === 'string' ? b.link.trim() : '';
  let link: string | null = null;
  if (linkRaw) {
    let ok: boolean;
    try {
      ok = new URL(linkRaw).protocol === 'https:';
    } catch {
      ok = false;
    }
    if (!ok || !linkRaw.startsWith('https://') || linkRaw.length > PAYMENT_REQUEST_LINK_MAX)
      return {
        ok: false,
        reason: `Ссылка: адрес банка, начинается с https://, до ${PAYMENT_REQUEST_LINK_MAX} знаков`,
      };
    link = linkRaw;
  }
  const noteRaw = typeof b.note === 'string' ? b.note.trim().slice(0, 300) : '';
  return { ok: true, value: { method, amountMinor, link, note: noteRaw || null } };
}

/** 1200000 → «12 000 ₸»; копейки только когда есть */
function money(minor: string, currency: string): string {
  const digits = minor.replace(/^-/, '').padStart(3, '0');
  const int = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = digits.slice(-2);
  return `${int}${frac === '00' ? '' : `,${frac}`} ${currency === 'KZT' ? '₸' : currency}`;
}

export type MessageLang = 'ru' | 'kk' | 'en' | 'zh';

export interface PaymentRequestMessageInput {
  lang: MessageLang;
  propertyName: string;
  confirmationNumber: string;
  amountMinor: string;
  currency: string;
  method: PaymentRequestMethod;
  link: string | null;
}

type How = 'kaspi' | 'link' | 'transfer' | 'desk';
const howOf = (m: PaymentRequestMethod, link: string | null): How =>
  link ? 'link' : m === 'KASPI' ? 'kaspi' : m === 'CARD_TERMINAL' ? 'desk' : 'transfer';

const TEXT: Record<
  MessageLang,
  { head: (p: string, n: string, sum: string) => string } & Record<How, (link: string) => string>
> = {
  ru: {
    head: (p, n, sum) => `${p}: счёт на оплату брони ${n}, ${sum}.`,
    kaspi: () =>
      'Счёт выставлен в Kaspi на ваш номер телефона: откройте Kaspi.kz, раздел «Платежи», и подтвердите оплату.',
    link: (l) => `Оплатить по ссылке: ${l}`,
    transfer: () => 'Реквизиты для перевода пришлёт администратор.',
    desk: () => 'Оплатить картой можно на стойке при заселении.',
  },
  kk: {
    head: (p, n, sum) => `${p}: ${n} брондауын төлеу шоты, ${sum}.`,
    kaspi: () =>
      'Шот Kaspi-де телефон нөміріңізге қойылды: Kaspi.kz ашып, «Төлемдер» бөлімінде төлемді растаңыз.',
    link: (l) => `Сілтеме арқылы төлеу: ${l}`,
    transfer: () => 'Аударым деректемелерін әкімші жібереді.',
    desk: () => 'Картамен орналасу кезінде ресепшнде төлеуге болады.',
  },
  en: {
    head: (p, n, sum) => `${p}: payment request for booking ${n}, ${sum}.`,
    kaspi: () =>
      'The invoice is issued in Kaspi to your phone number: open Kaspi.kz, go to Payments and confirm.',
    link: (l) => `Pay by link: ${l}`,
    transfer: () => 'The front desk will send transfer details.',
    desk: () => 'You can pay by card at the front desk on arrival.',
  },
  zh: {
    head: (p, n, sum) => `${p}：预订 ${n} 的付款单，${sum}。`,
    kaspi: () => '账单已通过 Kaspi 发送到您的手机号：打开 Kaspi.kz，在“付款”中确认支付。',
    link: (l) => `通过链接付款：${l}`,
    transfer: () => '前台将发送转账信息。',
    desk: () => '入住时可在前台刷卡付款。',
  },
};

/** Текст, который администратор отправляет гостю в мессенджер; без длинного тире и лишних ссылок */
export function paymentRequestMessage(input: PaymentRequestMessageInput): string {
  const t = TEXT[input.lang] ?? TEXT.ru;
  const how = howOf(input.method, input.link);
  return `${t.head(input.propertyName, input.confirmationNumber, money(input.amountMinor, input.currency))} ${t[how](input.link ?? '')}`;
}
