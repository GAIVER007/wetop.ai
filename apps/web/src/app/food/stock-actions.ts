'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ApiError } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';
import { stockApi } from '../../lib/food-api';
import type { StockLotView, StockProductInput, StockReceiptInput } from '../../lib/food-types';

/** Склад FS2 (DATA_MODEL §34): действия стойки; деньги приходят целыми minor units выбранной валюты. */
type StockCommand =
  | { kind: 'product'; id?: string; body: Partial<StockProductInput> }
  | { kind: 'receipt'; body: StockReceiptInput }
  | { kind: 'reverse'; id: string }
  | { kind: 'write-off'; body: { productId: string; qty: string; reason: string } }
  | { kind: 'inventory'; body: { productId: string; actualQty: string; reason?: string | null; unitCost?: number } };

async function scope(key: string) {
  const { context } = await currentMe();
  const vertical = context?.vertical;
  if (
    !context ||
    (vertical !== 'BEAUTY' && vertical !== 'FOOD_SERVICE') ||
    !context.businessId ||
    !context.locationId ||
    key !== `${context.businessId}:${context.locationId}`
  )
    throw new ApiError(
      409,
      `Выбран другой ${context?.vertical === 'BEAUTY' ? 'салон' : 'ресторан'}. Откройте форму заново.`,
    );
  return vertical;
}

export async function mutateStock(
  scopeKey: string,
  command: StockCommand,
): Promise<{ error: string | null }> {
  try {
    const vertical = await scope(scopeKey);
    switch (command.kind) {
      case 'product':
        if (command.id) await stockApi.updateProduct(command.id, command.body);
        else await stockApi.createProduct(command.body as StockProductInput);
        break;
      case 'receipt':
        await stockApi.receipt(command.body);
        break;
      case 'reverse':
        await stockApi.reverseLot(command.id);
        break;
      case 'write-off':
        await stockApi.writeOff(command.body);
        break;
      case 'inventory':
        await stockApi.inventory(command.body);
        break;
    }
    revalidatePath(vertical === 'BEAUTY' ? '/bar/consumables' : '/stock');
    return { error: null };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : 'Не удалось сохранить. Повторите действие.',
    };
  }
}

/** Партии ингредиента для панели «Партии» (чтение по требованию, а не на загрузке экрана) */
export async function loadLots(
  scopeKey: string,
  productId: string,
): Promise<{ error: string | null; items: StockLotView[] }> {
  try {
    await scope(scopeKey);
    return { error: null, items: (await stockApi.lots(productId)).items };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : 'Не удалось загрузить партии', items: [] };
  }
}
