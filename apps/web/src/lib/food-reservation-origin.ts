/** Кто принял бронь стола: без брони, голосовой агент (по телефону) или сотрудник (аудит и DATA_MODEL VOICE-BOOKING) */
export function foodReservationOrigin(r: { source?: string | null; employee?: { name: string } | null }): string {
  if (r.source === 'WALK_IN') return 'Без брони';
  if (r.source === 'VOICE') return 'Голосовой агент';
  return r.employee ? `Принял: ${r.employee.name}` : 'Сотрудник';
}
