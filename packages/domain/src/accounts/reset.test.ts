import { describe, expect, it } from 'vitest';
import {
  RESET_HOURS,
  invitationLetter,
  passwordResetLetter,
  resetExpiry,
  resetLink,
  resetState,
} from './index';

const now = new Date('2026-09-15T10:00:00Z');

describe('одноразовая ссылка на пароль', () => {
  it(`живёт ${RESET_HOURS} часа`, () => {
    expect(RESET_HOURS).toBe(24);
    expect(resetExpiry(now)).toEqual(new Date('2026-09-16T10:00:00Z'));
  });

  it('годна, пока не просрочена и не использована', () => {
    const row = { expiresAt: resetExpiry(now), usedAt: null };
    expect(resetState(row, now)).toBe('active');
    expect(resetState(row, new Date('2026-09-16T10:00:01Z'))).toBe('expired');
    expect(resetState({ ...row, usedAt: now }, now)).toBe('used');
  });

  it('использованная ссылка не годна и до истечения срока', () => {
    expect(resetState({ expiresAt: resetExpiry(now), usedAt: now }, now)).toBe('used');
  });

  it('ссылка собирается от адреса стойки, токен уходит в запрос', () => {
    expect(resetLink('https://app.wetop.ai', 'abc-123')).toBe(
      'https://app.wetop.ai/login/set-password?token=abc-123',
    );
    expect(resetLink('https://app.wetop.ai/', 'a b')).toBe(
      'https://app.wetop.ai/login/set-password?token=a+b',
    );
  });
});

describe('письма', () => {
  const link = 'https://app.wetop.ai/login/set-password?token=abc';

  it('приглашение: зовёт по имени, даёт ссылку и говорит срок', () => {
    const letter = invitationLetter({ fullName: 'Айгуль Сеитова', link });
    expect(letter.subject).toBe('WETOP: задайте пароль для входа');
    expect(letter.text).toContain('Айгуль Сеитова');
    expect(letter.text).toContain(link);
    expect(letter.text).toContain('24 часа');
  });

  it('сброс пароля: та же ссылка, другой повод', () => {
    const letter = passwordResetLetter({ link });
    expect(letter.subject).toBe('WETOP: смена пароля');
    expect(letter.text).toContain(link);
  });

  it('в письмах нет пароля — только ссылка', () => {
    for (const letter of [invitationLetter({ fullName: 'Имя', link }), passwordResetLetter({ link })]) {
      expect(letter.text.toLowerCase()).not.toMatch(/пароль:\s*\S/);
    }
  });

  it('письмо просит не отвечать: ящик односторонний', () => {
    expect(passwordResetLetter({ link }).text).toContain('не отвечайте');
  });
});
