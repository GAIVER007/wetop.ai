import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { customerSearch, customerSearchWhere } from './search';

describe('поиск клиента в шапке (аудит 22.10.2026 P1-4)', () => {
  it('пустой запрос значит «без поиска», лишние пробелы схлопываются', () => {
    expect(customerSearch(undefined)).toBeNull();
    expect(customerSearch('   ')).toBeNull();
    expect(customerSearch('  Тестовая   Клиентка ')).toBe('Тестовая Клиентка');
  });
  it('не строка и длинный запрос: 400', () => {
    expect(() => customerSearch(['a'])).toThrow(BadRequestException);
    expect(() => customerSearch('я'.repeat(101))).toThrow(BadRequestException);
  });
  it('слова ищутся в имени, фамилии и телефоне без учёта регистра', () => {
    expect(customerSearchWhere('Тест Клиент')).toEqual({
      AND: ['Тест', 'Клиент'].map((word) => ({
        OR: [
          { firstName: { contains: word, mode: 'insensitive' } },
          { lastName: { contains: word, mode: 'insensitive' } },
          { phone: { contains: word } },
        ],
      })),
    });
  });
  it('телефон с 8 и скобками ищется по нормализованным цифрам', () => {
    expect(customerSearchWhere('8 (700) 000')).toEqual({
      OR: [{ phone: { contains: '8 (700) 000' } }, { phoneNormalized: { contains: '7700000' } }],
    });
    expect(customerSearchWhere('8 700 000 10 01')).toEqual({
      OR: [{ phone: { contains: '8 700 000 10 01' } }, { phoneNormalized: { contains: '77000001001' } }],
    });
  });
});
