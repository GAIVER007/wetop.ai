import { translator, type Translate } from '../i18n';

/** Кто принял бронь стола: без брони, голосовой агент (по телефону) или сотрудник (аудит и DATA_MODEL VOICE-BOOKING) */
export function foodReservationOrigin(
  r: { source?: string | null; employee?: { name: string } | null },
  t: Translate = translator('ru'),
): string {
  if (r.source === 'WALK_IN') return t('Без брони');
  if (r.source === 'VOICE') return t('Голосовой агент');
  return r.employee ? t('Принял: {name}', { name: r.employee.name }) : t('Сотрудник');
}
