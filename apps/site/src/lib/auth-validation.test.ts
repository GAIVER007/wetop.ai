import { describe, expect, it } from 'vitest';
import { authFieldErrors, firstInvalidField } from './auth-validation';
import { ru } from '../i18n/ru';

const texts = ru.auth.errors.fields;
const empty = { email: '', password: '', name: '', businessName: '', phone: '' };

/**
 * Окно входа и регистрации проверяет поля само (аудит 22.10.2026, P1-1a): без этого браузер
 * при пустом поле писал «Please fill out this field.» на английском.
 */
describe('authFieldErrors', () => {
  it('вход: пустые почта и пароль, свой русский текст у каждого поля', () => {
    expect(authFieldErrors('login', empty, texts)).toEqual({
      email: 'Введите почту',
      password: 'Введите пароль',
    });
  });
  it('регистрация: каждое пустое поле получает свой текст', () => {
    expect(authFieldErrors('register', empty, texts)).toEqual({
      name: 'Введите имя',
      businessName: 'Введите название бизнеса',
      phone: 'Введите телефон',
      email: 'Введите почту',
      password: 'Введите пароль',
    });
  });
  it('почта без @ и короткий новый пароль названы словами', () => {
    const errors = authFieldErrors(
      'register',
      { email: 'dana', password: '123', name: 'Дана', businessName: 'Бизнес', phone: '7015554433' },
      texts,
    );
    expect(errors).toEqual({
      email: 'Почта должна быть вида name@business.com',
      password: 'Пароль не короче 10 знаков',
    });
  });
  it('пробелы не считаются заполненным полем; заполненная форма без ошибок', () => {
    expect(authFieldErrors('login', { ...empty, email: '   ', password: 'x' }, texts)).toEqual({
      email: 'Введите почту',
    });
    expect(
      authFieldErrors('login', { ...empty, email: 'a@b.kz', password: 'x' }, texts),
    ).toEqual({});
  });
  it('первое ошибочное поле берётся в порядке формы, а не по алфавиту', () => {
    expect(firstInvalidField('register', { email: 'x', phone: 'y' })).toBe('phone');
    expect(firstInvalidField('login', { password: 'x' })).toBe('password');
    expect(firstInvalidField('login', {})).toBeNull();
  });
  it('в текстах нет английских сообщений браузера', () => {
    for (const text of Object.values(texts)) expect(text).not.toMatch(/[a-z]{4,}\s[a-z]/i);
  });
});
