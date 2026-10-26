import { describe, expect, it } from 'vitest';
import { matchesCustomer, normalizeSearchText } from './customer-match';

const aidai = { name: 'Asanova Aidai', phone: '+974 5186 5708' };
const alena = { name: 'Алёна Тестова', phone: '+7 701 000 11 22' };

describe('поиск клиента по имени или телефону (владелец 25.10.2026)', () => {
  it('пустой запрос находит всех', () => {
    expect(matchesCustomer('   ', aidai)).toBe(true);
  });
  it('слова имени в любом порядке и любом регистре', () => {
    expect(matchesCustomer('Asanova Aidai', aidai)).toBe(true);
    expect(matchesCustomer('aidai  asanova', aidai)).toBe(true);
    expect(matchesCustomer('AIDAI', aidai)).toBe(true);
    expect(matchesCustomer('Aidai Kerimova', aidai)).toBe(false);
  });
  it('ё и е, знаки над буквами не мешают', () => {
    expect(matchesCustomer('алена', alena)).toBe(true);
    expect(matchesCustomer('Алёна', { name: 'Алена Тестова', phone: null })).toBe(true);
    expect(matchesCustomer('jose', { name: 'José Test', phone: null })).toBe(true);
    expect(normalizeSearchText('  Ёлка  ЗЕЛЁНАЯ ')).toBe('елка зеленая');
  });
  it('имя и часть телефона в одном запросе', () => {
    expect(matchesCustomer('Aidai 5186', aidai)).toBe(true);
    expect(matchesCustomer('5186 aidai', aidai)).toBe(true);
    expect(matchesCustomer('Aidai 9999', aidai)).toBe(false);
  });
  it('телефон с пробелами, плюсом и скобками читается одним номером', () => {
    expect(matchesCustomer('5186 5708', aidai)).toBe(true);
    expect(matchesCustomer('+974 5186', aidai)).toBe(true);
    expect(matchesCustomer('(701) 000-11', alena)).toBe(true);
    expect(matchesCustomer('5186 0000', aidai)).toBe(false);
  });
  it('одна-две цифры не ищут по телефону, но ищут в имени', () => {
    expect(matchesCustomer('51', aidai)).toBe(false);
    expect(matchesCustomer('2', { name: 'Тест 2', phone: '+7 700 000 0000' })).toBe(true);
    expect(matchesCustomer('тест 2', { name: 'Тест 2', phone: null })).toBe(true);
  });
  it('клиент без телефона не находится по цифрам', () => {
    expect(matchesCustomer('5186', { name: 'Без телефона', phone: null })).toBe(false);
  });
});
