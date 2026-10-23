/**
 * Кто создал запись салона (аудит 22.10.2026 P2): с сайта клиент записался сам, остальное внёс администратор.
 * Слово «Стойка» осталось у гостиницы.
 */
export function appointmentSourceLabel(source: string | null | undefined): string {
  if (source === 'VOICE') return 'Голосовой агент';
  return source === 'WEBSITE' ? 'Сайт' : 'Администратор';
}
