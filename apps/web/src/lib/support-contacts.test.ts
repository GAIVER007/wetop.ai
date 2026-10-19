import { describe, expect, it } from 'vitest';
import { supportContacts } from './support-contacts';

describe('supportContacts (SUP1)', () => {
  it('нет ни одного контакта: блока нет', () => {
    expect(supportContacts({})).toBeNull();
    expect(supportContacts({ SUPPORT_HOURS: '9:00–21:00' })).toBeNull();
    expect(supportContacts({ SUPPORT_WHATSAPP: '  ', SUPPORT_TELEGRAM: '' })).toBeNull();
  });

  it('WhatsApp: только цифры номера и готовое начало сообщения с филиалом', () => {
    const c = supportContacts({ SUPPORT_WHATSAPP: '+7 (700) 123-45-67' }, 'Хостел «Луч» & Ко');
    const url = new URL(c!.whatsapp!);
    expect(url.origin + url.pathname).toBe('https://wa.me/77001234567');
    expect(url.searchParams.get('text')).toBe('Здравствуйте! Пишу из WETOP, филиал «Хостел «Луч» & Ко». Вопрос: ');
  });

  it('без филиала сообщение без его названия', () => {
    const c = supportContacts({ SUPPORT_WHATSAPP: '77001234567' });
    expect(new URL(c!.whatsapp!).searchParams.get('text')).toBe('Здравствуйте! Пишу из WETOP. Вопрос: ');
  });

  it('Telegram без @, почта mailto, часы строкой; пустые поля отсутствуют', () => {
    const c = supportContacts({ SUPPORT_TELEGRAM: '@wetop_help', SUPPORT_EMAIL: 'help@wetop.ai', SUPPORT_HOURS: ' ежедневно ' });
    expect(c).toEqual({ telegram: 'https://t.me/wetop_help', email: 'help@wetop.ai', hours: 'ежедневно' });
  });

  it('мусор в номере и имени не превращается в ссылку', () => {
    expect(supportContacts({ SUPPORT_WHATSAPP: 'нет', SUPPORT_TELEGRAM: 'a b/c' })).toBeNull();
    expect(supportContacts({ SUPPORT_EMAIL: 'not-an-email' })).toBeNull();
  });
});
