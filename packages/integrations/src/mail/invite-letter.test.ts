import { describe, expect, it } from 'vitest';
import { INVITE_SUBJECT, daysWord, inviteLetter } from './invite-letter';

/**
 * Письмо-приглашение (срез 13, этап 7). В отличие от письма с кодом, ссылка здесь есть по замыслу
 * (DATA_MODEL §13.6: `token_hash` — «хеш ссылки»), и название организации тоже: человек должен
 * понимать, кто его зовёт. Кода в письме нет — код придёт отдельным письмом после принятия.
 */
describe('inviteLetter', () => {
  const letter = inviteLetter(
    'gost@example.com',
    'Хостел «Пример»',
    'https://app.example.com/invite/abc',
    7 * 24 * 60 * 60 * 1000,
  );

  it('адрес, тема и ссылка на месте; название организации названо', () => {
    expect(letter.to).toBe('gost@example.com');
    expect(letter.subject).toBe(INVITE_SUBJECT);
    expect(letter.text).toContain('https://app.example.com/invite/abc');
    expect(letter.text).toContain('Хостел «Пример»');
  });

  it('срок — днями словами; кода для входа в письме нет', () => {
    expect(letter.text).toContain('7 дней');
    expect(letter.text).not.toMatch(/Код для входа/);
  });

  it('роль названа, если её передали (ADR-098); без роли строки нет', () => {
    expect(
      inviteLetter('gost@example.com', 'Хостел «Пример»', 'https://x/invite/a', 86_400_000, 'управляющий')
        .text,
    ).toContain('Роль: управляющий.');
    expect(letter.text).not.toMatch(/Роль:/);
  });

  it('после принятия человек задаёт пароль — кода на почту больше нет (ADR-053)', () => {
    expect(letter.text).toContain('зададите себе пароль');
    expect(letter.text).not.toMatch(/придёт код/);
  });

  it('daysWord склоняет', () => {
    expect(daysWord(1)).toBe('день');
    expect(daysWord(2)).toBe('дня');
    expect(daysWord(5)).toBe('дней');
    expect(daysWord(11)).toBe('дней');
    expect(daysWord(21)).toBe('день');
  });
});
