import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { BarRepository } from './bar.repository';
import { BarService } from './bar.service';

/**
 * Бар гостиницы принимает деньги только включёнными у объекта способами (DATA_MODEL §21.6, ADR-185, план
 * plans/bar-payment-methods-2026-10-15.md); бар без объекта (салон, ресторан) настройки не имеет и работает как раньше.
 */
const PRODUCT = '30000000-0000-4000-8000-000000000001';
const RECEIPT = '10000000-0000-4000-8000-000000000001';
function service(enabled: string[] | null) {
  const calls: string[] = [];
  const repo = {
    enabledPaymentMethods: async () => enabled,
    sellRetail: async (input: { method: string }) => {
      calls.push(`sale:${input.method}`);
      return { kind: 'not_found' as const };
    },
    payReceipt: async (_id: string, input: { method: string }) => {
      calls.push(`pay:${input.method}`);
      return { kind: 'not_found' as const };
    },
  } as unknown as BarRepository;
  return { svc: new BarService(repo), calls };
}
const sale = (method: string) => ({ productId: PRODUCT, quantityUnits: '1', method, idempotencyKey: 'k1' });
const pay = (method: string) => ({ amountMinor: '100', method, idempotencyKey: '00000000-0000-4000-8000-0000000000aa' });

describe('бар: способ оплаты против настройки объекта', () => {
  it('выключенный у объекта способ отказывает 400 словами кассы и до репозитория не доходит', async () => {
    const { svc, calls } = service(['CASH', 'HALYK']);
    await expect(svc.sellRetail(sale('KASPI'))).rejects.toMatchObject({
      constructor: BadRequestException,
      message: 'Способ оплаты «Kaspi» выключен в настройках объекта',
    });
    await expect(svc.payReceipt(RECEIPT, pay('KASPI'))).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toEqual([]);
  });
  it('включённый способ проходит дальше (здесь товар и приход не найдены, 404)', async () => {
    const { svc, calls } = service(['CASH', 'HALYK']);
    await expect(svc.sellRetail(sale('HALYK'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.payReceipt(RECEIPT, pay('CASH'))).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toEqual(['sale:HALYK', 'pay:CASH']);
  });
  it('бар без объекта: настройки нет, прежний список бара действует', async () => {
    const { svc, calls } = service(null);
    await expect(svc.sellRetail(sale('KASPI'))).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toEqual(['sale:KASPI']);
    expect(await svc.paymentMethods()).toEqual({
      sale: ['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON'],
      supplier: ['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL'],
    });
  });
  it('способ вне списка бара отказывает как раньше, даже если объект его включил', async () => {
    const { svc } = service(['DEPOSIT', 'CASH']);
    await expect(svc.sellRetail(sale('DEPOSIT'))).rejects.toMatchObject({
      message: 'Способ оплаты не поддерживается',
    });
  });
  it('список форм: порядок настройки, только способы бара', async () => {
    const { svc } = service(['HALYK', 'DEPOSIT', 'BANK_TRANSFER_LEGAL', 'CASH']);
    expect(await svc.paymentMethods()).toEqual({
      sale: ['HALYK', 'CASH'],
      supplier: ['HALYK', 'BANK_TRANSFER_LEGAL', 'CASH'],
    });
  });
});
