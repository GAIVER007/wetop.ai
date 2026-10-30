/**
 * Ссылка приглашения (владелец 30.10.2026: «отправить на почту и скопировать ссылку приглашения»).
 * Текст для WhatsApp и адрес wa.me; номер только цифрами, пустой номер: обычная ссылка «выбрать чат».
 */
export function inviteWhatsAppText(link: string, business: string, t: (s: string, v?: Record<string, string>) => string): string {
  return t('Приглашение в {business} в WETOP. Откройте ссылку и задайте пароль: {link}', { business, link });
}

export function inviteWhatsAppUrl(text: string, phone?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
