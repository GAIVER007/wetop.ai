import { beforeEach, describe, expect, it } from 'vitest';

import { MailError, type MailMessage, mailConfigFromEnv } from './sender';
import { StubMailSender } from './stub';

describe('заглушка отправителя', () => {
  let sender: StubMailSender;
  beforeEach(() => {
    sender = new StubMailSender();
  });

  it('письма копятся в порядке отправки', async () => {
    await sender.send({ to: 'a@example.com', subject: 'раз', text: '1' });
    await sender.send({ to: 'b@example.com', subject: 'два', text: '2' });
    expect(sender.sent.map((m) => m.subject)).toEqual(['раз', 'два']);
    expect(sender.last?.to).toBe('b@example.com');
  });

  it('письма одного адресата отбираются отдельно', async () => {
    await sender.send({ to: 'a@example.com', subject: 'раз', text: '1' });
    await sender.send({ to: 'b@example.com', subject: 'два', text: '2' });
    await sender.send({ to: 'a@example.com', subject: 'три', text: '3' });
    expect(sender.to('a@example.com')).toHaveLength(2);
  });

  it('снаружи список писем не испортить', async () => {
    await sender.send({ to: 'a@example.com', subject: 'раз', text: '1' });
    const copy = sender.sent as MailMessage[];
    copy.length = 0;
    expect(sender.sent).toHaveLength(1);
  });

  it('падение заказывается заранее и срабатывает один раз', async () => {
    sender.failOnce();
    await expect(sender.send({ to: 'a@example.com', subject: 'раз', text: '1' })).rejects.toThrow(
      MailError,
    );
    await sender.send({ to: 'a@example.com', subject: 'два', text: '2' });
    expect(sender.sent).toHaveLength(1);
  });
});

describe('настройки отправителя из окружения', () => {
  const full = {
    MAIL_PROVIDER: 'resend',
    MAIL_API_KEY: 'ключ',
    MAIL_FROM: 'noreply@wetop.ai',
    MAIL_FROM_NAME: 'WETOP',
  };

  it('полный набор читается целиком', () => {
    expect(mailConfigFromEnv(full)).toEqual({
      provider: 'resend',
      apiKey: 'ключ',
      from: 'noreply@wetop.ai',
      fromName: 'WETOP',
    });
  });

  it('пустая строка — это не настройка, а недонастроенное окружение', () => {
    expect(mailConfigFromEnv({ ...full, MAIL_API_KEY: '' })).toBeNull();
    expect(mailConfigFromEnv({ ...full, MAIL_API_KEY: '   ' })).toBeNull();
    expect(mailConfigFromEnv({ ...full, MAIL_FROM: '' })).toBeNull();
    expect(mailConfigFromEnv({ ...full, MAIL_PROVIDER: '' })).toBeNull();
  });

  it('без переменных вовсе — тоже null, а не половина настроек', () => {
    expect(mailConfigFromEnv({})).toBeNull();
  });

  it('подпись отправителя необязательна, у неё есть умолчание', () => {
    expect(mailConfigFromEnv({ ...full, MAIL_FROM_NAME: '' })?.fromName).toBe('WETOP');
  });
});
