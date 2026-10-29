import { appointmentSourceStatus } from './status/source';
import { statusLabel } from './status/types';

/**
 * Кто создал запись салона (аудит 22.10.2026 P2): с сайта клиент записался сам, остальное внёс администратор.
 * Слово «Стойка» осталось у гостиницы.
 */
export function appointmentSourceLabel(source: string | null | undefined): string {
  return source && source in appointmentSourceStatus ? statusLabel(appointmentSourceStatus, source) : 'Администратор';
}
