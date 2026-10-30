import { describe, expect, it } from 'vitest';
import { inviteWhatsAppText, inviteWhatsAppUrl } from './invite-link';

const t = (s: string, v: Record<string, string> = {}) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

describe('ссылка приглашения в WhatsApp (владелец 30.10.2026)', () => {
  it('текст с названием и ссылкой, номер только цифрами', () => {
    const text = inviteWhatsAppText('https://app.wetop.ai/invite/abc', 'Lashes', t);
    expect(text).toBe('Приглашение в Lashes в WETOP. Откройте ссылку и задайте пароль: https://app.wetop.ai/invite/abc');
    expect(inviteWhatsAppUrl(text, '+974 5512-3456')).toBe(`https://wa.me/97455123456?text=${encodeURIComponent(text)}`);
  });
  it('без номера: выбор чата в WhatsApp', () => {
    expect(inviteWhatsAppUrl('x', null)).toBe('https://wa.me/?text=x');
  });
});
