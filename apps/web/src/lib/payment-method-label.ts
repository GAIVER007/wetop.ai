import { PAYMENT_METHOD_RU } from '@pms/domain';

/**
 * Способы оплаты счёта брони словами: те же подписи с заглавной, что в «Финансах» и кассе
 * (`PAYMENT_METHOD_RU`; аудит 22.10.2026 P2-2: в счёте были «наличные, карта (терминал)»).
 */
const DESK_ORDER = [
  'CASH',
  'CARD_TERMINAL',
  'KASPI',
  'HALYK',
  'BANK_TRANSFER_PERSON',
  'BANK_TRANSFER_LEGAL',
  'DEPOSIT',
  'CARD_GUARANTEE',
] as const;

export const methodRu = (m: string): string => PAYMENT_METHOD_RU[m] ?? m;

/** Способы стойки (без EXTERNAL: его ставят каналы) в порядке по умолчанию */
export const DESK_PAYMENT_METHODS: Array<[string, string]> = DESK_ORDER.map((k) => [k, methodRu(k)]);

/** Внутри фразы («5 000 ₸, наличные, на счёт…»): строчными, имена банков и сервисов как есть */
export function methodInline(m: string): string {
  const label = methodRu(m);
  return /^(Kaspi|Halyk)/.test(label) ? label : label.charAt(0).toLocaleLowerCase('ru') + label.slice(1);
}
