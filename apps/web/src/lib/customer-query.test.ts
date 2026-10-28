import { describe, expect, it } from 'vitest';
import { splitCustomerQuery } from './customer-match';

describe('новый клиент из одного поля поиска (владелец 26.10.2026: «зачем нам тавтология»)', () => {
  it('имя и фамилия без телефона', () => {
    expect(splitCustomerQuery('  Айгуль   Тестова ')).toEqual({ firstName: 'Айгуль', lastName: 'Тестова', phone: '' });
  });
  it('только телефон', () => {
    expect(splitCustomerQuery('+7 701 000 00 00')).toEqual({ firstName: '', lastName: '', phone: '+7 701 000 00 00' });
  });
  it('имя и телефон в одной строке, в любом порядке', () => {
    expect(splitCustomerQuery('Айгуль +7 701 000 00 00')).toEqual({ firstName: 'Айгуль', lastName: '', phone: '+7 701 000 00 00' });
    expect(splitCustomerQuery('8 (701) 000-00-00 Тест Клиент')).toEqual({ firstName: 'Тест', lastName: 'Клиент', phone: '8 (701) 000-00-00' });
  });
  it('короткие цифры остаются частью имени', () => {
    expect(splitCustomerQuery('Тест 1')).toEqual({ firstName: 'Тест', lastName: '1', phone: '' });
  });
  it('пусто', () => {
    expect(splitCustomerQuery('   ')).toEqual({ firstName: '', lastName: '', phone: '' });
  });
});
