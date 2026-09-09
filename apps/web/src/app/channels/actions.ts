'use server';
import { revalidatePath } from 'next/cache';
import { ApiError, channelsApi } from '../../lib/api';

export interface ChannelActionResult {
  error: string | null;
  message: string | null;
}
const describe = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);

export async function channelAction(
  kind: 'setup' | 'sync' | 'pull' | 'flush',
): Promise<ChannelActionResult> {
  try {
    let message: string;
    if (kind === 'setup') {
      const r = (await channelsApi.setup()) as {
        created: { property: boolean; roomTypes: number; ratePlans: number };
      };
      message = `Объект ${r.created.property ? 'создан' : 'уже был'}, категорий создано ${r.created.roomTypes}, тарифов ${r.created.ratePlans}`;
    } else if (kind === 'sync') {
      const r = await channelsApi.sync(365);
      message = `Полная выгрузка ${r.from} → ${r.to}; задачи Channex: ${r.tasks.join(', ')}`;
    } else if (kind === 'pull') {
      const r = await channelsApi.pull();
      message = `Получено ревизий: ${r.received}, подтверждено: ${r.acknowledged}`;
    } else {
      const r = await channelsApi.flush();
      message = `Отправлено пакетов: ${r.sent.length}${r.errors.length ? `, ошибок: ${r.errors.length}` : ''}`;
    }
    revalidatePath('/channels');
    revalidatePath('/chessboard');
    return { error: null, message };
  } catch (e) {
    return { error: describe(e), message: null };
  }
}
