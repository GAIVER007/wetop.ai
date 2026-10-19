import { describe, expect, it } from 'vitest';
import {
  BeautyCustomerImportError,
  normalizeBeautyCustomerPhone,
  parseBeautyCustomerInput,
  parseBeautyCustomersCsv,
} from './customers';

describe('клиенты салона: имя, телефон и CSV', () => {
  it('нормализует телефон и не угадывает части полного имени из импорта', () => {
    expect(normalizeBeautyCustomerPhone('8 (701) 234-56-78')).toBe('+77012345678');
    expect(parseBeautyCustomerInput({ name: '  Тестовый   Клиент  ', phone: '8 701 234 56 78' })).toEqual({
      firstName: 'Тестовый Клиент',
      lastName: null,
      fullName: 'Тестовый Клиент',
      phone: '+77012345678',
    });
  });

  it('читает Excel-совместимый CSV с обязательными колонками Имя и Телефон', () => {
    expect(parseBeautyCustomersCsv('\uFEFFИмя;Телефон\r\nТестовый Клиент;8 701 234 56 78')).toEqual([
      { line: 2, name: 'Тестовый Клиент', phone: '+77012345678' },
    ]);
  });

  it('отклоняет пустые, неверные и слишком большие файлы целиком', () => {
    expect(() => parseBeautyCustomersCsv('Имя;Телефон\n;')).toThrow(BeautyCustomerImportError);
    expect(() => parseBeautyCustomersCsv('Имя;Телефон\nТестовый Клиент;12')).toThrow('Строка 2');
    const rows = Array.from({ length: 501 }, (_, index) => `Клиент ${index};+7701000${String(index).padStart(4, '0')}`);
    expect(() => parseBeautyCustomersCsv(`Имя;Телефон\n${rows.join('\n')}`)).toThrow('не больше 500 строк');
  });
});
