import { describe, expect, it } from 'vitest';

import { LOGIN_CODE_SUBJECT, loginCodeLetter, minutesWord } from './login-code-letter';

const TEN_MINUTES = 10 * 60 * 1000;

describe('письмо с кодом входа', () => {
  it('код попадает в письмо как есть, с ведущими нулями', () => {
    const letter = loginCodeLetter('gost@example.com', '007421', TEN_MINUTES);
    expect(letter.text).toContain('Код для входа: 007421');
  });

  it('тема одна и та же, адрес получателя не меняется', () => {
    const letter = loginCodeLetter('gost@example.com', '123456', TEN_MINUTES);
    expect(letter.subject).toBe(LOGIN_CODE_SUBJECT);
    expect(letter.to).toBe('gost@example.com');
  });

  it('в теле нет ссылок — письмо с кодом и ссылкой неотличимо от фишинга', () => {
    const letter = loginCodeLetter('gost@example.com', '123456', TEN_MINUTES);
    expect(letter.text).not.toMatch(/https?:\/\//);
    expect(letter.text).not.toContain('www.');
  });

  it('в теле нет ни адреса получателя, ни чего-либо ещё о нём', () => {
    const letter = loginCodeLetter('ivanov@example.com', '123456', TEN_MINUTES);
    expect(letter.text).not.toContain('ivanov');
    expect(letter.text).not.toContain('example.com');
  });

  it('человек узнаёт срок жизни кода и что код одноразовый', () => {
    const letter = loginCodeLetter('gost@example.com', '123456', TEN_MINUTES);
    expect(letter.text).toContain('10 минут');
    expect(letter.text).toContain('один раз');
  });

  it('есть что делать тому, кто вход не запрашивал', () => {
    const letter = loginCodeLetter('gost@example.com', '123456', TEN_MINUTES);
    expect(letter.text).toContain('не вы');
  });

  it('срок меньше минуты округляется до одной, а не до нуля', () => {
    const letter = loginCodeLetter('gost@example.com', '123456', 20_000);
    expect(letter.text).toContain('1 минуту');
    expect(letter.text).not.toContain('0 минут');
  });

  it('склонение минут', () => {
    expect(minutesWord(1)).toBe('минуту');
    expect(minutesWord(2)).toBe('минуты');
    expect(minutesWord(5)).toBe('минут');
    expect(minutesWord(11)).toBe('минут');
    expect(minutesWord(12)).toBe('минут');
    expect(minutesWord(14)).toBe('минут');
    expect(minutesWord(21)).toBe('минуту');
    expect(minutesWord(22)).toBe('минуты');
    expect(minutesWord(25)).toBe('минут');
    expect(minutesWord(111)).toBe('минут');
  });
});
