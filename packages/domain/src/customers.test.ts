import { describe, expect, it } from 'vitest';
import { customerPhoneKey, parseCustomerInput } from './customers';

describe('Customer phone identity', () => {
  for (const phone of ['+77000001001', '87000001001', '7000001001', '8 (700) 000-10-01', '+7\u00a0700\u202f0001001'])
    it(`нормализует ${phone}`, () => expect(customerPhoneKey(phone)).toBe('+77000001001'));
  it('сохраняет явный международный префикс', () => {
    expect(customerPhoneKey('+1 (202) 555-0101')).toBe('+12025550101');
    expect(customerPhoneKey('+1234567890')).toBe('+1234567890');
  });
  for (const phone of [null, '', 'abc77000001001', '700+0001001', '123', '1'.repeat(16)])
    it(`отклоняет неподдерживаемый ввод ${phone}`, () => expect(customerPhoneKey(phone)).toBeNull());
  it('не меняет исходный номер в контракте создания', () => {
    expect(parseCustomerInput({ firstName: ' Тест ', phone: '8 (700) 000-10-01' })).toEqual({
      ok: true, value: { firstName: 'Тест', lastName: null, phone: '8 (700) 000-10-01' },
    });
  });
  it('ограничивает длины и требует имя с телефоном', () => {
    for (const body of [{ firstName: 'x'.repeat(101), phone: '+77000001001' },
      { firstName: 'Тест', lastName: 'x'.repeat(101), phone: '+77000001001' },
      { firstName: 'Тест' }, { phone: '+77000001001' }])
      expect(parseCustomerInput(body).ok).toBe(false);
  });
});
