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

  it('роль названа, если её передали (ADR-107); без роли строки нет', () => {
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

/** Язык организации (ORG-LOCALE-20261026): салон в Катаре зовёт сотрудника письмом на английском */
describe('inviteLetter: язык организации', () => {
  const link = 'https://app.example.com/invite/abc';
  it('английский: тема, текст, роль и срок по-английски, кириллицы нет', () => {
    const letter = inviteLetter('admin@example.com', 'Lashes by Kyial salon', link, 7 * 86_400_000, 'STAFF', 'en');
    expect(letter.subject).toBe('Invitation to WETOP');
    expect(letter.text).toContain('You are invited to join "Lashes by Kyial salon" in WETOP.');
    expect(letter.text).toContain('Role: administrator.');
    expect(letter.text).toContain('valid for 7 days');
    expect(letter.text).toContain('create your own password');
    expect(letter.text).toContain(link);
    expect(letter.text + letter.subject).not.toMatch(/[А-Яа-яЁё]/);
  });
  it('один день по-английски в единственном числе', () => {
    expect(inviteLetter('a@example.com', 'X', link, 86_400_000, undefined, 'en').text).toContain('valid for 1 day ');
  });
  it('казахский: тема и роль по-казахски', () => {
    const letter = inviteLetter('a@example.com', 'X', link, 7 * 86_400_000, 'MANAGER', 'kk');
    expect(letter.subject).toBe('WETOP-қа шақыру');
    expect(letter.text).toContain('Рөлі: басқарушы.');
  });
  it('без языка и для ru всё как раньше: роль кодом переводится в русское слово', () => {
    const ru = inviteLetter('a@example.com', 'X', link, 7 * 86_400_000, 'STAFF', 'ru');
    expect(ru.subject).toBe(INVITE_SUBJECT);
    expect(ru.text).toContain('Роль: администратор.');
  });
});
