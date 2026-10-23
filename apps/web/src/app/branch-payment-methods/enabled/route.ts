import { NextResponse } from 'next/server';
import { restaurantApi } from '../../../lib/food-api';

/**
 * Включённые способы оплаты филиала для форм приёма денег (§21.7): обычный GET, а не действие сервера. Действие
 * сервера шло бы тем же POST с заголовком `next-action`, что и сама оплата, и вставало бы в очередь действий
 * страницы перед денежной командой (CI 39954903026, beauty-ui money-recovery-real). Права и филиал проверяет API
 * (`GET /food-service/payment-methods`, право desk); здесь только пересылка с сессией человека. Не прочитался: `null`,
 * форма покажет все шесть, а выключенный способ отклонит сервер.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { methods } = await restaurantApi.paymentMethods();
    return NextResponse.json(
      { methods: methods.filter((m) => m.enabled).map((m) => m.method) },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ methods: null }, { headers: { 'cache-control': 'no-store' } });
  }
}
