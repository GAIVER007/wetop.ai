/**
 * @pms/shared — общие типы и утилиты без бизнес-логики.
 * Деньги — только integer minor units (ADR-008); float запрещён.
 */

/** Исчерпывающая проверка switch/if по union-типам: компилятор и runtime ловят пропущенный вариант. */
export function assertNever(value: never, context = 'assertNever'): never {
  throw new Error(`${context}: unexpected value ${JSON.stringify(value)}`);
}

export { findMarkdownTable, parseMarkdownTable, type MarkdownTable } from './markdown-table';
export { blankToNull } from './text';
export type { DataConnection } from './data-connection';
export { encryptPii, decryptPii, maskNumber, PiiKeyMissingError } from './pii-crypto';
export {
  guestForStorage,
  pseudonymizeGuest,
  realPiiAllowed,
  pseudonymSalt,
  AnonymizeSaltMissingError,
  type GuestIdentity,
} from './pii-residency';
