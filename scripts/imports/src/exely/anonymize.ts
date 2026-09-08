/**
 * Анонимизация гостя для dev-БД (ADR-018): детерминированная (HMAC-SHA256 с солью), необратимая.
 * Сохраняются только поля, нужные для сверок: внешний ключ, гражданство, пол, год рождения.
 * Реальный импорт без анонимизации — только в production-БД в Казахстане.
 */
import { createHmac } from 'node:crypto';
import type { GenderCode } from './normalize-reservation';

export interface GuestRecord {
  exelyPersonId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  citizenship: string | null;
  gender: GenderCode;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

function tag(salt: string, key: string, len: number): string {
  return createHmac('sha256', salt).update(key).digest('hex').slice(0, len);
}

export function anonymizeGuest(g: GuestRecord, salt: string): GuestRecord {
  if (!salt) throw new Error('anonymizeGuest: пустая соль');
  const h = tag(salt, g.exelyPersonId, 12);
  const digits = String(parseInt(h.slice(0, 8), 16) % 10_000_000).padStart(7, '0');
  return {
    exelyPersonId: g.exelyPersonId,
    firstName: 'Гость',
    lastName: `Тест-${h.slice(0, 6)}`,
    middleName: g.middleName ? null : null,
    birthDate: g.birthDate ? `${g.birthDate.slice(0, 4)}-01-01` : null,
    citizenship: g.citizenship,
    gender: g.gender,
    email: g.email ? `guest-${h.slice(6, 12)}@example.invalid` : null,
    phone: g.phone ? `+7000${digits}` : null,
    notes: null,
  };
}

/** Заметки брони тоже могут содержать ПД (имена, телефоны) — в dev не переносятся. */
export function anonymizeReservationNotes(notes: string | null): string | null {
  void notes; // содержимое намеренно не анализируется: любые заметки в dev стираются
  return null;
}
