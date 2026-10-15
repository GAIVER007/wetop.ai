import { describe, expect, it } from 'vitest';
import {
  BAR_METHOD_RU,
  BAR_SALE_METHODS,
  BAR_SUPPLIER_METHODS,
  barMethodRu,
  barPaymentMethods,
} from './payment-methods';

/** Формы бара на настройке способов объекта (ADR-185, план plans/bar-payment-methods-2026-10-15.md) */
describe('бар: способы оплаты из настройки объекта', () => {
  it('без объекта (салон, ресторан) список бара целиком, в его порядке', () => {
    expect(barPaymentMethods(null, BAR_SALE_METHODS)).toEqual([...BAR_SALE_METHODS]);
    expect(barPaymentMethods(null, BAR_SUPPLIER_METHODS)).toEqual([...BAR_SUPPLIER_METHODS]);
  });
  it('у объекта: только включённые, в порядке настройки, и только те, что бар принимает', () => {
    const enabled = ['HALYK', 'DEPOSIT', 'CASH', 'BANK_TRANSFER_LEGAL', 'CARD_GUARANTEE'];
    expect(barPaymentMethods(enabled, BAR_SALE_METHODS)).toEqual(['HALYK', 'CASH']);
    expect(barPaymentMethods(enabled, BAR_SUPPLIER_METHODS)).toEqual(['HALYK', 'CASH', 'BANK_TRANSFER_LEGAL']);
  });
  it('объект оставил только депозит и гарантию: бару предложить нечего', () => {
    expect(barPaymentMethods(['DEPOSIT', 'CARD_GUARANTEE'], BAR_SALE_METHODS)).toEqual([]);
  });
  it('бар не принимает депозит, гарантию картой и внешний канал; поставщику ещё счёт организации', () => {
    for (const m of ['DEPOSIT', 'CARD_GUARANTEE', 'EXTERNAL']) {
      expect(BAR_SALE_METHODS).not.toContain(m);
      expect(BAR_SUPPLIER_METHODS).not.toContain(m);
    }
    expect(BAR_SALE_METHODS).not.toContain('BANK_TRANSFER_LEGAL');
    expect(BAR_SUPPLIER_METHODS).toContain('BANK_TRANSFER_LEGAL');
  });
  it('подписи бара короткие, в одну строку формы; чужой код возвращается как есть', () => {
    for (const m of BAR_SUPPLIER_METHODS) expect(BAR_METHOD_RU[m]).toBeTruthy();
    expect(barMethodRu('CARD_TERMINAL')).toBe('Карта');
    expect(barMethodRu('EXTERNAL')).toBe('EXTERNAL');
  });
});
