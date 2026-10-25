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
  it('телефон с 8 и скобками ищется и по сырым цифрам, и по цифрам с 7 (8 → 7 только казахстанский вариант)', () => {
    expect(customerSearchWhere('8 (700) 000')).toEqual({
      OR: [
        { phone: { contains: '8 (700) 000' } },
        { phoneNormalized: { contains: '8700000' } },
        { phoneNormalized: { contains: '7700000' } },
      ],
    });
    expect(customerSearchWhere('8 700 000 10 01')).toEqual({
      OR: [
        { phone: { contains: '8 700 000 10 01' } },
        { phoneNormalized: { contains: '87000001001' } },
        { phoneNormalized: { contains: '77000001001' } },
      ],
    });
  });
  it('номер другой страны с 8 внутри не теряется: Катар +974 и местный номер на 8', () => {
    const where = customerSearchWhere('8123 4567');
    expect(where.OR).toContainEqual({ phoneNormalized: { contains: '81234567' } });
    expect(customerSearchWhere('+974 5186')).toEqual({
      OR: [{ phone: { contains: '+974 5186' } }, { phoneNormalized: { contains: '9745186' } }],
    });
  });
  it('слово с тремя и больше цифрами в запросе с именем ищется и по цифрам телефона', () => {
    expect(customerSearchWhere('Aidai 51865708')).toEqual({
      AND: [
        {
          OR: [
            { firstName: { contains: 'Aidai', mode: 'insensitive' } },
            { lastName: { contains: 'Aidai', mode: 'insensitive' } },
            { phone: { contains: 'Aidai' } },
          ],
        },
        {
          OR: [
            { firstName: { contains: '51865708', mode: 'insensitive' } },
            { lastName: { contains: '51865708', mode: 'insensitive' } },
            { phone: { contains: '51865708' } },
            { phoneNormalized: { contains: '51865708' } },
          ],
        },
      ],
    });
  });
});
