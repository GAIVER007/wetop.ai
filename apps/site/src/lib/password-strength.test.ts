import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password-strength';

describe('подсказка надёжности пароля при регистрации', () => {
  it('пусто: оценки нет', () => {
    expect(passwordStrength('')).toMatchObject({ score: 0, label: '' });
  });
  it('короче 10 знаков: слабый, хоть и с разными знаками', () => {
    expect(passwordStrength('Ab1!xyz')).toMatchObject({ score: 1, label: 'Слабый' });
  });
  it('одни цифры: слабый, сервер такой не примет', () => {
    const s = passwordStrength('9384756102');
    expect(s.score).toBe(1);
    expect(s.rules.find((r) => r.id === 'notDigits')!.met).toBe(false);
  });
  it('частый шаблон слабый даже при длине', () => {
    expect(passwordStrength('qwertyuiop12')).toMatchObject({ score: 1, guessable: true });
    expect(passwordStrength('aaaaBBBB1!x')).toMatchObject({ score: 1, guessable: true });
  });
  it('обязательное выполнено, дополнительного одно: средний', () => {
    expect(passwordStrength('лето в горах')).toMatchObject({ score: 2, label: 'Средний' });
  });
  it('буквы, цифры и регистр: хороший', () => {
    expect(passwordStrength('Gostinica2026')).toMatchObject({ score: 3, label: 'Хороший' });
  });
  it('буквы, цифры, регистр и знак: надёжный, кириллица считается буквами', () => {
    expect(passwordStrength('Салон-Лето2026')).toMatchObject({ score: 4, label: 'Надёжный' });
  });
  it('пробелы по краям в длину не входят, как у сервера', () => {
    expect(passwordStrength('  Ab1!xyz   ').rules.find((r) => r.id === 'length')!.met).toBe(false);
  });
});
